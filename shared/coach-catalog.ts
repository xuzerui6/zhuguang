export const BEIJING_DISTRICTS = [
  "东城区",
  "西城区",
  "朝阳区",
  "丰台区",
  "石景山区",
  "海淀区",
  "门头沟区",
  "房山区",
  "通州区",
  "顺义区",
  "昌平区",
  "大兴区",
  "怀柔区",
  "平谷区",
  "密云区",
  "延庆区",
] as const;

export const SPORT_OPTIONS = ["田径", "羽毛球", "游泳", "网球", "篮球", "体能"] as const;

export type CoachAvailability = {
  day: string;
  periods: string[];
};

export type CoachMedia = {
  avatarUrl?: string;
  cardUrl?: string;
  heroUrl?: string;
  image: string;
};

export type CoachVerificationLabel = "平台试点教练" | "资料已核验" | "资料待补充" | "演示资料";
export type CoachProfileKind = "real" | "demo";
export type CoachProfileCompleteness = "complete" | "partial" | "demo";

export type CoachPublicProfile = {
  audience: string[];
  availability: CoachAvailability[];
  bio: string;
  bookable: boolean;
  canConsult: boolean;
  city: "北京";
  credentials: string[];
  district: string;
  experience: number;
  goals: string[];
  id: number;
  isNew: boolean;
  lessons: number;
  media: CoachMedia;
  name: string;
  nextSlot: string;
  price?: number;
  profileCompleteness: CoachProfileCompleteness;
  profileKind: CoachProfileKind;
  rating: number;
  responseMinutes: number;
  reviewCount: number;
  sport: string;
  strengths: string[];
  title: string;
  trialPrice?: number;
  venue: string;
  verificationLabel: CoachVerificationLabel;
};

const realCoaches: CoachPublicProfile[] = [
  {
    audience: ["青少年", "成人"],
    availability: [],
    bio: "面向青少年与成人提供田径基础、短跑动作、跑姿纠正和专项体能训练，服务区域为北京市通州区。",
    bookable: false,
    canConsult: true,
    city: "北京",
    credentials: [],
    district: "通州区",
    experience: 0,
    goals: ["中考体育", "短跑专项", "跑姿纠正", "专项体能"],
    id: 5,
    isNew: true,
    lessons: 0,
    media: {
      avatarUrl: "/images/coach-xu-zerui-avatar.webp",
      cardUrl: "/images/coach-xu-zerui-portrait.webp",
      heroUrl: "/images/coach-xu-zerui-hero.webp",
      image: "/images/coach-xu-zerui-portrait.webp",
    },
    name: "徐泽瑞",
    nextSlot: "可约时段待发布",
    price: 240,
    profileCompleteness: "partial",
    profileKind: "real",
    rating: 0,
    responseMinutes: 0,
    reviewCount: 0,
    sport: "田径",
    strengths: ["短跑技术", "起跑与加速", "跑姿纠正", "专项体能"],
    title: "退役田径运动员 · 田径专项训练教练",
    trialPrice: 99,
    venue: "通州区合作训练场",
    verificationLabel: "平台试点教练",
  },
  {
    audience: [],
    availability: [],
    bio: "北京通州区田径教练。当前仅展示已确认的姓名、项目与服务区域，其他资料由平台核验后补充。",
    bookable: false,
    canConsult: true,
    city: "北京",
    credentials: [],
    district: "通州区",
    experience: 0,
    goals: ["田径训练"],
    id: 6,
    isNew: true,
    lessons: 0,
    media: {
      avatarUrl: "/images/coach-zhang-zhanqi-avatar.webp",
      cardUrl: "/images/coach-zhang-zhanqi-card.webp",
      heroUrl: "/images/coach-zhang-zhanqi-hero.webp",
      image: "/images/coach-zhang-zhanqi-card.webp",
    },
    name: "张展祁",
    nextSlot: "资料与时段待发布",
    profileCompleteness: "partial",
    profileKind: "real",
    rating: 0,
    responseMinutes: 0,
    reviewCount: 0,
    sport: "田径",
    strengths: ["田径训练"],
    title: "田径训练教练",
    venue: "北京市通州区",
    verificationLabel: "资料待补充",
  },
  {
    audience: [],
    availability: [],
    bio: "北京通州区田径教练。当前仅展示已确认的姓名、项目与服务区域，其他资料由平台核验后补充。",
    bookable: false,
    canConsult: true,
    city: "北京",
    credentials: [],
    district: "通州区",
    experience: 0,
    goals: ["田径训练"],
    id: 7,
    isNew: true,
    lessons: 0,
    media: {
      avatarUrl: "/images/coach-hao-jianzhuang-avatar.webp",
      cardUrl: "/images/coach-hao-jianzhuang-card.webp",
      heroUrl: "/images/coach-hao-jianzhuang-hero.webp",
      image: "/images/coach-hao-jianzhuang-card.webp",
    },
    name: "郝健壮",
    nextSlot: "资料与时段待发布",
    profileCompleteness: "partial",
    profileKind: "real",
    rating: 0,
    responseMinutes: 0,
    reviewCount: 0,
    sport: "田径",
    strengths: ["田径训练"],
    title: "田径训练教练",
    venue: "北京市通州区",
    verificationLabel: "资料待补充",
  },
];

const demoSpecs = [
  [1, "A01", "羽毛球", "朝阳区", "badminton"],
  [2, "A02", "游泳", "海淀区", "swimming"],
  [3, "A03", "篮球", "东城区", "basketball"],
  [4, "A04", "体能", "丰台区", "conditioning"],
  [8, "A05", "羽毛球", "顺义区", "badminton"],
  [9, "A06", "羽毛球", "怀柔区", "badminton"],
  [10, "A07", "游泳", "昌平区", "swimming"],
  [11, "A08", "游泳", "密云区", "swimming"],
  [12, "A09", "网球", "西城区", "tennis"],
  [13, "A10", "网球", "石景山区", "tennis"],
  [14, "A11", "网球", "平谷区", "tennis"],
  [15, "A12", "篮球", "大兴区", "basketball"],
  [16, "A13", "篮球", "房山区", "basketball"],
  [17, "A14", "体能", "门头沟区", "conditioning"],
  [18, "A15", "体能", "延庆区", "conditioning"],
] as const;

const demoCoaches: CoachPublicProfile[] = demoSpecs.map(([id, code, sport, district, media]) => ({
  audience: [],
  availability: [],
  bio: "用于验证项目与区域筛选、列表布局和运营上下线流程的演示资料，不代表真实教练。",
  bookable: false,
  canConsult: false,
  city: "北京",
  credentials: [],
  district,
  experience: 0,
  goals: [`${sport}训练`],
  id,
  isNew: true,
  lessons: 0,
  media: {
    avatarUrl: `/images/demo-${media}.webp`,
    cardUrl: `/images/demo-${media}.webp`,
    heroUrl: `/images/demo-${media}.webp`,
    image: `/images/demo-${media}.webp`,
  },
  name: `演示教练 ${code}`,
  nextSlot: "演示资料不可预约",
  profileCompleteness: "demo",
  profileKind: "demo",
  rating: 0,
  responseMinutes: 0,
  reviewCount: 0,
  sport,
  strengths: [`${sport}训练场景`],
  title: `${district}${sport}演示资料`,
  venue: `${district} · 演示区域`,
  verificationLabel: "演示资料",
}));

/** Offline-safe catalog. Production discovery is always loaded from D1. */
export const coachCatalog: CoachPublicProfile[] = [...realCoaches, ...demoCoaches];

export function getCatalogCoach(id: number | string) {
  return coachCatalog.find((coach) => coach.id === Number(id));
}
