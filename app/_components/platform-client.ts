"use client";

export class PlatformRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlatformRequestError";
    this.status = status;
  }
}

export async function platformRequest<T>(
  path: string,
  options: { body?: unknown; method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT" } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(`/api/platform?path=${encodeURIComponent(path)}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    method,
  });
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.data === undefined) {
    throw new PlatformRequestError(payload.error?.message || "服务暂时不可用，请稍后重试", response.status);
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
  return `¥${((value ?? 0) / 100).toFixed(0)}`;
}
