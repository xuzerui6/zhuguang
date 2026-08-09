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
  availableAreas: Array<Exclude<WebArea, "public">>;
  displayName: string;
  email: string | null;
  isPrivatePreview: boolean;
  permissions: Permission[];
};

export type CoachProfile = {
  audience: string[];
  availability: Array<{ day: string; periods: string[] }>;
  bio: string;
  credentials: string[];
  district: string;
  experience: number;
  goals: string[];
  id: number;
  image: string;
  lessons: number;
  name: string;
  nextSlot: string;
  price: number;
  rating: number;
  reviewCount: number;
  sport: string;
  strengths: string[];
  title: string;
  trialPrice: number;
  venue: string;
};

export const featureFlags = {
  r2Updates: false,
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

export const coaches: CoachProfile[] = [
  {
    audience: ["青少年", "成人进阶"],
    availability: [
      { day: "周二", periods: ["18:00", "19:30"] },
      { day: "周四", periods: ["18:00"] },
      { day: "周六", periods: ["10:00", "14:00"] },
      { day: "周日", periods: ["09:00", "15:30"] },
    ],
    bio: "注重脚步节奏、击球选择和比赛意识，用可复盘的训练记录帮助学员建立稳定动作。",
    credentials: ["国家一级运动员", "羽毛球教练员证", "急救培训记录"],
    district: "朝阳区",
    experience: 10,
    goals: ["专项提升", "比赛备战", "兴趣培养"],
    id: 1,
    image: "/images/coach-zhouming.webp",
    lessons: 386,
    name: "周明",
    nextSlot: "明天 08:00",
    price: 280,
    rating: 4.9,
    reviewCount: 128,
    sport: "羽毛球",
    strengths: ["步伐与移动", "单打战术", "青少年竞赛"],
    title: "国家一级运动员 · 10年教龄",
    trialPrice: 99,
    venue: "朝阳体育中心羽毛球馆",
  },
  {
    audience: ["青少年", "成人体能"],
    availability: [
      { day: "周一", periods: ["19:00"] },
      { day: "周三", periods: ["18:30", "20:00"] },
      { day: "周六", periods: ["09:30", "15:00"] },
    ],
    bio: "把专项技术与体能训练结合，关注动作质量和水中安全，适合需要建立长期训练习惯的学员。",
    credentials: ["省队退役运动员", "游泳社会体育指导员", "救生员证"],
    district: "海淀区",
    experience: 8,
    goals: ["体能强化", "技术纠正", "中考体育"],
    id: 2,
    image: "/images/coach-linyue.webp",
    lessons: 294,
    name: "林悦",
    nextSlot: "明天 09:00",
    price: 260,
    rating: 4.8,
    reviewCount: 96,
    sport: "游泳",
    strengths: ["自由泳技术", "水中安全", "体能强化"],
    title: "省队退役运动员 · 8年教龄",
    trialPrice: 99,
    venue: "海淀全民健身中心游泳馆",
  },
  {
    audience: ["青少年", "成人基础"],
    availability: [
      { day: "周三", periods: ["19:00"] },
      { day: "周五", periods: ["18:00", "19:30"] },
      { day: "周日", periods: ["10:00", "14:30"] },
    ],
    bio: "强调基本功、空间判断与团队配合，以阶段测试和比赛片段复盘推进训练。",
    credentials: ["CBA青年队经历", "篮球教练员证", "青少年体育培训证明"],
    district: "东城区",
    experience: 9,
    goals: ["兴趣培养", "专项提升", "校队备战"],
    id: 3,
    image: "/images/coach-zhaolei.webp",
    lessons: 321,
    name: "赵磊",
    nextSlot: "周六 10:00",
    price: 300,
    rating: 4.8,
    reviewCount: 87,
    sport: "篮球",
    strengths: ["基本功", "比赛阅读", "团队训练"],
    title: "职业梯队经历 · 9年教龄",
    trialPrice: 129,
    venue: "东城体育馆篮球训练中心",
  },
  {
    audience: ["儿童", "青少年"],
    availability: [
      { day: "周二", periods: ["17:30"] },
      { day: "周四", periods: ["17:30", "19:00"] },
      { day: "周六", periods: ["09:00", "13:30"] },
    ],
    bio: "从身体协调、动作模式和训练兴趣入手，让孩子在清晰边界和正向反馈中持续进步。",
    credentials: ["国家健将级运动员", "儿童体适能教练认证", "急救培训记录"],
    district: "丰台区",
    experience: 7,
    goals: ["体能强化", "兴趣培养", "动作发展"],
    id: 4,
    image: "/images/coach-chenwei.webp",
    lessons: 248,
    name: "陈玮",
    nextSlot: "周六 09:00",
    price: 240,
    rating: 4.7,
    reviewCount: 74,
    sport: "体能",
    strengths: ["动作发展", "协调训练", "青少年体能"],
    title: "国家健将级运动员 · 7年教龄",
    trialPrice: 89,
    venue: "丰台青少年运动中心",
  },
];

export const pilotBookings = [
  { id: "ZG240801", learner: "徐子轩", sport: "羽毛球", schedule: "今天 18:30–20:00", venue: "朝阳体育中心", price: 280, status: "待确认", tone: "amber" },
  { id: "ZG240798", learner: "王思涵", sport: "羽毛球", schedule: "明天 10:00–11:30", venue: "朝阳体育中心", price: 280, status: "已确认", tone: "green" },
  { id: "ZG240793", learner: "李泽宇", sport: "羽毛球", schedule: "周六 14:00–15:30", venue: "望京运动中心", price: 320, status: "申请改期", tone: "blue" },
  { id: "ZG240786", learner: "陈一诺", sport: "羽毛球", schedule: "周日 09:00–10:30", venue: "朝阳体育中心", price: 280, status: "已确认", tone: "green" },
] as const;

export const matchingRows = [
  { id: "M-1038", learner: "李明轩", age: 12, goal: "提升比赛成绩", sport: "羽毛球", district: "朝阳区", coach: "周明", score: 92, next: "待确认", updated: "10:24" },
  { id: "M-1037", learner: "王思涵", age: 14, goal: "中考体育提分", sport: "田径", district: "海淀区", coach: "陈伟", score: 88, next: "创建试课", updated: "09:58" },
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

