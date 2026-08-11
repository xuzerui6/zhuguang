import { NextResponse } from "next/server";
import { WEB_ACCESS_COOKIE, WEB_CONTACT_COOKIE, WEB_REFRESH_COOKIE } from "../../../../_lib/web-session";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: { code: "invalid_origin", message: "请求来源无效" } }, { status: 403 });
  const appKey = process.env.ZHUGUANG_PILOT_APP_KEY;
  if (!appKey) return NextResponse.json({ error: { code: "auth_unconfigured", message: "登录服务尚未完成配置" } }, { status: 503 });
  const body = await request.json();
  const deviceId = request.headers.get("cookie")?.match(/(?:^|;\s*)zg_web_device=([^;]+)/u)?.[1] || "zhuguang-web";
  const baseUrl = (process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "");
  const upstream = await fetch(`${baseUrl}/api/v1/auth/email/verify`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-device-id": deviceId, "x-zhuguang-app-key": appKey },
    method: "POST",
    signal: AbortSignal.timeout(8_000),
  });
  const text = await upstream.text();
  if (!upstream.ok) return new NextResponse(text, { headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" }, status: upstream.status });
  const payload = JSON.parse(text) as { data: { accessToken: string; contactMasked?: string; phoneMasked?: string; refreshToken: string } };
  const response = NextResponse.json({ data: { authenticated: true } });
  const cookieOptions = { httpOnly: true, path: "/", sameSite: "strict" as const, secure: true };
  response.cookies.set(WEB_ACCESS_COOKIE, payload.data.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
  response.cookies.set(WEB_REFRESH_COOKIE, payload.data.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  response.cookies.set(WEB_CONTACT_COOKIE, payload.data.contactMasked || payload.data.phoneMasked || "已验证邮箱", { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  return response;
}
