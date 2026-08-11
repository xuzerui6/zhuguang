import type {
  BookingSlot,
  CoachVenue,
  LearnerProfile,
  MobileBooking,
  MobileCoach,
  MobileConversation,
  MobileNotification,
} from "./types";
import { coachCatalog } from "../../shared/coach-catalog";

const coachAccents = ["#087A50", "#315F93", "#B5583B", "#7A6231", "#0B6E68"];

export const demoCoaches: MobileCoach[] = coachCatalog.map((coach, index) => ({
  accent: coachAccents[index] ?? coachAccents[0],
  audience: coach.audience,
  availability: coach.availability.flatMap(({ day, periods }) => periods.map((period) => `${day} ${period}`)),
  avatarUrl: coach.media.avatarUrl,
  bookable: coach.bookable,
  city: coach.city,
  district: coach.district,
  distanceKm: coach.id === 5 ? undefined : 3.2 + index * 1.1,
  experienceYears: coach.experience,
  goals: coach.goals,
  heroUrl: coach.media.heroUrl,
  id: coach.id,
  isNew: coach.isNew,
  lessons: coach.lessons,
  level: coach.title.split(" · ")[0],
  name: coach.name,
  note: coach.bio,
  price: coach.price,
  proof: coach.credentials.length ? [...coach.credentials, "服务保障已开通"] : ["平台试点教练", "服务区域已确认"],
  rating: coach.rating,
  responseMinutes: coach.responseMinutes || undefined,
  reviewCount: coach.reviewCount,
  sport: coach.sport,
  strengths: coach.strengths,
  title: coach.title,
  trialPrice: coach.trialPrice,
  verificationLabel: coach.verificationLabel,
  verified: true,
}));

export const venues: CoachVenue[] = [
  { id: "venue-chaoyang-badminton", coachId: 1, name: "朝阳体育中心羽毛球馆", address: "朝阳区安定路 1 号", district: "朝阳区" },
  { id: "venue-haidian-badminton", coachId: 2, name: "海淀全民健身中心羽毛球馆", address: "海淀区颐和园路 12 号", district: "海淀区" },
  { id: "venue-chaoyang-tennis", coachId: 3, name: "朝阳公园网球中心", address: "朝阳区农展南路 1 号", district: "朝阳区" },
  { id: "venue-dongcheng-basketball", coachId: 4, name: "东单体育中心篮球馆", address: "东城区崇文门内大街 108 号", district: "东城区" },
  { id: "venue-tongzhou-track", coachId: 5, name: "通州区合作训练场", address: "通州区 · 具体场地预约后确认", district: "通州区" },
];

export const defaultLearner: LearnerProfile = {
  id: "learner-xu-zixuan",
  name: "徐子轩",
  relation: "child",
  gender: "male",
  age: 12,
  sport: "羽毛球",
  level: "进阶",
  goal: "专项提升 · 加强体能",
  guardianName: "徐泽瑞",
  guardianPhone: "13800005678",
};

export const demoNotifications: MobileNotification[] = [
  { id: "notification-message", type: "coach_message", title: "周明教练回复了你的咨询", body: "方便确认一下学员目前的训练频率吗？", createdAt: "刚刚", read: false },
  { id: "notification-audit", type: "credential", title: "教练履历复核完成", body: "你收藏的林悦教练已完成最新资料复核。", createdAt: "昨天", read: true },
  { id: "notification-email", type: "service", title: "预约进度会同步到账号", body: "验证邮箱后，可在逐光查看教练确认和改期通知。", createdAt: "2 天前", read: true },
];

function dateParts(offset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    dateLabel: offset === 0 ? "今天" : offset === 1 ? "明天" : weekday,
  };
}

export function createDemoSlots(coachId: number): BookingSlot[] {
  if (demoCoaches.find((coach) => coach.id === coachId)?.bookable === false) return [];
  const times = ["08:00", "09:30", "11:00", "14:00", "15:30", "18:00"];
  return Array.from({ length: 7 }, (_, dateIndex) => {
    const parts = dateParts(dateIndex);
    return times.map((time, timeIndex) => ({
      id: `slot-${coachId}-${parts.date}-${time.replace(":", "")}`,
      coachId,
      date: parts.date,
      dateLabel: parts.dateLabel,
      time,
      endTime: time === "09:30" ? "11:00" : `${String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, "0")}:${time.slice(3)}`,
      available:
        new Date(`${parts.date}T${time}:00+08:00`).getTime() > Date.now() + 15 * 60_000
        && (dateIndex + timeIndex + coachId) % 4 !== 0,
    }));
  }).flat();
}

export function createDemoBooking(): MobileBooking {
  const parts = dateParts(1);
  return {
    id: "booking-demo-confirmed",
    coachId: 2,
    learnerId: defaultLearner.id,
    venueId: "venue-haidian-badminton",
    slotId: `slot-2-${parts.date}-1100`,
    date: parts.date,
    dateLabel: parts.dateLabel,
    time: "11:00",
    endTime: "12:30",
    status: "confirmed",
    submittedAt: "昨天 20:15",
    feeFen: 9900,
    paymentStatus: "offline_unpaid",
    note: "希望重点改善反手高远球稳定性。",
  };
}

export function createDemoConversations(): MobileConversation[] {
  return [
    {
      id: "conversation-coach-1",
      coachId: 1,
      title: "周明教练",
      subtitle: "您好，您的试课申请我已收到，方便确认一下时间吗？",
      kind: "coach",
      unreadCount: 2,
      updatedAt: "20:38",
      messages: [
        { id: "message-1", conversationId: "conversation-coach-1", sender: "coach", body: "您好，您的试课申请我已收到。", createdAt: "20:36", read: false },
        { id: "message-2", conversationId: "conversation-coach-1", sender: "coach", body: "方便确认一下学员目前的训练频率吗？", createdAt: "20:38", read: false },
      ],
    },
    {
      id: "conversation-system",
      title: "逐光服务助手",
      subtitle: "预约申请已提交，教练将在 24 小时内确认。",
      kind: "system",
      unreadCount: 1,
      updatedAt: "20:35",
      messages: [
        { id: "message-3", conversationId: "conversation-system", sender: "system", body: "预约申请已提交，教练将在 24 小时内确认。", createdAt: "20:35", read: false },
      ],
    },
    {
      id: "conversation-venue",
      title: "朝阳体育中心羽毛球馆",
      subtitle: "温馨提醒：明天有中级赛事活动，建议提前到场热身。",
      kind: "venue",
      unreadCount: 0,
      updatedAt: "昨天",
      messages: [
        { id: "message-4", conversationId: "conversation-venue", sender: "venue", body: "温馨提醒：明天有中级赛事活动，建议提前到场热身。", createdAt: "昨天", read: true },
      ],
    },
  ];
}
