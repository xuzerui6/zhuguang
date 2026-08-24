export const BASE_SESSION_MINUTES = 60;

export function calculateDurationPriceFen(basePriceFen: number, durationMinutes: number) {
  if (!Number.isFinite(basePriceFen) || basePriceFen < 0) return 0;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.round((basePriceFen * durationMinutes) / BASE_SESSION_MINUTES);
}

export function durationMinutesBetween(startsAt: number, endsAt: number) {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return 0;
  return Math.round((endsAt - startsAt) / 60_000);
}
