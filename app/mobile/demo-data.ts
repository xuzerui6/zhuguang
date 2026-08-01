import type {
  BookingSlot,
  CoachVenue,
  LearnerProfile,
  MobileBooking,
  MobileCoach,
  MobileConversation,
  MobileNotification,
} from "./types";

export const demoCoaches: MobileCoach[] = [
  {
    id: 1,
    name: "周明",
    sport: "羽毛球",
    city: "北京",
    district: "朝阳区",
    level: "国家队退役",
    title: "青少年专项提升教练",
    price: 520,
    rating: 4.92,
    lessons: 386,
    reviewCount: 128,
    audience: ["青少年", "亲子"],
    goals: ["专项提升", "比赛备战", "动作纠错"],
    strengths: ["基础技术提升", "步伐与移动", "比赛战术", "体能训练"],
    proof: ["国家队退役认证", "身份与履历已核验", "服务保障已开通"],
    availability: ["今天 19:30", "周四 18:00", "周六 10:00"],
    note: "前国家队主力，10 年专业训练与比赛经验。教学耐心细致，擅长帮助青少年建立稳定动作体系。",
    accent: "#087A50",
    distanceKm: 3.2,
    experienceYears: 10,
    responseMinutes: 9,
    verified: true,
  },
  {
    id: 2,
    name: "林悦",
    sport: "羽毛球",
    city: "北京",
    district: "海淀区",
    level: "省队退役",
    title: "青少年启蒙与动作效率教练",
    price: 420,
    rating: 4.88,
    lessons: 264,
    reviewCount: 71,
    audience: ["儿童", "青少年"],
    goals: ["兴趣入门", "专项提升", "动作纠错"],
    strengths: ["兴趣启蒙", "动作效率", "步伐基础", "家长反馈"],
    proof: ["省队退役认证", "儿童课程满意度 97%", "身份与履历已核验"],
    availability: ["明天 17:30", "周六 11:00", "周日 15:00"],
    note: "8 年一线教学经验，课程节奏温和但标准清晰，适合零基础与需要重建动作的学员。",
    accent: "#315F93",
    distanceKm: 5.6,
    experienceYears: 8,
    responseMinutes: 18,
    verified: true,
  },
  {
    id: 3,
    name: "王浩然",
    sport: "网球",
    city: "北京",
    district: "朝阳区",
    level: "职业队退役",
    title: "实战进阶与赛前节奏教练",
    price: 680,
    rating: 4.95,
    lessons: 441,
    reviewCount: 128,
    audience: ["成人", "青少年"],
    goals: ["比赛备战", "专项提升"],
    strengths: ["正反手衔接", "发抢体系", "落点变化", "赛前模拟"],
    proof: ["职业队履历已核验", "31 位赛事学员", "服务保障已开通"],
    availability: ["周一 20:00", "周五 19:00", "周日 11:00"],
    note: "训练围绕实战得分方式设计，适合有基础、希望突破技术瓶颈的学员。",
    accent: "#B5583B",
    distanceKm: 7.1,
    experienceYears: 12,
    responseMinutes: 12,
    verified: true,
  },
  {
    id: 4,
    name: "陈思雨",
    sport: "篮球",
    city: "北京",
    district: "东城区",
    level: "前职业青年队",
    title: "控运与投篮节奏教练",
    price: 460,
    rating: 4.88,
    lessons: 318,
    reviewCount: 84,
    audience: ["青少年", "成人"],
    goals: ["专项提升", "校队选拔", "体能改善"],
    strengths: ["控运节奏", "投篮稳定性", "对抗选择", "校队备战"],
    proof: ["青年队经历已核验", "18 个校队选拔案例", "服务保障已开通"],
    availability: ["周二 18:30", "周四 20:00", "周六 14:00"],
    note: "强调动作细节和对抗中的判断，适合从兴趣训练进入系统训练的学员。",
    accent: "#7A6231",
    distanceKm: 4.8,
    experienceYears: 9,
    responseMinutes: 15,
    verified: true,
  },
];

export const venues: CoachVenue[] = [
  { id: "venue-chaoyang-badminton", coachId: 1, name: "朝阳体育中心羽毛球馆", address: "朝阳区安定路 1 号", district: "朝阳区" },
  { id: "venue-haidian-badminton", coachId: 2, name: "海淀全民健身中心羽毛球馆", address: "海淀区颐和园路 12 号", district: "海淀区" },
  { id: "venue-chaoyang-tennis", coachId: 3, name: "朝阳公园网球中心", address: "朝阳区农展南路 1 号", district: "朝阳区" },
  { id: "venue-dongcheng-basketball", coachId: 4, name: "东单体育中心篮球馆", address: "东城区崇文门内大街 108 号", district: "东城区" },
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
  { id: "notification-sms", type: "service", title: "预约提醒将通过短信同步", body: "验证手机号后，可及时收到教练确认和改期通知。", createdAt: "2 天前", read: true },
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
