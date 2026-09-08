import { NextResponse } from "next/server";
import { WEB_ACCESS_COOKIE, WEB_CONTACT_COOKIE, WEB_REFRESH_COOKIE } from "../../../../_lib/web-session";
import { readWebCookie } from "../../../../_lib/web-auth-refresh";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: { code: "invalid_origin", message: "请求来源无效" } }, { status: 403 });
  const refreshToken = readWebCookie(request, WEB_REFRESH_COOKIE);
  if (refreshToken) {
    try {
      const upstream = await fetch(`${(process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "")}/api/v1/auth/logout-refresh`, { method: "POST", headers: { "content-type": "application/json", "x-device-id": readWebCookie(request, "zg_web_device") || "zhuguang-web", "x-zhuguang-app-key": process.env.ZHUGUANG_PILOT_APP_KEY || "" }, body: JSON.stringify({ refreshToken }), signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) throw new Error("logout unavailable");
    } catch { return NextResponse.json({ error: { code: "logout_unavailable", message: "退出未完成，请重试" } }, { status: 503 }); }
  }
  const response = NextResponse.json({ data: { loggedOut: true } });
  for (const name of [WEB_ACCESS_COOKIE, WEB_REFRESH_COOKIE, WEB_CONTACT_COOKIE, "zg_web_device", "CF_Authorization"]) response.cookies.delete(name);
  return response;
}
