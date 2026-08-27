import { createRequestId } from "./domain";
import { getMobilePlatform, getOrCreateDeviceId, readSession, writeSession } from "./device";
import type {
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
} from "./types";

type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
type ApiFailure = { error: { code: string; message: string; requestId: string; fieldErrors?: Record<string, string> } };

export class MobileApiError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;
  requestId: string;

  constructor(payload: ApiFailure["error"]) {
    super(payload.message);
    this.name = "MobileApiError";
    this.code = payload.code;
    this.requestId = payload.requestId;
    this.fieldErrors = payload.fieldErrors;
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

const API_TIMEOUT_MS = 4_000;

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  const timer = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (init.signal?.aborted) controller.abort();

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await readSession();
  const headers = new Headers(init.headers);
  const deviceId = await getOrCreateDeviceId();
  headers.set("accept", "application/json");
  headers.set("x-app-platform", getMobilePlatform());
  headers.set("x-app-version", getBuildValue("VITE_APP_VERSION") ?? "1.1.0");
  headers.set("x-app-version-code", getBuildValue("VITE_APP_VERSION_CODE") ?? "3");
  headers.set("x-device-id", deviceId);
  headers.set("x-request-id", createRequestId());
  const appKey = getBuildValue("VITE_PILOT_APP_KEY");
  if (appKey) headers.set("x-zhuguang-app-key", appKey);
  if (init.body) headers.set("content-type", "application/json");
  if (session?.accessToken) headers.set("authorization", `Bearer ${session.accessToken}`);

  const response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (response.status === 401 && retry && session?.refreshToken) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) return request<T>(path, init, false);
  }

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in payload) {
    throw new MobileApiError("error" in payload ? payload.error : {
      code: "request_failed",
      message: "服务暂时不可用，请稍后重试",
      requestId: response.headers.get("x-request-id") ?? createRequestId(),
    });
  }
  return payload.data;
}

async function refreshSession(refreshToken: string) {
  try {
    const headers = new Headers({ "content-type": "application/json" });
    headers.set("x-device-id", await getOrCreateDeviceId());
    const appKey = getBuildValue("VITE_PILOT_APP_KEY");
    if (appKey) headers.set("x-zhuguang-app-key", appKey);
    const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      body: JSON.stringify({ refreshToken }),
      headers,
      method: "POST",
    });
    if (!response.ok) throw new Error("refresh failed");
    const payload = (await response.json()) as ApiSuccess<MobileSession>;
    await writeSession(payload.data);
    return payload.data;
  } catch {
    await writeSession(null);
    return null;
  }
}

export const mobileApi = {
  bootstrap: () => request<{
    bookings: MobileBooking[];
    coaches: MobileCoach[];
    conversations: MobileConversation[];
    favoriteCoachIds: number[];
    learnerProfiles: LearnerProfile[];
    minimumAppVersion: string;
  }>("/api/v1/bootstrap"),
  me: () => request<MobileIdentity>("/api/v1/me"),
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
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }).finally(() => writeSession(null)),
  deleteAccount: () => request<{ deletionEffectiveAt: number; retainedForDisputesDays: number }>("/api/v1/users/me", { method: "DELETE" }).finally(() => writeSession(null)),
  setFavorite: (coachId: number, favorite: boolean) => request<{ favoriteCoachIds: number[] }>(`/api/v1/favorites/${coachId}`, {
    method: favorite ? "PUT" : "DELETE",
  }),
  coachSlots: (coachId: number) => request<BookingSlot[]>(`/api/v1/coaches/${coachId}/slots`),
  coachBookingOptions: (coachId: number) => request<BookingOptions>(`/api/v1/coaches/${coachId}/booking-options`),
  createBooking: (input: {
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
  saveLearner: (profile: LearnerProfile) => request<LearnerProfile>("/api/v1/learner-profiles", {
    body: JSON.stringify(profile),
    method: profile.id ? "PUT" : "POST",
  }),
  cancelBooking: (bookingId: string) => request<MobileBooking>(`/api/v1/bookings/${bookingId}/cancel`, { method: "POST" }),
  sendMessage: (conversationId: string, body: string) => request<MobileConversation>(`/api/v1/conversations/${conversationId}/messages`, {
    body: JSON.stringify({ body }),
    method: "POST",
  }),
  createFeedbackTicket: (body: string) => request("/api/v1/support-tickets", {
    body: JSON.stringify({ body, category: "feedback", subject: "App 使用反馈" }),
    method: "POST",
  }),
  coachOverview: () => request<CoachOverview>("/api/v1/coach/overview"),
  coachSetBookingStatus: (bookingId: string, status: BookingStatus) => request<MobileBooking>(`/api/v1/coach/bookings/${bookingId}/status`, {
    body: JSON.stringify({ status }),
    headers: { "idempotency-key": createRequestId("coach-booking") },
    method: "POST",
  }),
  coachSetAvailability: (online: boolean) => request<{ effectiveOnline: boolean; online: boolean }>("/api/v1/coach/availability", {
    body: JSON.stringify({ online }), method: "PATCH",
  }),
  coachProposeReschedule: (input: { bookingId: string; startsAt: number; venueId: string; note: string }) => request<{ id: string; status: string }>("/api/v1/coach/reschedule-proposals", {
    body: JSON.stringify({ ...input, locationType: "venue" }), method: "POST",
  }),
  coachSendMessage: (conversationId: string, body: string) => request(`/api/v1/coach/conversations/${conversationId}/messages`, {
    body: JSON.stringify({ body }),
    method: "POST",
  }),
  coachMarkOfflinePaid: (bookingId: string, paid: boolean) => request(`/api/v1/coach/bookings/${bookingId}/offline-payment`, {
    body: JSON.stringify({ paid }),
    method: "POST",
  }),
  latestRelease: () => request<AppRelease>("/api/v1/app/releases/latest"),
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
