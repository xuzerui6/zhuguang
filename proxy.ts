import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname !== "www.beijingzhuguang.top") return NextResponse.next();
  const canonical = request.nextUrl.clone();
  canonical.hostname = "beijingzhuguang.top";
  canonical.port = "";
  canonical.protocol = "https:";
  return NextResponse.redirect(canonical, 301);
}

export const config = {
  matcher: "/:path*",
};
