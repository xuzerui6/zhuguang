import { ApiError, type ApiEnv } from "./contracts";

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64ToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function randomToken(prefix: "zga" | "zgr" | "zgw") {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${prefix}_${bytesToBase64Url(bytes)}`;
}

export function randomOtp() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, "0");
}

export async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function keyedHash(value: string, secret: string) {
  if (!secret) throw new ApiError(503, "server_configuration", "服务安全配置尚未完成");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizePhone(value: unknown) {
  const phone = typeof value === "string" ? value.replace(/[\s-]/gu, "") : "";
  if (!/^1[3-9]\d{9}$/u.test(phone)) {
    throw new ApiError(422, "invalid_phone", "请输入有效的中国大陆手机号", { phone: "手机号格式不正确" });
  }
  return phone;
}

export function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new ApiError(422, "invalid_email", "请输入有效的邮箱地址", { email: "邮箱格式不正确" });
  }
  return email;
}

export function maskPhone(phone: string) {
  return `${phone.slice(0, 3)} **** ${phone.slice(-4)}`;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "已验证邮箱";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.min(5, Math.max(2, local.length - visible.length)))}@${domain}`;
}

export async function encryptContact(value: string, encodedKey: string) {
  if (!encodedKey) throw new ApiError(503, "server_configuration", "联系信息加密配置尚未完成");
  let rawKey: Uint8Array;
  try {
    rawKey = base64ToBytes(encodedKey);
  } catch {
    throw new ApiError(503, "server_configuration", "联系信息加密配置无效");
  }
  if (rawKey.byteLength !== 32) throw new ApiError(503, "server_configuration", "联系信息加密密钥必须为 32 字节");
  const keyMaterial = new Uint8Array(rawKey.byteLength);
  keyMaterial.set(rawKey);
  const key = await crypto.subtle.importKey("raw", keyMaterial.buffer, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, key, encoder.encode(value)));
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(encrypted)}`;
}

export async function decryptContact(payload: string, encodedKey: string) {
  const [, ivValue, encryptedValue] = payload.split(".");
  if (!ivValue || !encryptedValue || !encodedKey) throw new ApiError(503, "server_configuration", "联系信息解密配置无效");
  try {
    const rawKey = base64ToBytes(encodedKey);
    const keyMaterial = new Uint8Array(rawKey.byteLength);
    keyMaterial.set(rawKey);
    const ivSource = base64ToBytes(ivValue);
    const iv = new Uint8Array(ivSource.byteLength);
    iv.set(ivSource);
    const encryptedSource = base64ToBytes(encryptedValue);
    const encrypted = new Uint8Array(encryptedSource.byteLength);
    encrypted.set(encryptedSource);
    const key = await crypto.subtle.importKey("raw", keyMaterial.buffer, "AES-GCM", false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ iv: iv.buffer, name: "AES-GCM" }, key, encrypted.buffer);
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new ApiError(503, "contact_decryption_failed", "联系信息服务暂时不可用");
  }
}

export const encryptPhone = encryptContact;
export const decryptPhone = decryptContact;

export function getClientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

export function assertPilotApp(request: Request, env: ApiEnv) {
  if (!env.PILOT_APP_KEY) return;
  if (request.headers.get("x-zhuguang-app-key") !== env.PILOT_APP_KEY) {
    throw new ApiError(403, "app_access_denied", "当前客户端没有逐光服务访问权限");
  }
}

export async function assertPilotPhone(phoneHash: string, env: ApiEnv) {
  if (!env.PILOT_PHONE_HASHES) return;
  const allowed = env.PILOT_PHONE_HASHES.split(",").map((item) => item.trim()).filter(Boolean);
  if (!allowed.includes(phoneHash)) throw new ApiError(403, "pilot_not_invited", "该手机号尚未加入逐光定向体验名单");
}

export async function verifyTurnstile(request: Request, token: unknown, env: ApiEnv) {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.APP_ENV === "production") throw new ApiError(503, "turnstile_unavailable", "安全验证服务尚未完成配置");
    return;
  }
  if (typeof token !== "string" || !token) throw new ApiError(422, "turnstile_required", "请先完成人机验证");
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: getClientIp(request),
  });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    body,
    method: "POST",
  });
  const result = await response.json() as { action?: string; success?: boolean };
  if (!result.success) throw new ApiError(400, "turnstile_failed", "安全验证未通过，请重试");
}
