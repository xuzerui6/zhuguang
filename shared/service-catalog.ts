export type ServiceCatalog = { city: "北京"; sports: Array<{ id: string; name: string }>; regions: Array<{ id: string; name: string }> };
export const EMPTY_SERVICE_CATALOG: ServiceCatalog = { city: "北京", sports: [], regions: [] };
