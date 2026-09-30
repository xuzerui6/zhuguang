import { FavoriteSync } from '../../../app/mobile/favorite-sync';
import { toggleFavorite } from './api';
import { getLocalFavoriteCoachIds, getSessionOwner, setLocalFavoriteCoachIds } from './storage';

const sync = new FavoriteSync();
const listeners = new Set<(ids: number[]) => void>();
function current() {
  const owner = getSessionOwner();
  if (owner !== sync.owner) sync.activate(owner, { ids: owner === 'guest' ? getLocalFavoriteCoachIds() : [], pending: [] });
  return sync;
}
function changed() { const ids = current().ids(); for (const listener of listeners) listener(ids); }
export function favoriteIds() { return current().ids(); }
export function favoriteTicket() { return current().ticket(); }
export function acceptFavorites(ids: number[], ticket: ReturnType<typeof favoriteTicket>) { current().accept(ids, ticket); changed(); }
export function subscribeFavorites(listener: (ids: number[]) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
let flushing: Promise<void> | null = null;
export function flushFavorites() {
  if (getSessionOwner() === 'guest') return Promise.resolve();
  if (flushing) return flushing;
  const owner = getSessionOwner();
  const task = (async () => {
    while (current().owner === owner && current().save().pending.length) {
      await current().flush(async (id, active) => (await toggleFavorite(id, active)).favoriteCoachIds, changed);
    }
  })();
  flushing = task;
  void task.finally(() => { if (flushing === task) flushing = null; }).catch(() => undefined);
  return task;
}
export async function changeFavorite(id: number) {
  current().toggle(id); changed();
  if (getSessionOwner() === 'guest') { setLocalFavoriteCoachIds(current().ids()); return; }
  await flushFavorites();
}
