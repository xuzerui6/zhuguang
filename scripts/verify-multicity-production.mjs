const origin = "https://api.beijingzhuguang.top";
if (!process.env.ZHUGUANG_VERIFY_CHANNEL_KEY) throw new Error("Encrypted channel configuration is required");
for (const path of ["/api/v1/catalog?city=beijing", "/api/v1/catalog?city=changchun", "/api/v1/coaches?city=changchun", "/api/v1/coaches/5/booking-options?city=changchun"]) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000), headers: { "x-zhuguang-app-key": process.env.ZHUGUANG_VERIFY_CHANNEL_KEY, "x-app-platform": "web", "x-device-id": "multicity-readonly-verification" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${payload.error?.code || "request_failed"}`);
  const data = payload.data;
  console.log(JSON.stringify({ path, status: response.status, city: data.cityName, sports: data.sports?.map(sport => ({ name: sport.name, count: sport.coachCount })), coaches: Array.isArray(data) ? data.map(coach => ({ id: coach.id, name: coach.name, cities: coach.serviceCities })) : undefined, venues: data.venues?.length, regularPriceFen: data.regularBasePriceFen, trialPriceFen: data.trialBasePriceFen }));
  if (path.includes("booking-options") && (data.cityId !== "changchun" || data.venues.length !== 0)) throw new Error("Unexpected Changchun booking configuration");
}
