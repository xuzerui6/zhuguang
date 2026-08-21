export const BEIJING_TIME_ZONE = "Asia/Shanghai";
export const MIN_SLOT_DURATION_MS = 30 * 60_000;
export const MAX_SLOT_DURATION_MS = 4 * 60 * 60_000;

export type ScheduleDraft = {
  endsAt: number;
  startsAt: number;
  venueId: string;
};

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

export function parseBeijingDateTimeLocal(value: string) {
  const match = localDateTimePattern.exec(value.trim());
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, Number(minute));
  const roundTrip = formatBeijingDateTimeLocal(timestamp);
  return roundTrip === value.trim() ? timestamp : Number.NaN;
}

export function formatBeijingDateTimeLocal(timestamp: number) {
  if (!Number.isFinite(timestamp)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export function nextBeijingSlotDefaults(now = Date.now(), durationMinutes = 90) {
  const rounded = Math.ceil((now + 10 * 60_000) / (30 * 60_000)) * 30 * 60_000;
  return {
    endsAt: formatBeijingDateTimeLocal(rounded + durationMinutes * 60_000),
    min: formatBeijingDateTimeLocal(now + 60_000),
    startsAt: formatBeijingDateTimeLocal(rounded),
  };
}

export function validateScheduleDraft(draft: ScheduleDraft, now = Date.now()) {
  const fieldErrors: Record<string, string> = {};
  if (!draft.venueId.trim()) fieldErrors.venueId = "请选择训练场馆";
  if (!Number.isFinite(draft.startsAt)) fieldErrors.startsAt = "请选择有效的开始时间";
  else if (draft.startsAt <= now) fieldErrors.startsAt = "开始时间必须晚于当前时间";
  if (!Number.isFinite(draft.endsAt)) fieldErrors.endsAt = "请选择有效的结束时间";
  else if (Number.isFinite(draft.startsAt)) {
    const duration = draft.endsAt - draft.startsAt;
    if (duration < MIN_SLOT_DURATION_MS) fieldErrors.endsAt = "训练时长不能少于30分钟";
    else if (duration > MAX_SLOT_DURATION_MS) fieldErrors.endsAt = "训练时长不能超过4小时";
  }
  return fieldErrors;
}
