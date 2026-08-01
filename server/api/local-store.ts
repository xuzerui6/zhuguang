import {
  createDemoConversations,
  createDemoSlots,
  defaultLearner,
  demoCoaches,
  venues,
} from "../../app/mobile/demo-data";
import type { MobileBooking, MobileConversation, MobileSession } from "../../app/mobile/types";
import { ApiError } from "./contracts";
import { getBearerToken, maskPhone, randomId, randomToken } from "./security";

type LocalChallenge = { attempts: number; code: string; expiresAt: number; phone: string };
type LocalIdentity = { phone: string; userId: string };
type StoredSession = MobileSession & LocalIdentity;

const challenges = new Map<string, LocalChallenge>();
const accessSessions = new Map<string, StoredSession>();
const refreshSessions = new Map<string, StoredSession>();
const localFavorites = new Set<number>();
const localBookings: MobileBooking[] = [];
const localConversations: MobileConversation[] = createDemoConversations();

export function requestLocalOtp(phone: string) {
  const challengeId = randomId("challenge");
  challenges.set(challengeId, { attempts: 0, code: "888888", expiresAt: Date.now() + 5 * 60_000, phone });
  return { challengeId, expiresIn: 300, retryAfter: 60 };
}

export function verifyLocalOtp(challengeId: string, code: string, deviceId: string, favoriteCoachIds: number[] = []) {
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) throw new ApiError(400, "challenge_expired", "验证码已过期，请重新获取");
  if (challenge.attempts >= 5) throw new ApiError(423, "challenge_locked", "验证次数过多，请 30 分钟后重试");
  if (challenge.code !== code) {
    challenge.attempts += 1;
    throw new ApiError(400, "invalid_otp", "验证码不正确");
  }
  challenges.delete(challengeId);
  for (const coachId of favoriteCoachIds) {
    if (demoCoaches.some((coach) => coach.id === coachId)) localFavorites.add(coachId);
  }
  return issueLocalSession({ phone: challenge.phone, userId: `local-user-${challenge.phone.slice(-4)}` }, deviceId);
}

function issueLocalSession(identity: LocalIdentity, deviceId: string): MobileSession {
  const session: StoredSession = {
    ...identity,
    accessToken: randomToken("zga"),
    availableModes: ["student", "coach"],
    coach: {
      auditStatus: "approved",
      id: demoCoaches[0].id,
      name: demoCoaches[0].name,
      pendingBookingCount: localBookings.filter((booking) => booking.status === "pending_coach").length,
      sport: demoCoaches[0].sport,
      title: demoCoaches[0].title,
    },
    expiresAt: Date.now() + 15 * 60_000,
    phoneMasked: maskPhone(identity.phone),
    refreshToken: randomToken("zgr"),
  };
  accessSessions.set(session.accessToken, session);
  refreshSessions.set(session.refreshToken, session);
  void deviceId;
  return session;
}

export function refreshLocalSession(refreshToken: string, deviceId: string) {
  const current = refreshSessions.get(refreshToken);
  if (!current) throw new ApiError(401, "invalid_session", "登录状态已失效，请重新验证手机号");
  accessSessions.delete(current.accessToken);
  refreshSessions.delete(current.refreshToken);
  return issueLocalSession(current, deviceId);
}

export function authenticateLocal(request: Request, required?: true): StoredSession;
export function authenticateLocal(request: Request, required: false): StoredSession | null;
export function authenticateLocal(request: Request, required = true): StoredSession | null {
  const token = getBearerToken(request);
  const session = token ? accessSessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (required) throw new ApiError(401, "authentication_required", "请先验证手机号");
    return null;
  }
  return session;
}

export function logoutLocal(request: Request) {
  const session = authenticateLocal(request);
  accessSessions.delete(session.accessToken);
  refreshSessions.delete(session.refreshToken);
}

export function localBootstrap(request: Request) {
  const identity = authenticateLocal(request, false);
  return {
    bookings: identity ? [...localBookings] : [],
    coaches: demoCoaches,
    conversations: identity ? localConversations : [],
    favoriteCoachIds: identity ? [...localFavorites] : [],
    learnerProfiles: identity ? [defaultLearner] : [],
    minimumAppVersion: "1.0.0",
  };
}

export function localSetFavorite(coachId: number, favorite: boolean) {
  if (favorite) localFavorites.add(coachId);
  else localFavorites.delete(coachId);
  return { favoriteCoachIds: [...localFavorites].sort((left, right) => left - right) };
}

export function localCreateBooking(input: { coachId: number; learnerId: string; note: string; slotId: string; venueId: string }) {
  const coach = demoCoaches.find((item) => item.id === input.coachId);
  const venue = venues.find((item) => item.id === input.venueId && item.coachId === input.coachId);
  const slot = createDemoSlots(input.coachId).find((item) => item.id === input.slotId);
  if (!coach || !venue || !slot || !slot.available) throw new ApiError(409, "slot_unavailable", "该时段已不可预约，请选择其他时间");
  const startsAt = new Date(`${slot.date}T${slot.time}:00+08:00`).getTime();
  if (startsAt <= Date.now()) throw new ApiError(409, "slot_expired", "该时段已过期，请选择未来时间");
  if (localBookings.some((item) => item.slotId === input.slotId && ["pending_coach", "confirmed", "reschedule_requested"].includes(item.status))) {
    throw new ApiError(409, "slot_unavailable", "该时段刚刚被预约，请选择其他时间");
  }
  const booking: MobileBooking = {
    coachId: input.coachId,
    date: slot.date,
    dateLabel: slot.dateLabel,
    endTime: slot.endTime,
    feeFen: 9900,
    id: randomId("booking"),
    learnerId: input.learnerId,
    note: input.note,
    paymentStatus: "offline_unpaid",
    slotId: input.slotId,
    status: "pending_coach",
    submittedAt: "刚刚",
    time: slot.time,
    venueId: input.venueId,
  };
  localBookings.unshift(booking);
  return booking;
}

export function localCancelBooking(bookingId: string) {
  const booking = localBookings.find((item) => item.id === bookingId);
  if (!booking) throw new ApiError(404, "booking_not_found", "未找到该预约");
  if (!["pending_coach", "confirmed", "reschedule_requested"].includes(booking.status)) {
    throw new ApiError(409, "invalid_booking_transition", "当前预约状态不能取消");
  }
  booking.status = "cancelled_by_student";
  return booking;
}

export function localSendMessage(conversationId: string, body: string) {
  const conversation = localConversations.find((item) => item.id === conversationId);
  if (!conversation) throw new ApiError(404, "conversation_not_found", "未找到该会话");
  const message = { body, conversationId, createdAt: "刚刚", id: randomId("message"), read: true, sender: "student" as const };
  conversation.messages.push(message);
  conversation.subtitle = body;
  conversation.updatedAt = "刚刚";
  return conversation;
}

export function getLocalCoachData() {
  return { coaches: demoCoaches, slots: createDemoSlots, venues };
}

export function localCoachOverview() {
  return {
    bookings: localBookings.filter((booking) => booking.coachId === 1),
    coach: demoCoaches[0],
    conversations: localConversations.filter((conversation) => conversation.coachId === 1),
    slots: createDemoSlots(1),
  };
}

export function localCoachTransition(bookingId: string, status: MobileBooking["status"]) {
  const booking = localBookings.find((item) => item.id === bookingId);
  if (!booking) throw new ApiError(404, "booking_not_found", "未找到该预约");
  booking.status = status;
  return booking;
}
