import { NextRequest, NextResponse } from "next/server";
import { applyWebSecurityHeaders } from "./app/_lib/web-security";
import { forwardRenewedCookies, renewWebSession, WEB_COOKIE_OPTIONS } from "./app/_lib/web-auth-refresh";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname !== "www.beijingzhuguang.top") {
    const needsSession = /^\/(student|coach-workspace|ops|login)(\/|$)/u.test(request.nextUrl.pathname) || /^\/api\/(platform|ops)(\/|$)/u.test(request.nextUrl.pathname);
    const result = needsSession ? await renewWebSession(request, process.env) : { changes: [] };
    if (result.unavailable && request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: { code: "session_service_unavailable", message: "登录服务暂时无法连接，请稍后重试" } }, { status: 503, headers: applyWebSecurityHeaders(new Headers({ "cache-control": "no-store" })) });
    const response = NextResponse.next({ request: { headers: forwardRenewedCookies(request, result.changes) } });
    for (const cookie of result.changes) response.cookies.set(cookie.name, cookie.value, { ...WEB_COOKIE_OPTIONS, maxAge: cookie.maxAge });
    if (needsSession) response.headers.set("cache-control", "private, no-store");
    applyWebSecurityHeaders(response.headers);
    return response;
  }
  const canonical = request.nextUrl.clone();
  canonical.hostname = "beijingzhuguang.top";
  canonical.port = "";
  canonical.protocol = "https:";
  const response = NextResponse.redirect(canonical, 301);
  applyWebSecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: "/:path*",
};
