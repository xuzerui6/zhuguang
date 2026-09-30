import type { ServiceCatalog } from '../../shared/service-catalog';
import type { ServiceCityId } from '../../shared/service-cities';
import type { CoachProfile } from './web-platform';

export type HomeCityData = { cityId: ServiceCityId; coaches: CoachProfile[]; catalog: ServiceCatalog };
type HomeCityState = { data: HomeCityData; pendingCity: ServiceCityId | null; error: string | null };

export class HomeCityController {
  private state: HomeCityState;
  private sequence = 0;
  private listeners = new Set<() => void>();
  private reads = new Map<ServiceCityId, Promise<HomeCityData>>();

  constructor(initial: HomeCityData, private read: (cityId: ServiceCityId) => Promise<HomeCityData>) {
    this.state = { data: initial, pendingCity: null, error: null };
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(state: HomeCityState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  async load(cityId: ServiceCityId) {
    const sequence = ++this.sequence;
    if (cityId === this.state.data.cityId) {
      this.update({ ...this.state, pendingCity: null, error: null });
      return true;
    }
    this.update({ ...this.state, pendingCity: cityId, error: null });
    let pending = this.reads.get(cityId);
    if (!pending) {
      pending = this.read(cityId);
      this.reads.set(cityId, pending);
      const current = pending;
      void pending.finally(() => { if (this.reads.get(cityId) === current) this.reads.delete(cityId); }).catch(() => undefined);
    }
    try {
      const data = await pending;
      if (sequence !== this.sequence) return false;
      this.update({ data, pendingCity: null, error: null });
      return true;
    } catch {
      if (sequence !== this.sequence) return false;
      this.update({ ...this.state, pendingCity: null, error: '城市内容暂时无法更新，原内容已保留。' });
      return false;
    }
  }
  cancel() { ++this.sequence; }
}

export function homeCityUrl(url: URL, cityId: ServiceCityId, coachIds: number[]) {
  const next = new URL(url);
  next.searchParams.set('city', cityId);
  const coachId = Number(next.searchParams.get('coach'));
  if (next.searchParams.has('coach') && !coachIds.includes(coachId)) next.searchParams.delete('coach');
  return next.pathname + next.search + next.hash;
}

export function homeTrialPrice(coaches: CoachProfile[]) {
  return coaches.filter(coach => coach.profileKind === 'real' && coach.bookable && coach.bookingEnabled !== false && coach.pricingStatus === 'published' && typeof coach.trialPrice === 'number' && coach.trialPrice > 0)
    .reduce<number | undefined>((price, coach) => price === undefined ? coach.trialPrice : Math.min(price, coach.trialPrice!), undefined);
}
