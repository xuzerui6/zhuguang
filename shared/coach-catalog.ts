export type CoachAvailability = {
  day: string;
  periods: string[];
};

export type CoachMedia = {
  avatarUrl: string;
  heroUrl: string;
  image: string;
};

export type CoachVerificationLabel = "平台试点教练" | "资料已核验";

export type CoachPublicProfile = {
  audience: string[];
  availability: CoachAvailability[];
  bio: string;
  bookable: boolean;
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
  price: number;
  rating: number;
  responseMinutes: number;
  reviewCount: number;
  sport: string;
  strengths: string[];
  title: string;
  trialPrice: number;
  venue: string;
  verificationLabel: CoachVerificationLabel;
};

export const coachCatalog: CoachPublicProfile[] = [
  {
    audience: ["青少年", "成人进阶"],
    availability: [
      { day: "周二", periods: ["18:00", "19:30"] },
      { day: "周四", periods: ["18:00"] },
      { day: "周六", periods: ["10:00", "14:00"] },
      { day: "周日", periods: ["09:00", "15:30"] },
    ],
    bio: "注重脚步节奏、击球选择和比赛意识，用可复盘的训练记录帮助学员建立稳定动作。",
    bookable: true,
    city: "北京",
    credentials: ["国家一级运动员", "羽毛球教练员证", "急救培训记录"],
    district: "朝阳区",
    experience: 10,
    goals: ["专项提升", "比赛备战", "兴趣培养"],
    id: 1,
    isNew: false,
    lessons: 386,
    media: { avatarUrl: "/images/coach-zhouming.webp", heroUrl: "/images/coach-zhouming.webp", image: "/images/coach-zhouming.webp" },
    name: "周明",
    nextSlot: "明天 08:00",
    price: 280,
    rating: 4.9,
    responseMinutes: 9,
    reviewCount: 128,
    sport: "羽毛球",
    strengths: ["步伐与移动", "单打战术", "青少年竞赛"],
    title: "国家一级运动员 · 10年教龄",
    trialPrice: 99,
    venue: "朝阳体育中心羽毛球馆",
    verificationLabel: "资料已核验",
  },
  {
    audience: ["青少年", "成人体能"],
    availability: [
      { day: "周一", periods: ["19:00"] },
      { day: "周三", periods: ["18:30", "20:00"] },
      { day: "周六", periods: ["09:30", "15:00"] },
    ],
    bio: "把专项技术与体能训练结合，关注动作质量和水中安全，适合需要建立长期训练习惯的学员。",
    bookable: true,
    city: "北京",
    credentials: ["省队退役运动员", "游泳社会体育指导员", "救生员证"],
    district: "海淀区",
    experience: 8,
    goals: ["体能强化", "技术纠正", "中考体育"],
    id: 2,
    isNew: false,
    lessons: 294,
    media: { avatarUrl: "/images/coach-linyue.webp", heroUrl: "/images/coach-linyue.webp", image: "/images/coach-linyue.webp" },
    name: "林悦",
    nextSlot: "明天 09:00",
    price: 260,
    rating: 4.8,
    responseMinutes: 13,
    reviewCount: 96,
    sport: "游泳",
    strengths: ["自由泳技术", "水中安全", "体能强化"],
    title: "省队退役运动员 · 8年教龄",
    trialPrice: 99,
    venue: "海淀全民健身中心游泳馆",
    verificationLabel: "资料已核验",
  },
  {
    audience: ["青少年", "成人基础"],
    availability: [
      { day: "周三", periods: ["19:00"] },
      { day: "周五", periods: ["18:00", "19:30"] },
      { day: "周日", periods: ["10:00", "14:30"] },
    ],
    bio: "强调基本功、空间判断与团队配合，以阶段测试和比赛片段复盘推进训练。",
    bookable: true,
    city: "北京",
    credentials: ["CBA青年队经历", "篮球教练员证", "青少年体育培训证明"],
    district: "东城区",
    experience: 9,
    goals: ["兴趣培养", "专项提升", "校队备战"],
    id: 3,
    isNew: false,
    lessons: 321,
    media: { avatarUrl: "/images/coach-zhaolei.webp", heroUrl: "/images/coach-zhaolei.webp", image: "/images/coach-zhaolei.webp" },
    name: "赵磊",
    nextSlot: "周六 10:00",
    price: 300,
    rating: 4.8,
    responseMinutes: 17,
    reviewCount: 87,
    sport: "篮球",
    strengths: ["基本功", "比赛阅读", "团队训练"],
    title: "职业梯队经历 · 9年教龄",
    trialPrice: 129,
    venue: "东城体育馆篮球训练中心",
    verificationLabel: "资料已核验",
  },
  {
    audience: ["儿童", "青少年"],
    availability: [
      { day: "周二", periods: ["17:30"] },
      { day: "周四", periods: ["17:30", "19:00"] },
      { day: "周六", periods: ["09:00", "13:30"] },
    ],
    bio: "从身体协调、动作模式和训练兴趣入手，让孩子在清晰边界和正向反馈中持续进步。",
    bookable: true,
    city: "北京",
    credentials: ["国家健将级运动员", "儿童体适能教练认证", "急救培训记录"],
    district: "丰台区",
    experience: 7,
    goals: ["体能强化", "兴趣培养", "动作发展"],
    id: 4,
    isNew: false,
    lessons: 248,
    media: { avatarUrl: "/images/coach-chenwei.webp", heroUrl: "/images/coach-chenwei.webp", image: "/images/coach-chenwei.webp" },
    name: "陈玮",
    nextSlot: "周六 09:00",
    price: 240,
    rating: 4.7,
    responseMinutes: 21,
    reviewCount: 74,
    sport: "体能",
    strengths: ["动作发展", "协调训练", "青少年体能"],
    title: "国家健将级运动员 · 7年教龄",
    trialPrice: 89,
    venue: "丰台青少年运动中心",
    verificationLabel: "资料已核验",
  },
  {
    audience: ["青少年", "成人"],
    availability: [],
    bio: "面向青少年与成人提供田径基础、短跑动作、跑姿纠正和专项体能训练，服务区域为北京市通州区。",
    bookable: false,
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
      heroUrl: "/images/coach-xu-zerui-hero.webp",
      image: "/images/coach-xu-zerui-portrait.webp",
    },
    name: "徐泽瑞",
    nextSlot: "可约时段待发布",
    price: 240,
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
];

export function getCatalogCoach(id: number | string) {
  return coachCatalog.find((coach) => coach.id === Number(id));
}
