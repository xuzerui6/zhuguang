import { NextResponse } from "next/server";
import { renewWebSession, WEB_COOKIE_OPTIONS } from "../../../../_lib/web-auth-refresh";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: { code: "invalid_origin", message: "请求来源无效" } }, { status: 403 });
  const result = await renewWebSession(request, process.env, fetch, true);
  const response = NextResponse.json(result.unavailable ? { error: { code: "session_service_unavailable", message: "登录服务暂时不可用，请重试" } } : { data: { authenticated: result.authenticated === true } }, { status: result.unavailable ? 503 : result.authenticated ? 200 : 401, headers: { "cache-control": "no-store" } });
  for (const cookie of result.changes) response.cookies.set(cookie.name, cookie.value, { ...WEB_COOKIE_OPTIONS, maxAge: cookie.maxAge });
  return response;
}
