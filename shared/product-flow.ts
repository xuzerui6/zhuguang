export function dateInShanghai(now = Date.now()) {
  return new Date(now + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

export function parseTrainingTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !/^\d{2}:\d{2}$/u.test(time)) return NaN;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return NaN;
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(utc).toISOString().slice(0, 16) !== `${date}T${time}`) return NaN;
  return utc - 8 * 60 * 60_000;
}

export class SubmissionKey {
  private fingerprint = '';
  private key = '';
  constructor(private create = () => `request_${Date.now()}_${Math.random().toString(36).slice(2)}`) {}
  for(payload: unknown) {
    const fingerprint = JSON.stringify(payload);
    if (!this.key || fingerprint !== this.fingerprint) {
      this.fingerprint = fingerprint;
      this.key = this.create();
    }
    return this.key;
  }
  clear() { this.key = ''; this.fingerprint = ''; }
}

export class LatestRead {
  private epoch = 0;
  begin() { return ++this.epoch; }
  cancel() { ++this.epoch; }
  isCurrent(epoch: number) { return epoch === this.epoch; }
}

const LOCAL_PAGES = new Set(['index', 'booking', 'coach-detail', 'profile-edit', 'learner-profile', 'coach-application', 'conversation', 'review', 'legal', 'service-records', 'support']);
export function isTrainingTimeAllowed(startsAt: number, now = Date.now()) {
  return Number.isFinite(startsAt) && startsAt >= now + 2 * 3_600_000 && startsAt <= now + 60 * 86_400_000;
}
export function safeMiniappNext(next: string | undefined) {
  try { if (next?.startsWith('%')) next = decodeURIComponent(next); } catch { next = undefined; }
  if (next && /^\/pages\/([a-z-]+)\/index(?:\?[^\r\n#]*)?$/u.test(next) && LOCAL_PAGES.has(next.split('/')[2])) return next;
  return '/pages/index/index?tab=profile';
}
