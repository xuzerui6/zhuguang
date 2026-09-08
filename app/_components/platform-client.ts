"use client";

export class PlatformRequestError extends Error {
  code?: string;
  fieldErrors?: Record<string, string>;
  status: number;

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "PlatformRequestError";
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

export type BookingOptionsFailure = {
  action: "choose" | "login" | "none" | "retry";
  copy: string;
  title: string;
};

export function describeBookingOptionsFailure(error: unknown, unavailableReason?: string): BookingOptionsFailure {
  if (error instanceof PlatformRequestError) {
    if (error.status === 401 || error.code === "authentication_required") {
      return { action: "login", copy: "登录状态已失效。重新登录后会返回当前教练的预约页面。", title: "请重新登录" };
    }
    if (error.status === 403 || error.code === "role_forbidden") {
      return { action: "login", copy: "当前登录状态未能取得学员预约权限，请重新验证账号后再试。", title: "预约权限需要重新验证" };
    }
    if (error.status === 404 || error.code === "coach_not_found") {
      return { action: "choose", copy: "该教练档案已不存在或不再公开展示，请重新选择教练。", title: "未找到教练" };
    }
    if (error.status === 410 || error.code === "coach_not_accepting_requests") {
      return { action: "none", copy: unavailableReason || error.message || "该教练当前暂不接受新的时间申请。", title: "教练暂未接单" };
    }
  }
  return { action: "retry", copy: error instanceof Error ? error.message : "预约配置加载失败，请检查网络后重试。", title: "预约配置暂时无法加载" };
}

export async function platformRequest<T>(
  path: string,
  options: { body?: unknown; idempotencyKey?: string; method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT" } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.body === undefined ? undefined : { "content-type": "application/json" });
  if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
  const send = () => fetch(`/api/platform?path=${encodeURIComponent(path)}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    headers,
    method,
    signal: AbortSignal.timeout(20_000),
  });
  let response = await send();
  if (response.status === 401) {
    const renewed = await refreshPlatformSession();
    if (renewed) { await response.body?.cancel(); response = await send(); }
  }
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: { code?: string; fieldErrors?: Record<string, string>; message?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new PlatformRequestError(payload.error?.message || "服务暂时不可用，请稍后重试", response.status, payload.error?.code, payload.error?.fieldErrors);
  }
  return payload.data;
}

let refreshInFlight: Promise<boolean> | null = null;
export function refreshPlatformSession() {
  if (!refreshInFlight) refreshInFlight = fetch("/api/auth/email/refresh", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(12_000) })
    .then((response) => response.ok).catch(() => false).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export function trackProductEvent(input: { errorCode?: string; flow: string; outcome: string; role: string; step: string }) {
  if (typeof window === "undefined") return;
  const storageKey = "zhuguang:telemetry-session";
  let sessionId = window.sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, sessionId);
  }
  void platformRequest("/api/v1/telemetry/events", {
    body: { events: [{ ...input, sessionId, surface: "web" }] },
    method: "POST",
  }).catch(() => undefined);
}

export async function platformUploadAvatar(blob: Blob) {
  const response = await fetch(`/api/platform?path=${encodeURIComponent("/api/v1/me/avatar")}`, {
    body: blob,
    cache: "no-store",
    headers: { "content-type": "image/webp" },
    method: "POST",
  });
  const payload = await response.json() as { data?: import("../mobile/types").AccountProfile; error?: { message?: string } };
  if (!response.ok || !payload.data) throw new PlatformRequestError(payload.error?.message || "头像上传失败，请稍后重试", response.status);
  return payload.data;
}

export async function platformBinaryRequest<T>(
  path: string,
  body: Blob,
  options: { headers?: Record<string, string>; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("content-type")) headers.set("content-type", body.type || "application/octet-stream");
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 90_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const send = () => fetch(`/api/platform?path=${encodeURIComponent(path)}`, {
    body,
    cache: "no-store",
    headers,
    method: "PUT",
    signal,
  });
  let response = await send();
  if (response.status === 401 && !signal.aborted) {
    const renewed = await refreshPlatformSession();
    if (renewed) {
      await response.body?.cancel();
      response = await send();
    }
  }
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: { code?: string; message?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new PlatformRequestError(payload.error?.message || "上传服务暂时不可用，请稍后重试", response.status, payload.error?.code);
  }
  return payload.data;
}

export function formatBeijingDate(value: number | string | undefined) {
  if (!value) return "时间待确认";
  const date = new Date(typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function formatFen(value: number | undefined) {
  const fen = value ?? 0;
  return `¥${(fen / 100).toFixed(fen % 100 === 0 ? 0 : 2)}`;
}
