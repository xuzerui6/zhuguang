import type { ServiceCityId } from "./service-cities";

export type ServiceCatalog = {
  city: string;
  cityId?: ServiceCityId;
  cities?: Array<{ id: ServiceCityId; name: string; province?: string }>;
  sports: Array<{ id: string; name: string; available?: boolean; coachCount?: number }>;
  regions: Array<{ id: string; name: string }>;
  serviceAreas?: Array<{ id: string; name: string }>;
};
export const EMPTY_SERVICE_CATALOG: ServiceCatalog = { city: "北京", sports: [], regions: [] };
