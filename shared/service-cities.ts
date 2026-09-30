export const SERVICE_CITIES = [
  { id: "beijing", name: "北京", province: "北京市" },
  { id: "changchun", name: "长春", province: "吉林省" },
] as const;

export type ServiceCityId = (typeof SERVICE_CITIES)[number]["id"];

export const SERVICE_AREAS: Record<ServiceCityId, readonly string[]> = {
  beijing: [
    "东城区", "西城区", "朝阳区", "丰台区", "石景山区", "海淀区", "门头沟区", "房山区",
    "通州区", "顺义区", "昌平区", "大兴区", "怀柔区", "平谷区", "密云区", "延庆区",
  ],
  changchun: ["朝阳区", "南关区", "宽城区", "二道区", "绿园区", "双阳区", "九台区"],
};

export const SUPPORTED_SPORTS = ["田径", "羽毛球", "游泳", "网球", "篮球", "体能"] as const;

export function isServiceCity(value: string): value is ServiceCityId {
  return SERVICE_CITIES.some((city) => city.id === value);
}

export function cityName(cityId: ServiceCityId) {
  return SERVICE_CITIES.find((city) => city.id === cityId)?.name ?? "北京";
}

export function resolveServiceCity(value: string | null | undefined): ServiceCityId {
  return value === "changchun" || value === "长春" ? "changchun" : "beijing";
}

export function isServiceArea(cityId: ServiceCityId, district: string) {
  return SERVICE_AREAS[cityId].includes(district);
}

type Coordinates = { latitude: number; longitude: number };

// Conservative boxes are sufficient for choosing between the two supported cities.
// District selection remains explicit, so coordinates never become a service address.
export function detectServiceCity({ latitude, longitude }: Coordinates): ServiceCityId | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude >= 39.40 && latitude <= 41.10 && longitude >= 115.35 && longitude <= 117.55) return "beijing";
  if (latitude >= 43.15 && latitude <= 45.25 && longitude >= 124.80 && longitude <= 126.90) return "changchun";
  return null;
}
