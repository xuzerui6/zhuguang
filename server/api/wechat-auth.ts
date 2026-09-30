import type { MobileSession } from "../../app/mobile/types";
import { ApiError, type ApiEnv } from "./contracts";
import { requestEmailOtpD1, verifyEmailOtpD1 } from "./email-auth";
import { authenticateStudent, issueWechatSessionD1, logoutD1 } from "./repository";
import { getClientIp, keyedHash, randomId, randomToken, sha256Hex } from "./security";

type Row = Record<string, unknown>;
type Fetcher = typeof fetch;

export type WechatExchangeResult =
  | { status: "authenticated"; session: MobileSession }
  | { status: "link_required"; linkToken: string; expiresAt: number; methods: { email: true; phone: false } };

function database(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function requireWechatConfig(env: ApiEnv) {
  const appId = env.WECHAT_MINIAPP_APP_ID?.trim();
  const appSecret = env.WECHAT_MINIAPP_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new ApiError(503, "wechat_not_configured", "微信登录尚未完成配置");
  return { appId, appSecret };
}

function deviceIdFrom(request: Request) {
  const deviceId = request.headers.get("x-device-id")?.trim().slice(0, 160) || "";
  if (!/^wx_[A-Za-z0-9_-]{12,150}$/u.test(deviceId)) {
    throw new ApiError(422, "invalid_device", "小程序设备标识无效");
  }
  return deviceId;
}

async function requestHashes(request: Request, env: ApiEnv) {
  const secret = env.AUTH_HASH_SECRET ?? "";
  const deviceId = deviceIdFrom(request);
  const [deviceHash, ipHash] = await Promise.all([
    keyedHash(deviceId, secret),
    keyedHash(getClientIp(request), secret),
  ]);
  return { deviceHash, deviceId, ipHash };
}

async function assertWechatRateLimit(request: Request, env: ApiEnv) {
  const hashes = await requestHashes(request, env);
  const since = Date.now() - 60 * 60_000;
  const db = database(env);
  const [ip, device] = await Promise.all([
    db.prepare("SELECT count(*) AS count FROM wechat_auth_events WHERE ip_hash = ? AND created_at >= ?").bind(hashes.ipHash, since).first<Row>(),
    db.prepare("SELECT count(*) AS count FROM wechat_auth_events WHERE device_hash = ? AND created_at >= ?").bind(hashes.deviceHash, since).first<Row>(),
  ]);
  if (numberValue(ip?.count) >= 30 || numberValue(device?.count) >= 12) {
    throw new ApiError(429, "wechat_rate_limited", "微信登录请求过于频繁，请稍后再试");
  }
  return hashes;
}

async function readLinkChallenge(request: Request, linkToken: unknown, env: ApiEnv) {
  if (typeof linkToken !== "string" || linkToken.length < 32 || linkToken.length > 180) {
    throw new ApiError(422, "invalid_link_token", "账号关联状态无效，请重新微信登录");
  }
  const { appId } = requireWechatConfig(env);
  const { deviceHash, deviceId } = await requestHashes(request, env);
  const tokenHash = await sha256Hex(linkToken);
  const row = await database(env).prepare(`
    SELECT * FROM wechat_link_challenges
    WHERE app_id = ? AND token_hash = ? AND device_hash = ?
    LIMIT 1
  `).bind(appId, tokenHash, deviceHash).first<Row>();
  if (!row || row.consumed_at) throw new ApiError(400, "wechat_link_invalid", "账号关联已失效，请重新微信登录");
  if (numberValue(row.expires_at) <= Date.now()) throw new ApiError(400, "wechat_link_expired", "账号关联已过期，请重新微信登录");
  if (numberValue(row.attempts) >= 5) throw new ApiError(423, "wechat_link_locked", "关联验证次数过多，请重新微信登录");
  return { deviceId, row };
}

export async function exchangeWechatCodeD1(
  request: Request,
  input: { code: unknown },
  env: ApiEnv,
  fetcher: Fetcher = fetch,
): Promise<WechatExchangeResult> {
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{6,128}$/u.test(code)) throw new ApiError(422, "invalid_wechat_code", "微信登录凭证无效");
  const { appId, appSecret } = requireWechatConfig(env);
  const db = database(env);
  const { deviceHash, deviceId, ipHash } = await assertWechatRateLimit(request, env);
  const codeHash = await keyedHash(code, env.AUTH_HASH_SECRET ?? "");
  const existingCode = await db.prepare("SELECT id FROM wechat_auth_events WHERE app_id = ? AND code_hash = ?").bind(appId, codeHash).first<Row>();
  if (existingCode) throw new ApiError(409, "wechat_code_replayed", "微信登录凭证已使用，请重新登录");

  const eventId = randomId("wechat_event");
  const now = Date.now();
  await db.prepare(`
    INSERT INTO wechat_auth_events (id, app_id, code_hash, open_id_hash, ip_hash, device_hash, outcome, created_at)
    VALUES (?, ?, ?, NULL, ?, ?, 'started', ?)
  `).bind(eventId, appId, codeHash, ipHash, deviceHash, now).run();

  let payload: { openid?: string; unionid?: string; errcode?: number; errmsg?: string };
  try {
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", appId);
    url.searchParams.set("secret", appSecret);
    url.searchParams.set("js_code", code);
    url.searchParams.set("grant_type", "authorization_code");
    const response = await fetcher(url, { method: "GET", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`wechat_http_${response.status}`);
    payload = await response.json() as typeof payload;
  } catch {
    await db.prepare("UPDATE wechat_auth_events SET outcome = 'provider_unavailable' WHERE id = ?").bind(eventId).run();
    throw new ApiError(502, "wechat_provider_unavailable", "微信登录服务暂时不可用，请重试");
  }
  if (payload.errcode || !payload.openid) {
    await db.prepare("UPDATE wechat_auth_events SET outcome = 'code_rejected' WHERE id = ?").bind(eventId).run();
    throw new ApiError(400, "wechat_code_invalid", "微信登录凭证已失效，请重新登录");
  }

  const [openIdHash, unionIdHash] = await Promise.all([
    keyedHash(payload.openid, env.AUTH_HASH_SECRET ?? ""),
    payload.unionid ? keyedHash(payload.unionid, env.AUTH_HASH_SECRET ?? "") : Promise.resolve(null),
  ]);
  const identity = await db.prepare(`
    SELECT user_id FROM wechat_identities
    WHERE app_id = ? AND open_id_hash = ? AND status = 'active'
    LIMIT 1
  `).bind(appId, openIdHash).first<Row>();
  if (identity) {
    await db.batch([
      db.prepare("UPDATE wechat_identities SET last_login_at = ?, updated_at = ? WHERE app_id = ? AND open_id_hash = ?").bind(now, now, appId, openIdHash),
      db.prepare("UPDATE wechat_auth_events SET open_id_hash = ?, outcome = 'authenticated' WHERE id = ?").bind(openIdHash, eventId),
    ]);
    return { status: "authenticated", session: await issueWechatSessionD1(stringValue(identity.user_id), deviceId, env) };
  }

  const linkToken = randomToken("zgw");
  const linkId = randomId("wechat_link");
  const expiresAt = now + 10 * 60_000;
  await db.batch([
    db.prepare(`
      INSERT INTO wechat_link_challenges
        (id, app_id, open_id_hash, union_id_hash, token_hash, device_hash, ip_hash, attempts, expires_at, consumed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)
    `).bind(linkId, appId, openIdHash, unionIdHash, await sha256Hex(linkToken), deviceHash, ipHash, expiresAt, now),
    db.prepare("UPDATE wechat_auth_events SET open_id_hash = ?, outcome = 'link_required' WHERE id = ?").bind(openIdHash, eventId),
  ]);
  return { status: "link_required", linkToken, expiresAt, methods: { email: true, phone: false } };
}

export async function requestWechatLinkEmailD1(
  request: Request,
  input: { linkToken: unknown; email: unknown },
  env: ApiEnv,
) {
  await readLinkChallenge(request, input.linkToken, env);
  return requestEmailOtpD1(request, { email: input.email }, env, { trustedWechatLink: true });
}

export async function verifyWechatLinkEmailD1(
  request: Request,
  input: { linkToken: unknown; challengeId: unknown; code: unknown; favoriteCoachIds?: unknown },
  env: ApiEnv,
) {
  const { appId } = requireWechatConfig(env);
  const { deviceId, row } = await readLinkChallenge(request, input.linkToken, env);
  const challengeId = typeof input.challengeId === "string" ? input.challengeId.trim() : "";
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!challengeId || !/^\d{6}$/u.test(code)) throw new ApiError(422, "invalid_otp", "请输入 6 位验证码");
  const existing = await database(env).prepare("SELECT user_id FROM wechat_identities WHERE app_id = ? AND open_id_hash = ? LIMIT 1")
    .bind(appId, row.open_id_hash).first<Row>();
  if (existing) throw new ApiError(409, "wechat_identity_conflict", "该微信身份已关联其他账号");

  const favoriteCoachIds = Array.isArray(input.favoriteCoachIds)
    ? input.favoriteCoachIds.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 100)
    : [];
  let session: MobileSession;
  try {
    session = await verifyEmailOtpD1(challengeId, code, deviceId, favoriteCoachIds, env);
  } catch (error) {
    await database(env).prepare("UPDATE wechat_link_challenges SET attempts = attempts + 1 WHERE id = ? AND consumed_at IS NULL").bind(row.id).run();
    throw error;
  }
  const identity = await authenticateStudent(new Request("https://api.local/api/v1/me", {
    headers: { authorization: `Bearer ${session.accessToken}` },
  }), env);
  const now = Date.now();
  try {
    await database(env).batch([
      database(env).prepare(`
        INSERT INTO wechat_identities
          (id, app_id, open_id_hash, union_id_hash, user_id, status, linked_at, last_login_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).bind(randomId("wechat_identity"), appId, row.open_id_hash, row.union_id_hash || null, identity!.userId, now, now, now, now),
      database(env).prepare("UPDATE wechat_link_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, row.id),
    ]);
  } catch {
    await logoutD1(identity!, env);
    throw new ApiError(409, "wechat_identity_conflict", "该微信身份已关联其他账号，请重新登录");
  }
  return { status: "authenticated" as const, session };
}
