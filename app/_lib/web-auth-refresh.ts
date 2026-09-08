export const WEB_COOKIE_OPTIONS = { httpOnly: true, path: "/", sameSite: "strict" as const, secure: true };
export const WEB_COOKIE_NAMES = ["zg_web_access", "zg_web_refresh", "zg_web_contact", "zg_web_device"] as const;
export type WebAuthEnvironment = { [key: string]: string | undefined; ZHUGUANG_MOBILE_API_URL?: string; ZHUGUANG_PILOT_APP_KEY?: string; ZHUGUANG_OPERATOR_API_SECRET?: string };
export type CookieChange = { name: string; value: string; maxAge: number };
export function readWebCookie(request: Request, name: string) {
  return (request.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
export function clearedWebCookies(): CookieChange[] { return WEB_COOKIE_NAMES.map((name) => ({ name, value: "", maxAge: 0 })); }
export function sessionCookieChanges(session: { accessToken: string; refreshToken: string; contactMasked?: string }, device: string): CookieChange[] {
  return [{ name: "zg_web_access", value: session.accessToken, maxAge: 900 }, { name: "zg_web_refresh", value: session.refreshToken, maxAge: 2592000 }, { name: "zg_web_contact", value: encodeURIComponent(session.contactMasked || "已验证账号"), maxAge: 2592000 }, { name: "zg_web_device", value: device, maxAge: 2592000 }];
}

export async function renewWebSession(request: Request, env: WebAuthEnvironment, fetcher: typeof fetch = fetch, force = false): Promise<{ changes: CookieChange[]; unavailable?: boolean; authenticated?: boolean }> {
  const access = readWebCookie(request, "zg_web_access");
  const refresh = readWebCookie(request, "zg_web_refresh");
  if (!access && !refresh) return { changes: [] };
  if (access && !force) return { changes: [] };
  const device = readWebCookie(request, "zg_web_device") || "zhuguang-web";
  if (!env.ZHUGUANG_PILOT_APP_KEY) return { changes: [], unavailable: true };
  const origin = (env.ZHUGUANG_MOBILE_API_URL || "https://api.beijingzhuguang.top").replace(/\/$/u, "");
  const headers = new Headers({ "x-device-id": device, "x-app-platform": "web", "x-zhuguang-app-key": env.ZHUGUANG_PILOT_APP_KEY });
  try {
    if (!refresh) return { changes: clearedWebCookies(), authenticated: false };
    const secret = env.ZHUGUANG_OPERATOR_API_SECRET;
    if (!secret) return { changes: [], unavailable: true };
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`web-refresh:${device}:${refresh}`)));
    headers.set("idempotency-key", Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(""));
    headers.set("x-operator-secret", secret);
    headers.set("content-type", "application/json");
    const response = await fetcher(`${origin}/api/v1/auth/refresh`, { method: "POST", headers, body: JSON.stringify({ refreshToken: refresh }), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (response.status === 401 || response.status === 403) return { changes: clearedWebCookies(), authenticated: false };
    if (!response.ok) return { changes: [], unavailable: true };
    const payload = await response.json() as { data: { accessToken: string; refreshToken: string; contactMasked?: string } };
    if (!payload.data?.accessToken || !payload.data.refreshToken) return { changes: [], unavailable: true };
    return { changes: sessionCookieChanges(payload.data, device), authenticated: true };
  } catch { return { changes: [], unavailable: true }; }
}

export function forwardRenewedCookies(request: Request, changes: CookieChange[]) {
  const headers = new Headers(request.headers);
  const names = new Set(changes.map((item) => item.name));
  const original = (headers.get("cookie") || "").split(";").map((part) => part.trim()).filter((part) => part && !names.has(part.split("=")[0]));
  headers.set("cookie", [...original, ...changes.filter((item) => item.maxAge > 0).map((item) => `${item.name}=${item.value}`)].join("; "));
  return headers;
}
