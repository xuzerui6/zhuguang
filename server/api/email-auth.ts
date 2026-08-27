import type { AccountMode, CoachAccountSummary, MobileSession } from "../../app/mobile/types";
import { ApiError, type ApiEnv } from "./contracts";
import { sendEmailOtp } from "./email";
import {
  encryptContact,
  getClientIp,
  keyedHash,
  maskEmail,
  normalizeEmail,
  randomId,
  randomOtp,
  randomToken,
  sha256Hex,
  verifyTurnstile,
} from "./security";

type Row = Record<string, unknown>;
const PRIMARY_OPERATOR_EMAIL = "xuzerui6@gmail.com";
const NATIVE_OTP_MIN_VERSION_CODE = { android: 16, ios: 19 } as const;
const NATIVE_INSTALLATION_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const NATIVE_DEVICE_ID_PATTERN = /^device_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

async function isRegisteredNativeOtpRequest(request: Request, env: ApiEnv, db: D1Database) {
  const deviceId = request.headers.get("x-device-id")?.trim() ?? "";
  const platform = request.headers.get("x-app-platform");
  const versionCode = Number(request.headers.get("x-app-version-code") ?? 0);
  if (
    (platform !== "android" && platform !== "ios")
    || !NATIVE_DEVICE_ID_PATTERN.test(deviceId)
    || !Number.isInteger(versionCode)
    || versionCode < NATIVE_OTP_MIN_VERSION_CODE[platform]
    || !env.PILOT_APP_KEY
    || request.headers.get("x-zhuguang-app-key") !== env.PILOT_APP_KEY
  ) return false;

  const installation = await db.prepare(`
    SELECT id FROM app_installations
    WHERE id = ? AND platform = ? AND status = 'active'
      AND app_version_code >= ? AND last_seen_at >= ?
    LIMIT 1
  `).bind(deviceId, platform, NATIVE_OTP_MIN_VERSION_CODE[platform], Date.now() - NATIVE_INSTALLATION_MAX_AGE_MS).first<Row>();
  return Boolean(installation);
}

export async function requestEmailOtpD1(request: Request, input: { email: unknown; turnstileToken?: unknown }, env: ApiEnv) {
  const db = database(env);
  if (!await isRegisteredNativeOtpRequest(request, env, db)) {
    await verifyTurnstile(request, input.turnstileToken, env);
  }
  const email = normalizeEmail(input.email);
  const hashSecret = env.AUTH_HASH_SECRET ?? "";
  const emailHash = await keyedHash(email, hashSecret);
  const ipHash = await keyedHash(getClientIp(request), hashSecret);
  const deviceHash = await keyedHash(request.headers.get("x-device-id")?.slice(0, 160) || "unknown-device", hashSecret);
  const now = Date.now();
  const oneHourAgo = now - 60 * 60_000;
  const latest = await db.prepare(`
    SELECT resend_after, locked_until FROM email_auth_challenges
    WHERE email_hash = ? ORDER BY created_at DESC LIMIT 1
  `).bind(emailHash).first<Row>();
  if (numberValue(latest?.locked_until) > now) throw new ApiError(423, "otp_locked", "验证请求已锁定，请 30 分钟后重试");
  if (numberValue(latest?.resend_after) > now) {
    const retryAfter = Math.ceil((numberValue(latest?.resend_after) - now) / 1000);
    throw new ApiError(429, "otp_resend_too_soon", `请在 ${retryAfter} 秒后重新获取验证码`);
  }
  const [emailCount, ipCount, deviceCount] = await Promise.all([
    db.prepare("SELECT count(*) AS count FROM email_auth_challenges WHERE email_hash = ? AND created_at >= ?").bind(emailHash, oneHourAgo).first<Row>(),
    db.prepare("SELECT count(*) AS count FROM email_auth_challenges WHERE ip_hash = ? AND created_at >= ?").bind(ipHash, oneHourAgo).first<Row>(),
    db.prepare("SELECT count(*) AS count FROM email_auth_challenges WHERE device_hash = ? AND created_at >= ?").bind(deviceHash, oneHourAgo).first<Row>(),
  ]);
  if (numberValue(emailCount?.count) >= 5 || numberValue(ipCount?.count) >= 20 || numberValue(deviceCount?.count) >= 8) {
    throw new ApiError(429, "otp_rate_limited", "验证码请求过于频繁，请稍后再试");
  }

  const challengeId = randomId("email_challenge");
  const code = env.APP_ENV === "production" ? randomOtp() : "888888";
  const [codeHash, emailEncrypted] = await Promise.all([
    keyedHash(`${challengeId}:${code}`, hashSecret),
    encryptContact(email, env.PHONE_ENCRYPTION_KEY ?? ""),
  ]);
  const domain = email.split("@")[1];
  await db.prepare(`
    INSERT INTO email_auth_challenges
      (id, email_hash, email_encrypted, email_domain, code_hash, ip_hash, device_hash, attempts, expires_at, resend_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).bind(challengeId, emailHash, emailEncrypted, domain, codeHash, ipHash, deviceHash, now + 5 * 60_000, now + 60_000, now).run();

  const deliveryId = randomId("email_delivery");
  await db.prepare(`
    INSERT INTO email_deliveries (id, challenge_id, recipient_hash, template, status, attempt_count, created_at, updated_at)
    VALUES (?, ?, ?, 'login_otp', 'pending', 0, ?, ?)
  `).bind(deliveryId, challengeId, emailHash, now, now).run();
  try {
    const providerMessageId = await sendEmailOtp(email, code, env);
    await db.prepare("UPDATE email_deliveries SET status = 'sent', attempt_count = 1, provider_message_id = ?, updated_at = ? WHERE id = ?")
      .bind(providerMessageId, Date.now(), deliveryId).run();
  } catch (error) {
    await db.batch([
      db.prepare("DELETE FROM email_auth_challenges WHERE id = ?").bind(challengeId),
      db.prepare("UPDATE email_deliveries SET status = 'failed', attempt_count = 1, last_error = ?, updated_at = ? WHERE id = ?")
        .bind(error instanceof Error ? error.message.slice(0, 300) : "unknown", Date.now(), deliveryId),
    ]);
    throw error;
  }
  return { challengeId, expiresIn: 300, retryAfter: 60 };
}

export async function verifyEmailOtpD1(
  challengeId: string,
  code: string,
  deviceId: string,
  localFavoriteCoachIds: number[],
  env: ApiEnv,
): Promise<MobileSession> {
  const db = database(env);
  const now = Date.now();
  const challenge = await db.prepare("SELECT * FROM email_auth_challenges WHERE id = ?").bind(challengeId).first<Row>();
  if (!challenge || challenge.consumed_at) throw new ApiError(400, "challenge_invalid", "验证码请求无效，请重新获取");
  if (numberValue(challenge.expires_at) <= now) throw new ApiError(400, "challenge_expired", "验证码已过期，请重新获取");
  if (numberValue(challenge.locked_until) > now || numberValue(challenge.attempts) >= 5) {
    throw new ApiError(423, "challenge_locked", "验证次数过多，请 30 分钟后重试");
  }
  const expectedHash = await keyedHash(`${challengeId}:${code}`, env.AUTH_HASH_SECRET ?? "");
  if (expectedHash !== challenge.code_hash) {
    const attempts = numberValue(challenge.attempts) + 1;
    await db.prepare("UPDATE email_auth_challenges SET attempts = ?, locked_until = ? WHERE id = ?")
      .bind(attempts, attempts >= 5 ? now + 30 * 60_000 : null, challengeId).run();
    throw new ApiError(attempts >= 5 ? 423 : 400, attempts >= 5 ? "challenge_locked" : "invalid_otp", attempts >= 5 ? "验证次数过多，请 30 分钟后重试" : "验证码不正确");
  }

  let user = await db.prepare("SELECT id FROM users WHERE email_hash = ? AND deleted_at IS NULL").bind(challenge.email_hash).first<Row>();
  const userId = user ? stringValue(user.id) : randomId("user");
  const accessToken = randomToken("zga");
  const refreshToken = randomToken("zgr");
  const [accessTokenHash, refreshTokenHash] = await Promise.all([sha256Hex(accessToken), sha256Hex(refreshToken)]);
  const sessionId = randomId("session");
  const statements: D1PreparedStatement[] = [];
  if (!user) {
    statements.push(db.prepare(`
      INSERT INTO users (id, email_hash, email_encrypted, email_domain, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'student', 'active', ?, ?)
    `).bind(userId, challenge.email_hash, challenge.email_encrypted, challenge.email_domain, now, now));
    statements.push(db.prepare(`
      INSERT INTO learner_profiles
        (id, user_id, name, relation, gender, sport, level, goal, created_at, updated_at)
      VALUES (?, ?, '我的学员', 'self', 'unspecified', '田径', '待完善', '专项提升', ?, ?)
    `).bind(randomId("learner"), userId, now, now));
    user = { id: userId };
  }
  statements.push(db.prepare(`
    INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
    VALUES (?, 'student', 'active', ?, ?)
    ON CONFLICT(user_id, role) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
  `).bind(userId, now, now));
  statements.push(db.prepare("UPDATE email_auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, challengeId));
  statements.push(db.prepare(`
    INSERT INTO sessions
      (id, user_id, device_id, auth_method, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, last_seen_at, created_at)
    VALUES (?, ?, ?, 'email_otp', ?, ?, ?, ?, ?, ?)
  `).bind(sessionId, userId, deviceId, accessTokenHash, refreshTokenHash, now + 15 * 60_000, now + 30 * 24 * 60 * 60_000, now, now));

  const email = await import("./security").then(({ decryptContact }) => decryptContact(stringValue(challenge.email_encrypted), env.PHONE_ENCRYPTION_KEY ?? ""));
  const coach = await db.prepare("SELECT id, name, sport, title FROM coaches WHERE lower(siwc_email) = ? AND profile_kind = 'real' AND audit_status = 'approved' LIMIT 1").bind(email).first<Row>();
  if (coach) {
    statements.push(db.prepare("UPDATE coaches SET user_id = ?, updated_at = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)").bind(userId, now, coach.id, userId));
    statements.push(db.prepare(`
      INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
      VALUES (?, 'coach', 'active', ?, ?)
      ON CONFLICT(user_id, role) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
    `).bind(userId, now, now));
  }
  if (email.trim().toLowerCase() === PRIMARY_OPERATOR_EMAIL) {
    statements.push(db.prepare(`
      INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
      VALUES (?, 'operator', 'active', ?, ?)
      ON CONFLICT(user_id, role) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
    `).bind(userId, now, now));
  }
  for (const coachId of [...new Set(localFavoriteCoachIds)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 100)) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO favorites (user_id, coach_id, created_at)
      SELECT ?, id, ? FROM coaches WHERE id = ? AND profile_kind = 'real' AND audit_status = 'approved' AND listing_status = 'online'
    `).bind(userId, now, coachId));
  }
  await db.batch(statements);

  const availableModes = new Set<AccountMode>(["student"]);
  let coachSummary: CoachAccountSummary | undefined;
  if (coach) {
    availableModes.add("coach");
    coachSummary = {
      auditStatus: "approved",
      id: numberValue(coach.id),
      name: stringValue(coach.name),
      pendingBookingCount: 0,
      sport: stringValue(coach.sport),
      title: stringValue(coach.title),
    };
  }
  return {
    accessToken,
    authMethod: "email_otp",
    availableModes: [...availableModes],
    coach: coachSummary,
    contactMasked: maskEmail(email),
    expiresAt: now + 15 * 60_000,
    phoneMasked: maskEmail(email),
    refreshToken,
  };
}
