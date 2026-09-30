export type FavoriteIntent = { coachId: number; favorite: boolean; version: number };
export type FavoriteCache = { ids: number[]; pending: FavoriteIntent[] };
type Ticket = { owner: string; epoch: number; revision: number };

// Server snapshots are authoritative; only unacknowledged local intent overlays them.
export class FavoriteSync {
  owner = '';
  private epoch = 0;
  private revision = 0;
  private snapshot: number[] = [];
  private pending: FavoriteIntent[] = [];
  private sending: Promise<void> | null = null;
  activate(owner: string, cache: FavoriteCache = { ids: [], pending: [] }) {
    this.owner = owner; this.epoch++; this.revision++;
    this.snapshot = [...cache.ids];
    this.pending = cache.pending.map(item => ({ ...item, version: ++this.revision }));
    this.sending = null;
  }
  ticket(): Ticket { return { owner:this.owner, epoch:this.epoch, revision:this.revision }; }
  private current(ticket: Ticket) { return this.owner === ticket.owner && this.epoch === ticket.epoch; }
  ids() {
    const ids = new Set(this.snapshot);
    for (const item of this.pending) { if (item.favorite) ids.add(item.coachId); else ids.delete(item.coachId); }
    return [...ids].sort((a,b)=>a-b);
  }
  save(): FavoriteCache { return { ids:[...this.snapshot], pending:this.pending.map(item=>({...item})) }; }
  accept(ids: number[], ticket: Ticket) {
    if (!this.current(ticket) || this.revision !== ticket.revision) return false;
    this.snapshot = [...new Set(ids)]; this.revision++; return true;
  }
  toggle(coachId: number) {
    const favorite = !this.ids().includes(coachId);
    this.pending = [...this.pending.filter(item=>item.coachId!==coachId),{coachId,favorite,version:++this.revision}];
    return favorite;
  }
  flush(send: (id: number, favorite: boolean) => Promise<number[]>, changed: () => void = () => {}) {
    if (this.sending) return this.sending;
    const ticket = this.ticket();
    const batch = this.pending.map(item=>({...item}));
    const task = (async () => {
      for (const item of batch) {
        if (!this.current(ticket)) return;
        // A newer toggle replaces this item; it will be sent on the next flush.
        if (!this.pending.some(p=>p.version===item.version)) continue;
        const ids = await send(item.coachId,item.favorite);
        if (!this.current(ticket)) return;
        this.snapshot = [...new Set(ids)];
        this.pending = this.pending.filter(p=>p.version!==item.version);
        this.revision++; changed();
      }
    })();
    this.sending = task;
    void task.finally(()=>{ if(this.sending===task) this.sending=null; }).catch(()=>undefined);
    return task;
  }
}
