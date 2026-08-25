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
  const response = await fetch(`/api/platform?path=${encodeURIComponent(path)}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    headers,
    method,
  });
  const payload = await response.json() as { data?: T; error?: { code?: string; fieldErrors?: Record<string, string>; message?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new PlatformRequestError(payload.error?.message || "服务暂时不可用，请稍后重试", response.status, payload.error?.code, payload.error?.fieldErrors);
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
