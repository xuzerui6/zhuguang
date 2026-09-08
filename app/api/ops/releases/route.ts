import { GET as platformGet, POST as platformPost, PATCH as platformPatch, PUT as platformPut } from "../../platform/route";
import { ApiError, failure, readJson } from "../../../../server/api/contracts";

function target(request: Request, path: string, init?: RequestInit) {
  const url = new URL(request.url);
  url.pathname = "/api/platform";
  url.search = "";
  url.searchParams.set("path", path);
  return new Request(url, init || request);
}

export async function GET(request: Request) {
  return platformGet(target(request, "/api/v1/operator/releases"));
}

export async function PUT(request: Request) {
  const code = Number(new URL(request.url).searchParams.get("versionCode"));
  if (!Number.isInteger(code) || code < 1 || request.headers.get("content-type")?.includes("multipart")) {
    return failure(new ApiError(422, "binary_upload_required", "请刷新页面并使用安装包上传入口"), crypto.randomUUID());
  }
  return platformPut(target(request, `/api/v1/operator/releases/${code}/artifact`));
}

export async function POST(request: Request) {
  try {
    const body = await readJson<{ action?: string; release?: Record<string, unknown>; versionCode?: number; confirmed?: boolean; reason?: string }>(request);
    const action = body.action || "create";
    if (!new Set(["create", "publish", "pause", "notify", "policy"]).has(action)) throw new ApiError(422, "invalid_action", "版本操作无效");
    if (action !== "create" && (!Number.isInteger(body.versionCode) || Number(body.versionCode) < 1)) throw new ApiError(422, "invalid_version", "版本代码无效");
    const path = action === "create" ? "/api/v1/operator/releases" : `/api/v1/operator/releases/${body.versionCode}/${action}`;
    const headers = new Headers(request.headers);
    headers.delete("content-length"); headers.set("content-type", "application/json");
    const forwarded = target(request, path, { headers, body: JSON.stringify({ ...body.release, confirmed: body.confirmed ?? body.release?.confirmed, reason: body.reason ?? body.release?.reason }), method: action === "policy" ? "PATCH" : "POST" });
    return action === "policy" ? platformPatch(forwarded) : platformPost(forwarded);
  } catch (error) { return failure(error, crypto.randomUUID()); }
}
