import { getSessionOwner } from './storage';
import type { ServiceCityId } from './service-city';
import { SubmissionKey } from '../../../shared/product-flow';

export type BookingDraft = {
  date: string; time: string; duration: 60 | 90 | 120; locationType: 'venue' | 'custom';
  venueId: string; district: string; address: string; note: string; selectedLearnerId: string;
};
// Training locations and learner selection stay in memory, not persistent storage.
const drafts = new Map<string, { owner: string; until: number; value: BookingDraft; linking: boolean }>();
const submissions = new Map<string, { owner: string; keys: SubmissionKey }>();
export function bookingSubmissionKeys(coach: number, city: ServiceCityId) {
  const key = `${city}:${coach}`;
  let submission = submissions.get(key);
  if (!submission || submission.owner !== getSessionOwner()) { submission = { owner: getSessionOwner(), keys: new SubmissionKey() }; submissions.set(key, submission); }
  return submission.keys;
}
export function saveBookingDraft(coach: number, city: ServiceCityId, value: BookingDraft, linking = false) {
  drafts.set(`${city}:${coach}`, { owner: getSessionOwner(), until: Date.now() + 30 * 60_000, value, linking });
}
export function readBookingDraft(coach: number, city: ServiceCityId) {
  const key = `${city}:${coach}`;
  const draft = drafts.get(key);
  if (!draft) return undefined;
  if (draft.until < Date.now() || (draft.owner !== getSessionOwner() && !(draft.owner === 'guest' && draft.linking))) {
    drafts.delete(key); return undefined;
  }
  draft.owner = getSessionOwner(); draft.linking = false;
  return draft.value;
}
export function clearBookingDraft(coach: number, city: ServiceCityId) { drafts.delete(`${city}:${coach}`); submissions.delete(`${city}:${coach}`); }
export function clearBookingDrafts() { drafts.clear(); submissions.clear(); }
