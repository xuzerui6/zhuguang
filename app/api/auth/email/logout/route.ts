import { NextResponse } from "next/server";
import { WEB_ACCESS_COOKIE, WEB_CONTACT_COOKIE, WEB_REFRESH_COOKIE } from "../../../../_lib/web-session";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: { code: "invalid_origin", message: "请求来源无效" } }, { status: 403 });
  const response = NextResponse.json({ data: { loggedOut: true } });
  for (const name of [WEB_ACCESS_COOKIE, WEB_REFRESH_COOKIE, WEB_CONTACT_COOKIE, "zg_web_device"]) response.cookies.delete(name);
  return response;
}
