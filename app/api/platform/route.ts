import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getWebSession, WEB_ACCESS_COOKIE } from "../../_lib/web-session";

const fallbackApiUrl = "https://api.beijingzhuguang.top";

const publicPatterns = [
  /^\/api\/v1\/coaches(?:\/\d+\/(?:slots|reviews)|\/\d+)?(?:\?.*)?$/u,
  /^\/api\/v1\/health$/u,
];

function allowedForSession(path: string, method: string, permissions: string[]) {
  if (publicPatterns.some((pattern) => pattern.test(path))) return method === "GET";
  if (path === "/api/v1/service-leads") return method === "POST";
  if (path.startsWith("/api/v1/operator/")) return permissions.includes("ops:manage");
  if (path.startsWith("/api/v1/coach/")) return permissions.includes("coach:work");
  return permissions.includes("student:read") && /^\/api\/v1\/(?:bootstrap|bookings|conversations|favorites|learner-profiles|me|notifications|reschedule-proposals|reviews|support-tickets|training-records)(?:\/.*)?(?:\?.*)?$/u.test(path);
}

async function relay(request: Request) {
  const method = request.method.toUpperCase();
  const requestUrl = new URL(request.url);
  const path = requestUrl.searchParams.get("path") || "";
  if (!path.startsWith("/api/v1/") || path.startsWith("//")) {
    return NextResponse.json({ error: { code: "invalid_path", message: "接口路径无效" } }, { status: 422 });
  }
  const session = await getWebSession();
  if (!allowedForSession(path, method, session.permissions)) {
    const authenticated = session.isAuthenticated;
    return NextResponse.json({ error: {
      code: authenticated ? "role_forbidden" : "authentication_required",
      message: authenticated ? "当前账号没有执行此操作的权限" : "登录状态未传递成功，请重新登录",
    } }, { status: authenticated ? 403 : 401 });
  }
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== requestUrl.origin) return NextResponse.json({ error: { code: "invalid_origin", message: "请求来源无效" } }, { status: 403 });
  }

  const appKey = process.env.ZHUGUANG_PILOT_APP_KEY;
  if (!appKey) return NextResponse.json({ error: { code: "proxy_unconfigured", message: "平台服务尚未完成配置" } }, { status: 503 });
  const headers = new Headers({
    accept: "application/json",
    "x-app-platform": "web",
    "x-device-id": "zhuguang-web",
    "x-request-id": `web_${crypto.randomUUID()}`,
    "x-zhuguang-app-key": appKey,
  });
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(WEB_ACCESS_COOKIE)?.value;
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  if (session.email) headers.set("oai-authenticated-user-email", session.email);
  const trustedProxySecret = process.env.ZHUGUANG_OPERATOR_API_SECRET;
  if (session.email && trustedProxySecret) headers.set("x-operator-secret", trustedProxySecret);
  if (path.startsWith("/api/v1/operator/")) {
    const operatorSecret = process.env.ZHUGUANG_OPERATOR_API_SECRET;
    if (!operatorSecret) return NextResponse.json({ error: { code: "operator_proxy_unconfigured", message: "运营服务尚未完成配置" } }, { status: 503 });
    headers.set("x-operator-secret", operatorSecret);
    headers.set("x-operator-actor", session.email || session.accountId || "operator");
  }
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(idempotencyKey)) {
    headers.set("idempotency-key", idempotencyKey);
  }
  const baseUrl = (process.env.ZHUGUANG_MOBILE_API_URL || fallbackApiUrl).replace(/\/$/u, "");
  const upstream = await fetch(`${baseUrl}${path}`, {
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    headers,
    method,
    signal: AbortSignal.timeout(10_000),
  });
  return new NextResponse(await upstream.text(), {
    headers: { "cache-control": "no-store", "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8" },
    status: upstream.status,
  });
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;
