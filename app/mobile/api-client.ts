import { createRequestId } from "./domain";
import { fetchMobilePayload } from "./network-policy";
import { completionIdempotencyKey } from "../../shared/completion-idempotency";
import { getMobilePlatform, getOrCreateDeviceId, readSession, writeSession } from "./device";
import type {
  AccountProfile,
  AppRelease,
  BookingSlot,
  BookingOptions,
  BookingStatus,
  CoachOverview,
  LearnerProfile,
  MobileBooking,
  MobileCoach,
  MobileConversation,
  MobileNotification,
  MobileIdentity,
  MobileSession,
  PlatformCapabilities,
} from "./types";
import type { PublicCoachReviews } from "../../shared/reviews";
import type { CoachApplication, CoachApplicationDraft } from "../../shared/coach-application";
import type { ServiceCityId } from "../../shared/service-cities";

type ApiFailure = { error: { code: string; message: string; requestId: string; fieldErrors?: Record<string, string> } };

export class MobileApiError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;
  requestId: string;
  status: number;

  constructor(payload: ApiFailure["error"], status = 0) {
    super(payload.message);
    this.name = "MobileApiError";
    this.code = payload.code;
    this.requestId = payload.requestId;
    this.fieldErrors = payload.fieldErrors;
    this.status = status;
  }
}

function getApiBaseUrl() {
  const configured = typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL
    : undefined;
  return configured?.replace(/\/$/, "") ?? "";
}

function getBuildValue(key: string) {
  return typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key]
    : undefined;
}

export function usesBundledDemoData() {
  return !getBuildValue("VITE_API_BASE_URL");
}

async function request<T>(path: string, init: RequestInit = {}, retry = true, expectedUserId?: string): Promise<T> {
  const session = await readSession();
  if (expectedUserId && (session?.userId || session?.profile?.userId) !== expectedUserId) throw new MobileApiError({ code:'account_changed', message:'账号已切换，请重新同步收藏', requestId:createRequestId() },401);
  const headers = new Headers(init.headers);
  const deviceId = await getOrCreateDeviceId();
  headers.set("accept", "application/json");
  headers.set("x-app-platform", getMobilePlatform());
  headers.set("x-booking-flow", "2");
  headers.set("x-app-version", getBuildValue("VITE_APP_VERSION") ?? "1.1.0");
  headers.set("x-app-version-code", getBuildValue("VITE_APP_VERSION_CODE") ?? "3");
  headers.set("x-device-id", deviceId);
  headers.set("x-request-id", createRequestId());
  const appKey = getBuildValue("VITE_PILOT_APP_KEY");
  if (appKey) headers.set("x-zhuguang-app-key", appKey);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (session?.accessToken) headers.set("authorization", `Bearer ${session.accessToken}`);

  const { response, payload } = await fetchMobilePayload(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (response.status === 401 && retry && session?.refreshToken) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) return request<T>(path, init, false, expectedUserId);
  }

  if (!response.ok || payload.error || payload.data === undefined) {
    throw new MobileApiError(payload.error ?? {
      code: "request_failed",
      message: "服务暂时不可用，请稍后重试",
      requestId: response.headers.get("x-request-id") ?? createRequestId(),
    }, response.status);
  }
  return payload.data as T;
}

const refreshes = new Map<string, Promise<MobileSession | null>>();
let sessionEpoch = 0;

function refreshSession(refreshToken: string) {
  const existing = refreshes.get(refreshToken);
  if (existing) return existing;
  const operation = rotateSession(refreshToken, sessionEpoch).finally(() => refreshes.delete(refreshToken));
  refreshes.set(refreshToken, operation);
  return operation;
}

async function rotateSession(refreshToken: string, epoch: number) {
  const current = await readSession();
  if (!current || epoch !== sessionEpoch) return null;
  if (current.refreshToken !== refreshToken) return current;
  try {
    const headers = new Headers({ "content-type": "application/json" });
    headers.set("x-device-id", await getOrCreateDeviceId());
    const appKey = getBuildValue("VITE_PILOT_APP_KEY");
    if (appKey) headers.set("x-zhuguang-app-key", appKey);
    const { response, payload } = await fetchMobilePayload(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      body: JSON.stringify({ refreshToken }),
      headers,
      method: "POST",
    });
    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && epoch === sessionEpoch) await writeSession(null);
      return null;
    }
    const data = payload.data as MobileSession | undefined;
    if (!data || typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') return null;
    if (epoch !== sessionEpoch) return null;
    await writeSession(data);
    return data;
  } catch {
    // A network outage must not destroy the last recoverable session.
    return null;
  }
}

export const mobileApi = {
  capabilities: () => request<PlatformCapabilities>("/api/v1/capabilities"),
  bootstrap: (cityId: ServiceCityId = "beijing") => request<{
    accountIdentity?: MobileIdentity;
    catalog?: import("../../shared/service-catalog").ServiceCatalog;
    accountProfile?: AccountProfile;
    bookings: MobileBooking[];
    coaches: MobileCoach[];
    conversations: MobileConversation[];
    favoriteCoachIds: number[];
    learnerProfiles: LearnerProfile[];
    minimumAppVersion: string;
  }>(`/api/v1/bootstrap?city=${cityId}`),
  catalog: (cityId: ServiceCityId) => request<import("../../shared/service-catalog").ServiceCatalog>(`/api/v1/catalog?city=${cityId}`),
  saveServiceCity: (cityId: ServiceCityId, source: "manual" | "location") => request("/api/v1/me/service-city", { body: JSON.stringify({ cityId, source }), method: "PATCH" }),
  coachApplications: () => request<CoachApplication[]>("/api/v1/coach-applications/mine"),
  saveCoachApplication: (input: CoachApplicationDraft) => request<CoachApplication>("/api/v1/coach-applications", { body: JSON.stringify(input), method: input.applicationId ? "PATCH" : "POST" }),
  uploadCoachApplicationMedia: (id: string, kind: "avatar" | "hero" | "credential", file: Blob) => request(`/api/v1/coach-applications/${encodeURIComponent(id)}/media/${kind}`, { body: file, headers: { "content-type": file.type }, method: "PUT" }),
  submitCoachApplication: (id: string) => request(`/api/v1/coach-applications/${encodeURIComponent(id)}/submit`, { method: "POST" }),
  withdrawCoachApplication: (id: string) => request(`/api/v1/coach-applications/${encodeURIComponent(id)}/withdraw`, { method: "POST" }),
  me: () => request<MobileIdentity>("/api/v1/me"),
  profile: () => request<AccountProfile>("/api/v1/me/profile"),
  updateProfile: (input: { bio: string; district?: string; nickname: string; serviceArea?: string; serviceCityId?: ServiceCityId }) => request<AccountProfile>("/api/v1/me/profile", {
    body: JSON.stringify(input), method: "PATCH",
  }),
  uploadAvatar: (blob: Blob) => request<AccountProfile>("/api/v1/me/avatar", {
    body: blob, headers: { "content-type": "image/webp" }, method: "POST",
  }),
  deleteAvatar: () => request<AccountProfile>("/api/v1/me/avatar", { method: "DELETE" }),
  requestContactChallenge: (kind: "email" | "phone", value: string) => request<{ challengeId: string; expiresIn: number; retryAfter: number; valueHint: string }>("/api/v1/me/contact-challenges", {
    body: JSON.stringify({ kind, value }), method: "POST",
  }),
  verifyContactChallenge: (challengeId: string, code: string) => request<{ mergeRequired: boolean; profile?: AccountProfile; status: string }>(`/api/v1/me/contact-challenges/${encodeURIComponent(challengeId)}/verify`, {
    body: JSON.stringify({ code }), method: "POST",
  }),
  requestEmailOtp: (email: string, turnstileToken: string) => request<{ challengeId: string; expiresIn: number; retryAfter: number }>("/api/v1/auth/email/request", {
    body: JSON.stringify({ email, turnstileToken }),
    method: "POST",
  }),
  verifyEmailOtp: (challengeId: string, code: string, favoriteCoachIds: number[] = []) => request<MobileSession>("/api/v1/auth/email/verify", {
    body: JSON.stringify({ challengeId, code, favoriteCoachIds }),
    method: "POST",
  }).then(async (session) => {
    await writeSession(session);
    return session;
  }),
  logout: async () => {
    const session = await readSession();
    if (session?.refreshToken) await request<void>("/api/v1/auth/logout-refresh", { body: JSON.stringify({ refreshToken: session.refreshToken }), method: "POST" }, false);
    sessionEpoch++;
    await Promise.allSettled(refreshes.values());
    await writeSession(null);
  },
  deleteAccount: () => request<{ deletionEffectiveAt: number; retainedForDisputesDays: number }>("/api/v1/users/me", { method: "DELETE" }).finally(() => writeSession(null)),
  setFavorite: (coachId: number, favorite: boolean, expectedUserId?: string) => request<{ favoriteCoachIds: number[] }>(`/api/v1/favorites/${coachId}`, {
    method: favorite ? "PUT" : "DELETE",
  }, true, expectedUserId),
  coachSlots: (coachId: number) => request<BookingSlot[]>(`/api/v1/coaches/${coachId}/slots`),
  coachBookingOptions: (coachId: number, cityId: ServiceCityId = "beijing") => request<BookingOptions>(`/api/v1/coaches/${coachId}/booking-options?city=${cityId}`),
  coachReviews: (coachId: number, sort: "helpful" | "recent" = "recent") => request<PublicCoachReviews>(`/api/v1/coaches/${coachId}/reviews?sort=${sort}`),
  markReviewHelpful: (reviewId: string) => request(`/api/v1/reviews/${encodeURIComponent(reviewId)}/helpful`, { method: "POST" }),
  reportReview: (reviewId: string, reason: string) => request(`/api/v1/reviews/${encodeURIComponent(reviewId)}/report`, { body: JSON.stringify({ reason }), method: "POST" }),
  createReview: (input: { bookingId: string; body: string; rating: number; tags: string[] }) => request<{ id: string; status: "pending" }>("/api/v1/reviews", {
    body: JSON.stringify(input), method: "POST",
  }),
  resubmitReview: (reviewId: string, input: { body: string; rating: number; tags: string[] }) => request<{ id: string; status: "pending" }>(`/api/v1/reviews/${encodeURIComponent(reviewId)}/resubmit`, {
    body: JSON.stringify(input), method: "PATCH",
  }),
  trackEvents: async (events: Array<{ errorCode?: string; flow: string; outcome: string; role: string; step: string }>) => request("/api/v1/telemetry/events", {
    body: JSON.stringify({ events: events.map((event) => ({ ...event, appVersion: getBuildValue("VITE_APP_VERSION") ?? "unknown", sessionId: createRequestId("telemetry"), surface: getMobilePlatform() })) }),
    method: "POST",
  }).catch(() => undefined),
  createBooking: (input: {
    serviceCityId?: ServiceCityId;
    coachId: number;
    customAddress?: string;
    customDistrict?: string;
    customLocationNote?: string;
    durationMinutes: 60 | 90 | 120;
    learnerId: string;
    locationType: "venue" | "custom";
    note: string;
    startsAt: number;
    venueId?: string;
  }) => request<MobileBooking>("/api/v1/bookings", {
    body: JSON.stringify(input),
    headers: { "idempotency-key": createRequestId("booking-submit") },
    method: "POST",
  }),
  createConversation: (coachId: number) => request<MobileConversation>("/api/v1/conversations", {
    body: JSON.stringify({ coachId }),
    method: "POST",
  }),
  notifications: () => request<MobileNotification[]>("/api/v1/notifications"),
  learnerProfiles: () => request<LearnerProfile[]>("/api/v1/learner-profiles"),
  saveLearner: (profile: LearnerProfile) => request<LearnerProfile>(profile.id ? `/api/v1/learner-profiles/${encodeURIComponent(profile.id)}` : "/api/v1/learner-profiles", {
    body: JSON.stringify(profile),
    method: profile.id ? "PATCH" : "POST",
  }),
  cancelBooking: (bookingId: string) => request<MobileBooking>(`/api/v1/bookings/${bookingId}/cancel`, { method: "POST" }),
  respondCompletion: async (completionId: string, decision: "accepted" | "disputed", note = "") => request(`/api/v1/booking-completion-requests/${encodeURIComponent(completionId)}/respond`, { body: JSON.stringify({ decision, note }), headers: { "idempotency-key": await completionIdempotencyKey(completionId, decision, note) }, method: "POST" }),
  createTestPaymentOrder: (bookingId: string) => request<{ amountFen: number; id: string; status: string }>(`/api/v1/bookings/${encodeURIComponent(bookingId)}/payment-orders`, { headers: { "idempotency-key": createRequestId("test-payment") }, method: "POST" }),
  confirmTestPayment: (orderId: string) => request(`/api/v1/payment-orders/${encodeURIComponent(orderId)}/test-confirm`, { method: "POST" }),
  sendMessage: (conversationId: string, body: string) => request<MobileConversation>(`/api/v1/conversations/${conversationId}/messages`, {
    body: JSON.stringify({ body }),
    method: "POST",
  }),
  markConversationRead: (conversationId: string) => request<{ conversationId: string; unreadCount: number }>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }),
  createFeedbackTicket: (body: string) => request("/api/v1/support-tickets", {
    body: JSON.stringify({ body, category: "feedback", subject: "App 使用反馈" }),
    method: "POST",
  }),
  coachOverview: () => request<CoachOverview>("/api/v1/coach/overview"),
  coachReviewsForCoach: () => request<Array<{ id: string; rating: number; body: string; tags_json?: string; helpful_count?: number; reply_body?: string; reply_status?: string }>>("/api/v1/coach/reviews"),
  coachSetBookingStatus: (bookingId: string, status: BookingStatus) => request<MobileBooking>(`/api/v1/coach/bookings/${bookingId}/status`, {
    body: JSON.stringify({ status }),
    headers: { "idempotency-key": createRequestId("coach-booking") },
    method: "POST",
  }),
  coachRequestCompletion: (bookingId: string, note = "") => request(`/api/v1/coach/bookings/${encodeURIComponent(bookingId)}/completion-request`, { body: JSON.stringify({ note }), method: "POST" }),
  coachSetAvailability: (online: boolean) => request<{ effectiveOnline: boolean; online: boolean }>("/api/v1/coach/availability", {
    body: JSON.stringify({ online }), method: "PATCH",
  }),
  coachProposeReschedule: (input: { bookingId: string; startsAt: number; venueId?: string; locationType: 'venue' | 'custom'; customDistrict?: string; customAddress?: string; note: string }) => request<{ id: string; status: string }>("/api/v1/coach/reschedule-proposals", {
    body: JSON.stringify(input), method: "POST",
  }),
  coachSendMessage: (conversationId: string, body: string) => request<import("./types").MobileMessage>(`/api/v1/coach/conversations/${conversationId}/messages`, {
    body: JSON.stringify({ body }),
    method: "POST",
  }),
  coachMarkConversationRead: (conversationId: string) => request<{ conversationId: string; unreadCount: number }>(`/api/v1/coach/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST" }),
  coachReplyToReview: (reviewId: string, body: string) => request(`/api/v1/coach/reviews/${encodeURIComponent(reviewId)}/reply`, { body: JSON.stringify({ body }), method: "POST" }),
  coachMarkOfflinePaid: (bookingId: string, paid: boolean) => request(`/api/v1/coach/bookings/${bookingId}/offline-payment`, {
    body: JSON.stringify({ paid }),
    method: "POST",
  }),
  latestRelease: () => request<AppRelease>("/api/v1/app/releases/latest"),
  legalDocuments: () => request<import('../../shared/legal-documents').LegalDocument[]>('/api/v1/public/legal-documents'),
  createDownloadTicket: (versionCode: number) => request<{ expiresAt: number; url: string }>(`/api/v1/app/releases/${versionCode}/download-ticket`, {
    method: "POST",
  }),
  registerInstallation: (input: { installationId: string; pushRegistrationId?: string; versionCode: number; versionName: string }) => request<{ installationId: string }>("/api/v1/app/installations", {
    body: JSON.stringify({ ...input, platform: getMobilePlatform() }),
    method: "PUT",
  }),
  recordUpdateEvent: (input: { eventType: string; installationId: string; versionCode: number; detail?: Record<string, unknown> }) => request<void>("/api/v1/app/update-events", {
    body: JSON.stringify(input),
    method: "POST",
  }),
  saveNotificationPreferences: (input: { booking: boolean; message: boolean; update: boolean }) => request("/api/v1/notification-preferences", {
    body: JSON.stringify(input),
    method: "PUT",
  }),
};
