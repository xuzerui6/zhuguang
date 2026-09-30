import Taro from "@tarojs/taro";

export type ServiceCityId = "beijing" | "changchun";

export const SERVICE_CITIES = [
  { id: "beijing" as const, name: "北京" },
  { id: "changchun" as const, name: "长春" },
];

export const SERVICE_AREAS: Record<ServiceCityId, string[]> = {
  beijing: ["东城区", "西城区", "朝阳区", "丰台区", "石景山区", "海淀区", "门头沟区", "房山区", "通州区", "顺义区", "昌平区", "大兴区", "怀柔区", "平谷区", "密云区", "延庆区"],
  changchun: ["朝阳区", "南关区", "宽城区", "二道区", "绿园区", "双阳区", "九台区"],
};

export const ALL_SPORTS = ["田径", "羽毛球", "游泳", "网球", "篮球", "体能"];

const CITY_KEY = "zhuguang-miniapp-service-city";

export function getStoredServiceCity(): ServiceCityId {
  return Taro.getStorageSync<ServiceCityId>(CITY_KEY) === "changchun" ? "changchun" : "beijing";
}

export function storeServiceCity(cityId: ServiceCityId) {
  Taro.setStorageSync(CITY_KEY, cityId);
}

export function serviceCityName(cityId: ServiceCityId) {
  return cityId === "changchun" ? "长春" : "北京";
}

export function detectServiceCity(latitude: number, longitude: number): ServiceCityId | null {
  if (latitude >= 39.40 && latitude <= 41.10 && longitude >= 115.35 && longitude <= 117.55) return "beijing";
  if (latitude >= 43.15 && latitude <= 45.25 && longitude >= 124.80 && longitude <= 126.90) return "changchun";
  return null;
}

export async function locateServiceCity(): Promise<ServiceCityId | null> {
  if (process.env.TARO_APP_FUZZY_LOCATION_ENABLED !== "true") throw new Error("小程序定位能力尚未开通，请手动选择服务城市");
  const fuzzy = (Taro as typeof Taro & {
    getFuzzyLocation?: (options: { type: "wgs84"; success:(location:{latitude:number;longitude:number})=>void; fail:(error:{errMsg?:string})=>void }) => void;
  }).getFuzzyLocation;
  if (!fuzzy) throw new Error("当前微信版本暂不支持模糊定位，请手动选择城市");
  const location = await new Promise<{latitude:number;longitude:number}>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("定位超时，请手动选择城市")),10000);
    fuzzy({type:"wgs84",success:value=>{clearTimeout(timer);resolve(value);},fail:()=>{clearTimeout(timer);reject(new Error("定位未完成，请检查定位权限或手动选择城市"));}});
  });
  return detectServiceCity(location.latitude, location.longitude);
}
