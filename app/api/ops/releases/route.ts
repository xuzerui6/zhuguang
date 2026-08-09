import { NextResponse } from "next/server";

const fallbackApiUrl = "https://zhuguang-mobile-api.xuzerui6.workers.dev";

function configuration() {
  const appKey = process.env.ZHUGUANG_PILOT_APP_KEY;
  const operatorSecret = process.env.ZHUGUANG_OPERATOR_API_SECRET;
  if (!appKey || !operatorSecret) return null;
  return {
    appKey,
    baseUrl: (process.env.ZHUGUANG_MOBILE_API_URL || fallbackApiUrl).replace(/\/$/u, ""),
    operatorSecret,
  };
}

function upstreamHeaders(contentType?: string) {
  const config = configuration();
  if (!config) return null;
  const headers = new Headers({
    accept: "application/json",
    "x-operator-secret": config.operatorSecret,
    "x-request-id": `ops_${crypto.randomUUID()}`,
    "x-zhuguang-app-key": config.appKey,
  });
  if (contentType) headers.set("content-type", contentType);
  return { config, headers };
}

async function relay(response: Response) {
  const body = await response.text();
  return new NextResponse(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
    },
    status: response.status,
  });
}

function unavailable() {
  return NextResponse.json({ error: { code: "operator_proxy_unconfigured", message: "发布中心服务端凭据尚未配置" } }, { status: 503 });
}

export async function GET() {
  const upstream = upstreamHeaders();
  if (!upstream) return unavailable();
  const response = await fetch(`${upstream.config.baseUrl}/api/v1/operator/releases`, {
    cache: "no-store",
    headers: upstream.headers,
  });
  return relay(response);
}

export async function PUT(request: Request) {
  const upstream = upstreamHeaders("application/vnd.android.package-archive");
  if (!upstream) return unavailable();
  const form = await request.formData();
  const artifact = form.get("artifact");
  const versionCode = Number(form.get("versionCode"));
  const versionName = String(form.get("versionName") || "").trim();
  if (!(artifact instanceof File) || !artifact.name.toLowerCase().endsWith(".apk") || artifact.size < 1 || artifact.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: { code: "invalid_artifact", message: "请选择不超过 50 MB 的 APK 文件" } }, { status: 422 });
  }
  if (!Number.isInteger(versionCode) || versionCode < 1 || !/^\d+\.\d+\.\d+$/u.test(versionName)) {
    return NextResponse.json({ error: { code: "invalid_version", message: "请检查版本号与 versionCode" } }, { status: 422 });
  }
  upstream.headers.set("x-release-version-name", versionName);
  const response = await fetch(`${upstream.config.baseUrl}/api/v1/operator/releases/${versionCode}/artifact`, {
    body: await artifact.arrayBuffer(),
    headers: upstream.headers,
    method: "PUT",
  });
  return relay(response);
}

export async function POST(request: Request) {
  const upstream = upstreamHeaders("application/json");
  if (!upstream) return unavailable();
  const body = await request.json() as { action?: string; release?: Record<string, unknown>; versionCode?: number };
  const versionCode = Number(body.versionCode);
  let path = "/api/v1/operator/releases";
  let method = "POST";
  const payload: unknown = body.release;
  if (body.action && body.action !== "create") {
    if (!Number.isInteger(versionCode) || versionCode < 1 || !new Set(["notify", "pause", "policy", "publish"]).has(body.action)) {
      return NextResponse.json({ error: { code: "invalid_action", message: "版本操作无效" } }, { status: 422 });
    }
    path = `/api/v1/operator/releases/${versionCode}/${body.action}`;
    method = body.action === "policy" ? "PATCH" : "POST";
  }
  const response = await fetch(`${upstream.config.baseUrl}${path}`, {
    body: JSON.stringify(payload ?? {}),
    headers: upstream.headers,
    method,
  });
  return relay(response);
}
