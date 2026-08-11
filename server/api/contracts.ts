export interface ApiEnv {
  APP_ENV?: string;
  AUTH_HASH_SECRET?: string;
  COACH_EMAIL_ALLOWLIST?: string;
  OPS_EMAIL_ALLOWLIST?: string;
  CORS_ORIGINS?: string;
  DB?: D1Database;
  MEDIA?: R2Bucket;
  RELEASES?: R2Bucket;
  MOBILE_API_ORIGIN?: string;
  PHONE_ENCRYPTION_KEY?: string;
  PILOT_APP_KEY?: string;
  PILOT_PHONE_HASHES?: string;
  SMS_NOTIFICATION_TEMPLATE_ID?: string;
  SMS_DAILY_BUDGET?: string;
  UPDATE_DOWNLOAD_SECRET?: string;
  OPERATOR_API_SECRET?: string;
  JPUSH_APP_KEY?: string;
  JPUSH_MASTER_SECRET?: string;
  TENCENTCLOUD_SECRET_ID?: string;
  TENCENTCLOUD_SECRET_KEY?: string;
  TENCENT_SMS_REGION?: string;
  TENCENT_SMS_SDK_APP_ID?: string;
  TENCENT_SMS_SIGN_NAME?: string;
  TENCENT_SMS_TEMPLATE_ID?: string;
  TENCENT_SES_REGION?: string;
  TENCENT_SES_FROM_EMAIL?: string;
  TENCENT_SES_FROM_NAME?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface ApiExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export class ApiError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;
  status: number;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function success<T>(data: T, requestId: string, meta?: Record<string, unknown>, status = 200) {
  return jsonResponse(meta ? { data, meta } : { data }, status, requestId);
}

export function failure(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return jsonResponse({
      error: {
        code: error.code,
        fieldErrors: error.fieldErrors,
        message: error.message,
        requestId,
      },
    }, error.status, requestId);
  }
  console.error("Unhandled API error", { error, requestId });
  return jsonResponse({
    error: {
      code: "internal_error",
      message: "服务暂时不可用，请稍后重试",
      requestId,
    },
  }, 500, requestId);
}

function jsonResponse(payload: unknown, status: number, requestId: string) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
    status,
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_768) throw new ApiError(413, "payload_too_large", "请求内容过大");
  try {
    return await request.json() as T;
  } catch {
    throw new ApiError(400, "invalid_json", "请求内容格式不正确");
  }
}

export function requireString(value: unknown, field: string, maxLength = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new ApiError(422, "validation_failed", "请检查提交内容", { [field]: "内容无效" });
  }
  return value.trim();
}
