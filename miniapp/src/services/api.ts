import Taro from "@tarojs/taro";
import { guestBootstrap } from "../mock";
import type { AccountProfile, Booking, BookingOptions, Bootstrap, CoachApplication, CoachOverview, Conversation, LearnerProfile, Message, PublicCoachReviews, RescheduleProposal, Session, WechatExchange } from "../types";
import { getStoredServiceCity, type ServiceCityId } from "./service-city";
import { getDeviceId, getLocalFavoriteCoachIds, getSession, getSessionOwner, getSessionRevision, setPendingWechatLink, setSession } from "./storage";
import { clearBookingDrafts } from './booking-draft';

const origin = process.env.TARO_APP_API_ORIGIN || "https://api.beijingzhuguang.top";
const channelKey = process.env.TARO_APP_CHANNEL_KEY || "";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 500) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string } };
let refreshPromise: Promise<Session | null> | null = null;

function headers(session: Session | null, auth: boolean, extraHeaders: Record<string, string>) {
  return {
    "content-type": "application/json",
    "x-app-platform": "weapp",
    "x-device-id": getDeviceId(),
    ...(channelKey ? { "x-zhuguang-app-key": channelKey } : {}),
    ...(auth && session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
    ...extraHeaders,
  };
}

async function refreshWechatSession() {
  if (refreshPromise) return refreshPromise;
  const current = getSession();
  const revision = getSessionRevision();
  if (!current?.refreshToken) return null;
  refreshPromise = (async () => {
    try {
      const response = await Taro.request<ApiEnvelope<Session>>({
        url: `${origin}/api/v1/auth/refresh`,
        method: "POST",
        data: { refreshToken: current.refreshToken },
        timeout: 20_000,
        header: headers(null, false, {}),
      });
      if (response.statusCode >= 400 || !response.data?.data) {
        if (revision !== getSessionRevision()) return null;
        if (response.statusCode === 401) { setSession(null); return null; }
        throw new ApiError('session_refresh_unavailable', '暂时无法恢复登录，账号数据已保留，请重试', 503);
      }
      if (revision !== getSessionRevision()) return null;
      setSession(response.data.data, true);
      return response.data.data;
    } catch (reason) {
      if (revision !== getSessionRevision()) return null;
      if (reason instanceof ApiError) throw reason;
      throw new ApiError('session_refresh_unavailable', '网络暂时不可用，账号数据已保留，请重试', 503);
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET", data?: unknown, auth = true, extraHeaders: Record<string, string> = {}): Promise<T> {
  const owner = getSessionOwner();
  const send = async (session: Session | null) => {
    try { return await Taro.request<ApiEnvelope<T>>({
    url: `${origin}${path}`,
    method,
    data,
    timeout: method === "GET" ? 10_000 : 20_000,
    header: headers(session, auth, extraHeaders),
    }); } catch (reason) {
      const message = reason && typeof reason === 'object' && 'errMsg' in reason ? String(reason.errMsg) : '';
      if (message.includes('not in domain list')) throw new ApiError('wechat_domain_not_configured', '微信服务器域名配置尚未生效，请联系平台核对合法域名', 503);
      if (/timeout/iu.test(message)) throw new ApiError('request_timeout', '请求超时，已保留内容，请重试', 408);
      throw new ApiError('network_unavailable', '网络暂时不可用，已保留内容，请检查网络后重试', 503);
    }
  };
  let response = await send(getSession());
  if (auth && owner !== getSessionOwner()) throw new ApiError('session_changed', '账号已切换，请重新操作', 401);
  if (auth && response.statusCode === 401 && getSession()?.refreshToken) {
    const refreshed = await refreshWechatSession();
    if (refreshed) response = await send(refreshed);
  }
  if (auth && owner !== getSessionOwner()) throw new ApiError('session_changed', '账号已切换，请重新操作', 401);
  const envelope = typeof response.data === 'object' && response.data !== null ? response.data : {};
  if (response.statusCode >= 400 || envelope.error) {
    throw new ApiError(envelope.error?.code || "request_failed", envelope.error?.message || "服务暂时不可用，请重试", response.statusCode);
  }
  if (envelope.data === undefined) throw new ApiError("invalid_response", "服务返回内容不完整，请重试");
  return envelope.data;
}

export async function bootstrap(cityId: ServiceCityId = getStoredServiceCity()): Promise<Bootstrap> {
  try {
    const owner = getSessionOwner();
    const data = await request<Bootstrap>(`/api/v1/bootstrap?city=${cityId}`);
    const current = getSession();
    if (current && owner === getSessionOwner() && data.accountIdentity && (!current.userId || current.userId === data.accountIdentity.userId)) {
      setSession({ ...current, ...data.accountIdentity }, true);
    }
    return { ...data, profile: data.profile || data.accountProfile };
  } catch (error) {
    if (process.env.TARO_APP_PREVIEW !== "true") throw error;
    return cityId === "beijing" ? guestBootstrap : { ...guestBootstrap, coaches: [] };
  }
}

export async function coachOverview(): Promise<CoachOverview> {
  if (!getSession()) throw new ApiError("authentication_required", "请先登录已绑定的教练账号", 401);
  return request<CoachOverview>("/api/v1/coach/overview");
}

export async function refreshAccountIdentity() {
  const owner = getSessionOwner();
  const identity = await request<NonNullable<Bootstrap["accountIdentity"]>>("/api/v1/me");
  const current = getSession();
  if (current && owner === getSessionOwner() && (!current.userId || current.userId === identity.userId)) setSession({ ...current, ...identity }, true);
  return identity;
}

export async function startWechatLogin(): Promise<WechatExchange> {
  if (process.env.TARO_APP_WECHAT_LOGIN_ENABLED !== "true") {
    throw new ApiError("wechat_not_configured", "正式小程序 AppID 注册后启用微信登录", 503);
  }
  const login = await Taro.login();
  const result = await request<WechatExchange>("/api/v1/auth/wechat/exchange", "POST", { code: login.code }, false);
  if (result.status === "authenticated") {
    setSession(result.session);
    setPendingWechatLink(null);
  } else {
    setPendingWechatLink({ expiresAt: result.expiresAt, linkToken: result.linkToken });
  }
  return result;
}

export function sendWechatLinkEmail(email: string, linkToken: string) {
  return request<{ challengeId: string; expiresIn: number; retryAfter: number }>("/api/v1/auth/wechat/link/email/send", "POST", { email, linkToken }, false);
}

export async function verifyWechatLinkEmail(challengeId: string, code: string, linkToken: string) {
  const result = await request<{ status: "authenticated"; session: Session }>("/api/v1/auth/wechat/link/email/verify", "POST", {
    challengeId,
    code,
    favoriteCoachIds: getLocalFavoriteCoachIds(),
    linkToken,
  }, false);
  setSession(result.session);
  setPendingWechatLink(null);
  return result.session;
}

export async function logoutWechatSession() {
  const current = getSession();
  try {
    if (current?.refreshToken) {
      await request<void>("/api/v1/auth/logout-refresh", "POST", { refreshToken: current.refreshToken }, false);
    }
  } finally {
    setSession(null);
    setPendingWechatLink(null);
    clearBookingDrafts();
  }
}

export function toggleFavorite(coachId: number, active: boolean) {
  return request<{ favoriteCoachIds: number[] }>(`/api/v1/favorites/${coachId}`, active ? "PUT" : "DELETE");
}

export function updateCoachAvailability(bookingEnabled: boolean) {
  return request<{ effectiveOnline: boolean; online: boolean }>("/api/v1/coach/availability", "PATCH", { online: bookingEnabled });
}

export function bookingOptions(coachId: number, cityId: ServiceCityId = "beijing") {
  return request<BookingOptions>(`/api/v1/coaches/${coachId}/booking-options?city=${cityId}`);
}

export function createBooking(input: {
  coachId: number;
  learnerId: string;
  startsAt: number;
  durationMinutes: 60 | 90 | 120;
  locationType: "venue" | "custom";
  venueId?: string;
  customDistrict?: string;
  customAddress?: string;
  customLocationNote?: string;
  serviceCityId?: ServiceCityId;
  note: string;
}, idempotencyKey: string) {
  return request<Booking>("/api/v1/bookings", "POST", input, true, { "idempotency-key": idempotencyKey });
}

export function cancelBooking(bookingId: string) {
  return request<Booking>(`/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`, "POST");
}

export function createConversation(coachId: number) {
  return request<Conversation>("/api/v1/conversations", "POST", { coachId });
}

export function sendConversationMessage(role: "student" | "coach", conversationId: string, body: string) {
  const prefix = role === "coach" ? "/api/v1/coach" : "/api/v1";
  return request<Conversation | Message>(`${prefix}/conversations/${encodeURIComponent(conversationId)}/messages`, "POST", { body });
}

export function markConversationRead(role: "student" | "coach", conversationId: string) {
  const prefix = role === "coach" ? "/api/v1/coach" : "/api/v1";
  return request<{ conversationId: string; unreadCount: number }>(`${prefix}/conversations/${encodeURIComponent(conversationId)}/read`, "POST");
}

export function transitionCoachBooking(bookingId: string, status: "confirmed" | "rejected" | "cancelled_by_coach" | "completed") {
  return request<Booking>(`/api/v1/coach/bookings/${encodeURIComponent(bookingId)}/status`, "POST", { status });
}

export function proposeCoachBooking(input: { bookingId: string; startsAt: number; venueId?: string; locationType: 'venue' | 'custom'; customDistrict?: string; customAddress?: string; note: string }) {
  return request<{ id: string; status: "pending" }>("/api/v1/coach/reschedule-proposals", "POST", input);
}

export function listTrainingRecords() { return request<Array<{ id: string; booking_id: string; summary: string; published_at: number }>>('/api/v1/training-records'); }
export function publishTrainingRecord(bookingId: string, summary: string) { return request('/api/v1/coach/training-records', 'POST', { bookingId, summary, coachNotes: '' }); }
export function markOfflinePaid(bookingId: string) { return request(`/api/v1/coach/bookings/${encodeURIComponent(bookingId)}/offline-payment`, 'POST', { paid: true }); }
export function listSupportTickets(role: 'student' | 'coach') { return request<Array<{ id: string; subject: string; status: string; latest_message?: string }>>(`/api/v1/${role === 'coach' ? 'coach/' : ''}support-tickets`); }
export function createSupportTicket(role: 'student' | 'coach', input: { bookingId?: string; subject: string; body: string; category: string }) { return request(`/api/v1/${role === 'coach' ? 'coach/' : ''}support-tickets`, 'POST', input); }
export async function deleteAccount() { await request('/api/v1/users/me', 'DELETE'); setSession(null); setPendingWechatLink(null); clearBookingDrafts(); }
export function legalDocuments() { return request<Array<{ slug: string; title: string; body: string; version: string; updatedAt: number }>>('/api/v1/public/legal-documents', 'GET', undefined, false); }

export function listRescheduleProposals() {
  return request<RescheduleProposal[]>("/api/v1/reschedule-proposals");
}

export function respondRescheduleProposal(id: string, decision: "accepted" | "rejected") {
  return request<{ id: string; status: "accepted" | "rejected" }>(`/api/v1/reschedule-proposals/${encodeURIComponent(id)}/respond`, "POST", { decision });
}

export function listCoachReviews(coachId: number) {
  return request<PublicCoachReviews>(`/api/v1/coaches/${coachId}/reviews?sort=recent`, "GET", undefined, false);
}

export function submitCoachReview(input: { bookingId: string; body: string; rating: number; tags: string[] }) {
  return request<{ id: string; status: "pending" }>("/api/v1/reviews", "POST", input);
}

export function resubmitCoachReview(reviewId: string, input: { body: string; rating: number; tags: string[] }) {
  return request<{ id: string; status: "pending" }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}/resubmit`, "PATCH", input);
}

export function updateAccountProfile(input: { nickname: string; bio: string; serviceArea: string; serviceCityId: ServiceCityId }) {
  return request<AccountProfile>("/api/v1/me/profile", "PATCH", input);
}

export function saveLearnerProfile(input: {
  id?: string;
  name: string;
  relation: "self" | "child";
  gender: "male" | "female" | "unspecified";
  age?: number;
  sport: string;
  level: string;
  goal: string;
}) {
  return request<Bootstrap["learnerProfiles"][number]>(input.id ? `/api/v1/learner-profiles/${encodeURIComponent(input.id)}` : "/api/v1/learner-profiles", input.id ? "PATCH" : "POST", input);
}

export function listLearnerProfiles() {
  return request<LearnerProfile[]>("/api/v1/learner-profiles");
}

export function getLearnerProfile(id: string) {
  return request<LearnerProfile>(`/api/v1/learner-profiles/${encodeURIComponent(id)}`);
}

export function saveServiceCity(cityId: ServiceCityId, source: "manual" | "location") {
  return request<{ cityId: ServiceCityId; source: "manual" | "location" }>("/api/v1/me/service-city", "PATCH", { cityId, source });
}

export function listCoachApplications() {
  return request<CoachApplication[]>("/api/v1/coach-applications/mine");
}

export function saveCoachApplication(input: Record<string, unknown>) {
  return request<CoachApplication>("/api/v1/coach-applications", input.applicationId ? "PATCH" : "POST", input);
}

export function uploadCoachApplicationMedia(applicationId: string, kind: "avatar" | "hero" | "credential", bytes: ArrayBuffer, contentType: string) {
  return request<{ kind: string; uploaded: true }>(`/api/v1/coach-applications/${encodeURIComponent(applicationId)}/media/${kind}`, "PUT", bytes, true, { "content-type": contentType });
}

export function submitCoachApplication(applicationId: string) {
  return request<{ id: string; status: "pending" }>(`/api/v1/coach-applications/${encodeURIComponent(applicationId)}/submit`, "POST");
}

export function withdrawCoachApplication(applicationId: string) {
  return request<{ id: string; status: "withdrawn" }>(`/api/v1/coach-applications/${encodeURIComponent(applicationId)}/withdraw`, "POST");
}

export function createCoachProfileChange(field: string, value: unknown) {
  return request<{ id: string; status: "pending" }>("/api/v1/coach/profile-change-requests", "POST", { field, value });
}

export function listCoachProfileChanges() {
  return request<Array<{ id: string; field: string; status: string; review_note?: string; created_at: number }>>("/api/v1/coach/profile-change-requests");
}
