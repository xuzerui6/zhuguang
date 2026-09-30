import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { detectServiceCity, type ServiceCityId } from "../../shared/service-cities";

export async function locateServiceCity(): Promise<ServiceCityId> {
  if (!Capacitor.isNativePlatform()) throw new Error("请手动选择服务城市");
  const current = await Geolocation.checkPermissions().catch(() => { throw new Error("请开启系统定位，或手动选择城市"); });
  const permission = current.coarseLocation === "granted" ? current : await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });
  if (permission.coarseLocation !== "granted") throw new Error("未获得模糊定位权限，请手动选择城市");
  const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  const city = detectServiceCity(position.coords);
  if (!city) throw new Error("当前位置不在北京或长春，请手动选择服务城市");
  return city;
}
