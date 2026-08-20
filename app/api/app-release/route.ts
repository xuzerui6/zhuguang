const mobileApiOrigin = process.env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top";

export async function GET() {
  try {
    const response = await fetch(`${mobileApiOrigin}/api/v1/public/app/releases/latest`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    return new Response(response.body, {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
      status: response.status,
    });
  } catch {
    return Response.json({
      error: { code: "release_service_unavailable", message: "下载服务暂时不可用" },
    }, { status: 503 });
  }
}
