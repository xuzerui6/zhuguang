import { NextRequest, NextResponse } from "next/server";
import { applyWebSecurityHeaders } from "./app/_lib/web-security";

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname !== "www.beijingzhuguang.top") {
    const response = NextResponse.next();
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
