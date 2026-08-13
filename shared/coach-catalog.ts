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
  honors: string[];
  id: number;
  isNew: boolean;
  lessons: number;
  media: CoachMedia;
  motto: string;
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
    audience: ["青少年儿童", "成人"],
    availability: [],
    bio: "退役运动员，拥有2年执教经验，面向青少年儿童与成人提供体能提升及中小学体育中高考训练。",
    bookable: false,
    canConsult: true,
    city: "北京",
    credentials: ["国家级教练证书"],
    district: "通州区",
    experience: 2,
    goals: ["体能提升", "中小学体育中高考"],
    honors: ["北京市400米冠军", "北京市800米冠军", "全国中学生前八"],
    id: 5,
    isNew: true,
    lessons: 0,
    media: {
      avatarUrl: "/images/coach-xu-zerui-avatar.webp",
      cardUrl: "/images/coach-xu-zerui-portrait.webp",
      heroUrl: "/images/coach-xu-zerui-hero.webp",
      image: "/images/coach-xu-zerui-portrait.webp",
    },
    motto: "身体扛不住的时候换意志杀出重围",
    name: "徐泽瑞",
    nextSlot: "可约时段待发布",
    price: 240,
    profileCompleteness: "complete",
    profileKind: "real",
    rating: 0,
    responseMinutes: 0,
    reviewCount: 0,
    sport: "田径",
    strengths: ["体能提升", "中小学体育中高考"],
    title: "退役田径运动员 · 田径专项训练教练",
    trialPrice: 99,
    venue: "北京市通州区合作训练场",
    verificationLabel: "资料已核验",
  },
  {
    audience: ["青少年儿童", "成人"],
    availability: [],
    bio: "退役运动员，拥有1年执教经验，面向青少年儿童与成人提供跳远、跳高及各类田项训练。",
    bookable: false,
    canConsult: true,
    city: "北京",
    credentials: ["体适能教练"],
    district: "通州区",
    experience: 1,
    goals: ["跳远", "跳高", "各类田项"],
    honors: ["全国中学生第四", "北京市前三"],
    id: 6,
    isNew: true,
    lessons: 0,
    media: {
      avatarUrl: "/images/coach-zhang-zhanqi-avatar.webp",
      cardUrl: "/images/coach-zhang-zhanqi-card.webp",
      heroUrl: "/images/coach-zhang-zhanqi-hero.webp",
      image: "/images/coach-zhang-zhanqi-card.webp",
    },
    motto: "专业的事情交给专业的人",
    name: "张展祁",
    nextSlot: "可约时段待发布",
    price: 240,
    profileCompleteness: "complete",
    profileKind: "real",
    rating: 0,
    responseMinutes: 0,
    reviewCount: 0,
    sport: "田径",
    strengths: ["跳远", "跳高", "田赛专项"],
    title: "退役运动员 · 田赛专项训练教练",
    trialPrice: 99,
    venue: "北京市通州区合作训练场",
    verificationLabel: "资料已核验",
  },
  {
    audience: ["青少年儿童", "成人"],
    availability: [],
    bio: "退役运动员，拥有3年执教经验，面向青少年儿童与成人提供体育中高考、体能提升和专项训练。",
    bookable: false,
    canConsult: true,
    city: "北京",
    credentials: ["体育教师证书", "体适能证书", "国家级教练员证书"],
    district: "通州区",
    experience: 3,
    goals: ["体育中高考", "体能提升", "专项训练"],
    honors: ["北京市400米跨栏冠军", "北京市400米跨栏纪录保持者"],
    id: 7,
    isNew: true,
    lessons: 0,
    media: {
      avatarUrl: "/images/coach-hao-jianzhuang-avatar.webp",
      cardUrl: "/images/coach-hao-jianzhuang-card.webp",
      heroUrl: "/images/coach-hao-jianzhuang-hero.webp",
      image: "/images/coach-hao-jianzhuang-card.webp",
    },
    motto: "没有带不出的学生，只有不合格的教练",
    name: "郝健壮",
    nextSlot: "可约时段待发布",
    price: 240,
    profileCompleteness: "complete",
    profileKind: "real",
    rating: 0,
    responseMinutes: 0,
    reviewCount: 0,
    sport: "田径",
    strengths: ["体育中高考", "体能提升", "专项训练"],
    title: "退役运动员 · 田径专项训练教练",
    trialPrice: 99,
    venue: "北京市通州区合作训练场",
    verificationLabel: "资料已核验",
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
  honors: [],
  id,
  isNew: true,
  lessons: 0,
  media: {
    avatarUrl: `/images/demo-${media}.webp`,
    cardUrl: `/images/demo-${media}.webp`,
    heroUrl: `/images/demo-${media}.webp`,
    image: `/images/demo-${media}.webp`,
  },
  motto: "",
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
