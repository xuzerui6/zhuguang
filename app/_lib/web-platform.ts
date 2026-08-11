import { coachCatalog, type CoachPublicProfile } from "../../shared/coach-catalog";

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
  authorizationSource: "allowlist" | "anonymous" | "siwc";
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
  { badge: 2, href: "/student/messages", icon: "message", id: "student-messages", label: "消息", permission: "student:read" },
  { href: "/student/training", icon: "training", id: "student-training", label: "训练档案", permission: "student:read" },
  { href: "/student/profile", icon: "profile", id: "student-profile", label: "我的", permission: "student:read" },
];

export const coachNavigation: NavItem[] = [
  { group: "工作", href: "/coach-workspace", icon: "dashboard", id: "coach-home", label: "今日工作", permission: "coach:work" },
  { badge: 3, group: "履约", href: "/coach-workspace/bookings", icon: "calendar", id: "coach-bookings", label: "预约管理", permission: "coach:work" },
  { group: "履约", href: "/coach-workspace/schedule", icon: "schedule", id: "coach-schedule", label: "排期与场馆", permission: "coach:work" },
  { badge: 2, group: "沟通", href: "/coach-workspace/messages", icon: "message", id: "coach-messages", label: "学员消息", permission: "coach:work" },
  { group: "经营", href: "/coach-workspace/courses", icon: "course", id: "coach-courses", label: "课程记录", permission: "coach:work" },
  { group: "经营", href: "/coach-workspace/payments", icon: "payment", id: "coach-payments", label: "线下收款", permission: "coach:work" },
  { group: "设置", href: "/coach-workspace/credentials", icon: "credential", id: "coach-credentials", label: "资质与资料", permission: "coach:work" },
];

export const opsNavigation: NavItem[] = [
  { group: "概览", href: "/ops", icon: "dashboard", id: "ops-home", label: "工作台", permission: "ops:manage" },
  { badge: 24, group: "业务运营", href: "/ops/matching", icon: "matching", id: "ops-matching", label: "匹配中心", permission: "ops:manage" },
  { badge: 9, group: "业务运营", href: "/ops/bookings", icon: "calendar", id: "ops-bookings", label: "预约履约", permission: "ops:manage" },
  { group: "教练与风控", href: "/ops/coaches", icon: "coaches", id: "ops-coaches", label: "教练管理", permission: "ops:manage" },
  { badge: 7, group: "教练与风控", href: "/ops/users", icon: "users", id: "ops-users", label: "学员服务", permission: "ops:manage" },
  { group: "平台管理", href: "/ops/content", icon: "content", id: "ops-content", label: "内容与协议", permission: "ops:manage" },
  { group: "平台管理", href: "/ops/releases", icon: "release", id: "ops-releases", label: "版本记录", permission: "release:read" },
];

export const coaches: CoachProfile[] = coachCatalog.map((coach) => ({
  ...coach,
  image: coach.media.image,
}));

export const pilotBookings = [
  { id: "ZG240801", learner: "徐子轩", sport: "羽毛球", schedule: "今天 18:30–20:00", venue: "朝阳体育中心", price: 280, status: "待确认", tone: "amber" },
  { id: "ZG240798", learner: "王思涵", sport: "羽毛球", schedule: "明天 10:00–11:30", venue: "朝阳体育中心", price: 280, status: "已确认", tone: "green" },
  { id: "ZG240793", learner: "李泽宇", sport: "羽毛球", schedule: "周六 14:00–15:30", venue: "望京运动中心", price: 320, status: "申请改期", tone: "blue" },
  { id: "ZG240786", learner: "陈一诺", sport: "羽毛球", schedule: "周日 09:00–10:30", venue: "朝阳体育中心", price: 280, status: "已确认", tone: "green" },
] as const;

export const matchingRows = [
  { id: "M-1038", learner: "李明轩", age: 12, goal: "提升比赛成绩", sport: "羽毛球", district: "朝阳区", coach: "周明", score: 92, next: "待确认", updated: "10:24" },
  { id: "M-1037", learner: "王思涵", age: 14, goal: "中考体育", sport: "田径", district: "通州区", coach: "徐泽瑞", score: 75, next: "待发布时段", updated: "09:58" },
  { id: "M-1036", learner: "张子睿", age: 10, goal: "兴趣培养", sport: "篮球", district: "朝阳区", coach: "刘洋", score: 85, next: "创建试课", updated: "09:12" },
  { id: "M-1035", learner: "陈一诺", age: 13, goal: "提高专项技术", sport: "游泳", district: "丰台区", coach: "赵雪", score: 81, next: "待确认", updated: "昨天 18:45" },
  { id: "M-1034", learner: "刘梓豪", age: 11, goal: "体能增强", sport: "足球", district: "昌平区", coach: "孙磊", score: 78, next: "待匹配", updated: "昨天 17:30" },
] as const;

export function getCoachById(id: number | string): CoachProfile | undefined {
  return coaches.find((coach) => coach.id === Number(id));
}

export function getRouteArea(pathname: string): WebArea {
  if (pathname.startsWith("/student")) return "student";
  if (pathname.startsWith("/coach-workspace")) return "coach";
  if (pathname.startsWith("/ops")) return "ops";
  return "public";
}
