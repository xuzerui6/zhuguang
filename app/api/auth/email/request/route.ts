import { NextResponse } from "next/server";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { code: "invalid_origin", message: "请求来源无效" } }, { status: 403 });
  const appKey = process.env.ZHUGUANG_PILOT_APP_KEY;
  if (!appKey) return NextResponse.json({ error: { code: "auth_unconfigured", message: "登录服务尚未完成配置" } }, { status: 503 });
  const body = await request.json() as { email?: unknown; turnstileToken?: unknown };
  const deviceId = `web_${crypto.randomUUID()}`;
  const baseUrl = (process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "");
  const upstream = await fetch(`${baseUrl}/api/v1/auth/email/request`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-device-id": deviceId,
      "x-zhuguang-app-key": appKey,
    },
    method: "POST",
    signal: AbortSignal.timeout(8_000),
  });
  const response = new NextResponse(await upstream.text(), {
    headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
    status: upstream.status,
  });
  if (upstream.ok) response.cookies.set("zg_web_device", deviceId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60, path: "/", sameSite: "strict", secure: true });
  return response;
}
