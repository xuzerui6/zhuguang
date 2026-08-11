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

/**
 * Production-safe fallback catalog. The API remains the source of truth; this
 * record keeps the public site and an offline app launch useful when it is down.
 */
export const coachCatalog: CoachPublicProfile[] = [
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
