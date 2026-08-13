import { coachCatalog, type CoachPublicProfile } from "../../shared/coach-catalog";
import type { MobileCoach } from "../mobile/types";

export type WebArea = "public" | "student" | "coach" | "ops";

export type Permission =
  | "student:read"
  | "coach:work"
  | "ops:manage"
  | "release:read";

export type IconName =
  | "home"
  | "search"
  | "calendar"
  | "message"
  | "training"
  | "profile"
  | "dashboard"
  | "schedule"
  | "course"
  | "payment"
  | "credential"
  | "matching"
  | "coaches"
  | "users"
  | "content"
  | "release";

export type NavItem = {
  badge?: number;
  group?: string;
  href: string;
  icon: IconName;
  id: string;
  label: string;
  permission: Permission;
};

export type WebSession = {
  accountId: string | null;
  availableAreas: Array<Exclude<WebArea, "public">>;
  authorizationSource: "access" | "allowlist" | "anonymous" | "email" | "siwc";
  displayName: string;
  email: string | null;
  isAuthenticated: boolean;
  permissions: Permission[];
};

export type CoachProfile = CoachPublicProfile & { image: string };

export const featureFlags = {
  r2Updates: true,
} as const;

export const studentNavigation: NavItem[] = [
  { href: "/student", icon: "home", id: "student-home", label: "首页", permission: "student:read" },
  { href: "/student/coaches", icon: "search", id: "student-coaches", label: "找教练", permission: "student:read" },
  { href: "/student/bookings", icon: "calendar", id: "student-bookings", label: "我的预约", permission: "student:read" },
  { href: "/student/messages", icon: "message", id: "student-messages", label: "消息", permission: "student:read" },
  { href: "/student/training", icon: "training", id: "student-training", label: "训练档案", permission: "student:read" },
  { href: "/student/profile", icon: "profile", id: "student-profile", label: "账号设置", permission: "student:read" },
];

export const coachNavigation: NavItem[] = [
  { group: "工作", href: "/coach-workspace", icon: "dashboard", id: "coach-home", label: "今日工作", permission: "coach:work" },
  { group: "履约", href: "/coach-workspace/bookings", icon: "calendar", id: "coach-bookings", label: "预约管理", permission: "coach:work" },
  { group: "履约", href: "/coach-workspace/schedule", icon: "schedule", id: "coach-schedule", label: "排期与场馆", permission: "coach:work" },
  { group: "沟通", href: "/coach-workspace/messages", icon: "message", id: "coach-messages", label: "学员消息", permission: "coach:work" },
  { group: "经营", href: "/coach-workspace/courses", icon: "course", id: "coach-courses", label: "课程记录", permission: "coach:work" },
  { group: "经营", href: "/coach-workspace/payments", icon: "payment", id: "coach-payments", label: "线下收款", permission: "coach:work" },
  { group: "设置", href: "/coach-workspace/credentials", icon: "credential", id: "coach-credentials", label: "资质与资料", permission: "coach:work" },
];

export const opsNavigation: NavItem[] = [
  { group: "概览", href: "/ops", icon: "dashboard", id: "ops-home", label: "运营概览", permission: "ops:manage" },
  { group: "业务运营", href: "/ops/matching", icon: "matching", id: "ops-matching", label: "匹配中心", permission: "ops:manage" },
  { group: "业务运营", href: "/ops/bookings", icon: "calendar", id: "ops-bookings", label: "预约履约", permission: "ops:manage" },
  { group: "教练与风控", href: "/ops/coaches", icon: "coaches", id: "ops-coaches", label: "教练管理", permission: "ops:manage" },
  { group: "用户服务", href: "/ops/users", icon: "users", id: "ops-users", label: "学员服务", permission: "ops:manage" },
  { group: "平台管理", href: "/ops/content", icon: "content", id: "ops-content", label: "内容与协议", permission: "ops:manage" },
  { group: "平台管理", href: "/ops/releases", icon: "release", id: "ops-releases", label: "版本发布", permission: "release:read" },
];

export const coaches: CoachProfile[] = coachCatalog.map((coach) => ({
  ...coach,
  image: coach.media.image,
}));

export function mapMobileCoachToWeb(coach: MobileCoach): CoachProfile {
  const image = coach.cardUrl || coach.avatarUrl || coach.heroUrl || "/images/demo-athletics.webp";
  return {
    audience: coach.audience,
    availability: [],
    bio: coach.note,
    bookable: coach.bookable === true,
    canConsult: coach.canConsult !== false && coach.profileKind !== "demo",
    city: "北京",
    credentials: coach.proof.filter((item) => !["演示资料", "不可预约"].includes(item)),
    district: coach.district || "北京",
    experience: coach.experienceYears || 0,
    goals: coach.goals,
    id: coach.id,
    image,
    isNew: coach.isNew === true,
    lessons: coach.lessons,
    media: {
      avatarUrl: coach.avatarUrl,
      cardUrl: coach.cardUrl,
      heroUrl: coach.heroUrl,
      image,
    },
    name: coach.name,
    nextSlot: coach.profileKind === "demo" ? "演示资料不可预约" : coach.bookable ? "已有真实时段" : "可约时段待发布",
    price: coach.price,
    profileCompleteness: coach.profileCompleteness || (coach.profileKind === "demo" ? "demo" : "partial"),
    profileKind: coach.profileKind || "real",
    rating: coach.rating,
    responseMinutes: coach.responseMinutes || 0,
    reviewCount: coach.reviewCount,
    sport: coach.sport,
    strengths: coach.strengths,
    title: coach.title,
    trialPrice: coach.trialPrice,
    venue: coach.profileKind === "demo" ? `${coach.district || "北京"} · 演示区域` : "服务场地待确认",
    verificationLabel: coach.verificationLabel || (coach.profileKind === "demo" ? "演示资料" : "资料待补充"),
  };
}

function publicApiHeaders() {
  const appKey = process.env.ZHUGUANG_PILOT_APP_KEY;
  return appKey ? { "x-device-id": "zhuguang-web-public", "x-zhuguang-app-key": appKey } : null;
}

export async function loadPublicCoaches(): Promise<CoachProfile[]> {
  const headers = publicApiHeaders();
  if (!headers) return coaches;
  const origin = (process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "");
  try {
    const response = await fetch(`${origin}/api/v1/coaches`, { cache: "no-store", headers, signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return coaches;
    const payload = await response.json() as { data?: MobileCoach[] };
    return payload.data?.map(mapMobileCoachToWeb) || coaches;
  } catch {
    return coaches;
  }
}

export async function loadPublicCoachById(id: number | string): Promise<CoachProfile | undefined> {
  const coachId = Number(id);
  const headers = publicApiHeaders();
  if (!Number.isInteger(coachId) || coachId <= 0) return undefined;
  if (!headers) return getCoachById(coachId);
  const origin = (process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "");
  try {
    const response = await fetch(`${origin}/api/v1/coaches/${coachId}`, { cache: "no-store", headers, signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return undefined;
    const payload = await response.json() as { data?: MobileCoach };
    return payload.data ? mapMobileCoachToWeb(payload.data) : undefined;
  } catch {
    return getCoachById(coachId);
  }
}

export function getCoachById(id: number | string): CoachProfile | undefined {
  return coaches.find((coach) => coach.id === Number(id));
}

export function getRouteArea(pathname: string): WebArea {
  if (pathname.startsWith("/student")) return "student";
  if (pathname.startsWith("/coach-workspace")) return "coach";
  if (pathname.startsWith("/ops")) return "ops";
  return "public";
}
