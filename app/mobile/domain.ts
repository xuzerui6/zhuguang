import type {
  BookingStatus,
  MatchPreferences,
  MatchResult,
  MobileBooking,
  MobileCoach,
} from "./types";

export const terminalBookingStatuses: BookingStatus[] = [
  "completed",
  "rejected",
  "cancelled_by_student",
  "cancelled_by_coach",
];

const allowedBookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending_coach: ["confirmed", "reschedule_requested", "rejected", "cancelled_by_student"],
  confirmed: ["completed", "reschedule_requested", "cancelled_by_student", "cancelled_by_coach"],
  reschedule_requested: ["confirmed", "rejected", "cancelled_by_student", "cancelled_by_coach"],
  completed: [],
  rejected: [],
  cancelled_by_student: [],
  cancelled_by_coach: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus) {
  return allowedBookingTransitions[from].includes(to);
}

export function isFutureBookingDate(date: string, now = new Date()) {
  const parsed = new Date(`${date}T23:59:59+08:00`);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() >= now.getTime();
}

export function formatYuan(fen: number) {
  return new Intl.NumberFormat("zh-CN", {
    currency: "CNY",
    maximumFractionDigits: fen % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(fen / 100);
}

export function getBookingStatusCopy(status: BookingStatus) {
  const copy: Record<BookingStatus, { label: string; tone: string }> = {
    pending_coach: { label: "待教练确认", tone: "pending" },
    confirmed: { label: "已确认", tone: "success" },
    reschedule_requested: { label: "改期协商中", tone: "warning" },
    completed: { label: "已完成", tone: "neutral" },
    rejected: { label: "教练未接受", tone: "danger" },
    cancelled_by_student: { label: "已取消", tone: "neutral" },
    cancelled_by_coach: { label: "教练已取消", tone: "danger" },
  };
  return copy[status];
}

export function getMatchResult(coach: MobileCoach, preferences: MatchPreferences): MatchResult {
  const sportMatches = preferences.sport === "全部项目" || coach.sport === preferences.sport;
  const verified = coach.verified !== false;
  if (!sportMatches || !verified) return { eligible: false, reasons: [], score: 0 };

  let score = 0;
  const reasons: string[] = [];

  if (preferences.goal === "全部目标" || coach.goals.includes(preferences.goal)) {
    score += 30;
    reasons.push(preferences.goal === "全部目标" ? "训练方向覆盖完整" : `擅长${preferences.goal}`);
  }

  const cityMatches = preferences.city === "全部城市" || coach.city === preferences.city;
  const districtMatches = preferences.district === "全北京" || coach.district === preferences.district;
  if (cityMatches && districtMatches) {
    score += 25;
    reasons.push(coach.district ? `${coach.district}就近训练` : "服务区域匹配");
  } else if (cityMatches) {
    score += 14;
    reasons.push("同城可约");
  }

  const availabilityText = coach.availability.join(" ");
  const timeMatches =
    coach.availability.length > 0 && (
      preferences.desiredTime === "不限" ||
      (preferences.desiredTime === "周末" && /周六|周日/.test(availabilityText)) ||
      (preferences.desiredTime === "工作日" && /周一|周二|周三|周四|周五/.test(availabilityText)) ||
      (preferences.desiredTime === "晚间" && /18:|19:|20:|21:/.test(availabilityText))
    );
  if (timeMatches) {
    score += 25;
    reasons.push(preferences.desiredTime === "不限" ? "近期有可约时段" : `${preferences.desiredTime}可约`);
  }

  if (coach.price <= preferences.budget) {
    score += 15;
    reasons.push(`课时价在预算内`);
  }

  if (preferences.audience === "全部人群" || coach.audience.includes(preferences.audience)) {
    score += 5;
    reasons.push(`适合${preferences.audience === "全部人群" ? "多年龄段" : preferences.audience}`);
  }

  return { eligible: true, reasons: reasons.slice(0, 3), score: Math.min(100, score) };
}

export function mergeFavoriteIds(localIds: number[], remoteIds: number[]) {
  return [...new Set([...localIds, ...remoteIds])].sort((left, right) => left - right);
}

export function getBookingBucket(booking: MobileBooking) {
  if (booking.status === "pending_coach" || booking.status === "reschedule_requested") return "pending";
  if (booking.status === "confirmed") return "active";
  return "completed";
}

export function createRequestId(prefix = "zg") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
