import { canTransitionBooking } from "../../app/mobile/domain";
import { matchesAudience, matchesTrainingGoal } from "../../shared/coach-catalog";
import { validateScheduleDraft } from "../../shared/scheduling";
import type {
  AccountMode,
  BookingStatus,
  CoachAccountSummary,
  LearnerProfile,
  MobileBooking,
  MobileCoach,
  MobileConversation,
  MobileMessage,
  MobileSession,
} from "../../app/mobile/types";
import { ApiError, type ApiEnv } from "./contracts";
import {
  decryptPhone,
  encryptPhone,
  getBearerToken,
  getClientIp,
  keyedHash,
  maskEmail,
  maskPhone,
  normalizeEmail,
  normalizePhone,
  randomId,
  randomOtp,
  randomToken,
  sha256Hex,
} from "./security";
import { sendBookingStatusSms, sendOtpSms } from "./sms";

export type StudentIdentity = {
  authMethod: "phone_otp" | "email_otp";
  contactMasked: string;
  deviceId: string;
  phoneLast4: string;
  sessionId: string;
  userId: string;
};

export const PRIMARY_OPERATOR_EMAIL = "xuzerui6@gmail.com";

export type CoachIdentity = {
  coachId: number;
  email: string;
  name: string;
  userId?: string;
};

type Row = Record<string, unknown>;

function db(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function jsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(stringValue(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function publicCoachMediaUrl(row: Row, kind: "avatar" | "card" | "hero", env?: ApiEnv) {
  const objectKey = kind === "avatar"
    ? row.avatar_object_key
    : kind === "card"
      ? row.card_object_key
      : row.hero_object_key;
  const origin = env?.MOBILE_API_ORIGIN?.replace(/\/$/u, "");
  if (!objectKey || !origin) return undefined;
  return `${origin}/api/v1/media/coaches/${numberValue(row.id)}/${kind}`;
}

function mapCoach(row: Row, env?: ApiEnv): MobileCoach {
  const reviewCount = numberValue(row.review_count);
  const availability = jsonArray(row.availability_summary_json);
  const isNew = reviewCount === 0 && numberValue(row.lessons) === 0;
  const profileKind = row.profile_kind === "demo" ? "demo" : "real";
  const pricingPublished = row.pricing_status !== "unavailable";
  const bookingEnabled = row.booking_enabled !== 0;
  const hasOpenSlots = numberValue(row.open_slot_count) > 0 || availability.length > 0;
  const audience = jsonArray(row.audience_json);
  const goals = jsonArray(row.goals_json);
  const honors = jsonArray(row.honors_json);
  const credentials = jsonArray(row.credentials_json);
  const strengths = jsonArray(row.strengths_json);
  const profileComplete = pricingPublished
    && audience.length > 0
    && goals.length > 0
    && credentials.length > 0
    && Boolean(stringValue(row.bio))
    && Boolean(stringValue(row.title));
  const profileCompleteness = profileKind === "demo" ? "demo" : profileComplete ? "complete" : "partial";
  const verificationLabel = profileKind === "demo"
    ? "演示资料"
    : row.audit_status === "approved" && profileComplete
      ? "资料已核验"
      : "资料待补充";
  return {
    accent: "#087A50",
    audience,
    availability,
    avatarUrl: publicCoachMediaUrl(row, "avatar", env),
    bookable: profileKind === "real" && bookingEnabled && pricingPublished && hasOpenSlots,
    bookingEnabled,
    canConsult: profileKind === "real",
    cardUrl: publicCoachMediaUrl(row, "card", env),
    city: stringValue(row.city),
    credentials,
    district: stringValue(row.district),
    experienceYears: numberValue(row.experience_years),
    goals,
    honors,
    id: numberValue(row.id),
    heroUrl: publicCoachMediaUrl(row, "hero", env),
    isNew,
    lessons: numberValue(row.lessons),
    level: stringValue(row.level),
    name: stringValue(row.name),
    note: stringValue(row.bio),
    motto: stringValue(row.motto),
    price: pricingPublished ? Math.round(numberValue(row.price_fen) / 100) : undefined,
    profileCompleteness,
    profileKind,
    pricingStatus: pricingPublished ? "published" : "unavailable",
    proof: profileKind === "demo"
      ? ["演示资料", "不可预约"]
      : profileCompleteness === "partial"
        ? [verificationLabel, "服务区域已确认"]
        : [...credentials, "运动经历与公开资料已核验", "服务保障已开通"],
    rating: numberValue(row.rating_basis_points) / 100,
    responseMinutes: numberValue(row.response_minutes),
    reviewCount,
    sport: stringValue(row.sport),
    strengths,
    title: stringValue(row.title),
    trialPrice: pricingPublished ? Math.round(numberValue(row.trial_price_fen) / 100) : undefined,
    unavailableReason: profileKind !== "real"
      ? "演示资料不可预约"
      : !bookingEnabled
        ? "教练暂时停止接受新预约"
        : !pricingPublished
          ? "课程价格尚未发布"
          : !hasOpenSlots
            ? "可约时段待发布"
            : undefined,
    venue: stringValue(row.venue_name),
    verificationLabel,
    verified: row.audit_status === "approved",
  };
}

function beijingDateParts(startsAt: number, endsAt: number) {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: "Asia/Shanghai", year: "numeric" });
  const timeFormatter = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", hour12: false, minute: "2-digit", timeZone: "Asia/Shanghai" });
  const date = dateFormatter.format(new Date(startsAt));
  const today = dateFormatter.format(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateFormatter.format(tomorrowDate);
  const weekday = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", weekday: "short" }).format(new Date(startsAt));
  return {
    date,
    dateLabel: date === today ? "今天" : date === tomorrow ? "明天" : weekday,
    endTime: timeFormatter.format(new Date(endsAt)),
    time: timeFormatter.format(new Date(startsAt)),
  };
}

function mapBooking(row: Row): MobileBooking {
  const startsAt = numberValue(row.starts_at);
  const endsAt = numberValue(row.ends_at);
  return {
    ...beijingDateParts(startsAt, endsAt),
    coachId: numberValue(row.coach_id),
    feeFen: numberValue(row.fee_fen),
    id: stringValue(row.id),
    learnerId: stringValue(row.learner_profile_id),
    learnerName: row.learner_name ? stringValue(row.learner_name) : undefined,
    coachName: row.coach_name ? stringValue(row.coach_name) : undefined,
    sport: row.sport ? stringValue(row.sport) : undefined,
    note: stringValue(row.note),
    paymentStatus: stringValue(row.payment_status) as MobileBooking["paymentStatus"],
    slotId: stringValue(row.slot_id),
    status: stringValue(row.status) as BookingStatus,
    submittedAt: "已提交",
    venueId: stringValue(row.venue_id),
    venueName: row.venue_name ? stringValue(row.venue_name) : undefined,
  };
}

export async function authenticateStudent(request: Request, env: ApiEnv, required = true): Promise<StudentIdentity | null> {
  const token = getBearerToken(request);
  if (!token) {
    const trustedEmail = request.headers.get("oai-authenticated-user-email");
    const trusted = Boolean(env.OPERATOR_API_SECRET) && request.headers.get("x-operator-secret") === env.OPERATOR_API_SECRET;
    if (trusted && trustedEmail) return authenticateTrustedWebStudent(trustedEmail, env);
    if (required) throw new ApiError(401, "authentication_required", "请先验证手机号");
    return null;
  }
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const row = await db(env).prepare(`
    SELECT s.id, s.user_id, s.device_id, s.auth_method, u.phone_last4, u.email_encrypted
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.access_token_hash = ? AND s.revoked_at IS NULL AND s.access_expires_at > ?
      AND u.status = 'active' AND u.deleted_at IS NULL
  `).bind(tokenHash, now).first<Row>();
  if (!row) {
    if (required) throw new ApiError(401, "invalid_session", "登录状态已失效，请重新验证手机号");
    return null;
  }
  void db(env).prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(now, row.id).run();
  const authMethod = row.auth_method === "email_otp" ? "email_otp" as const : "phone_otp" as const;
  const contactMasked = authMethod === "email_otp" && row.email_encrypted
    ? maskEmail(await decryptPhone(stringValue(row.email_encrypted), env.PHONE_ENCRYPTION_KEY ?? ""))
    : maskPhone(stringValue(row.phone_last4));
  return {
    authMethod,
    contactMasked,
    deviceId: stringValue(row.device_id),
    phoneLast4: stringValue(row.phone_last4),
    sessionId: stringValue(row.id),
    userId: stringValue(row.user_id),
  };
}

async function authenticateTrustedWebStudent(emailInput: string, env: ApiEnv): Promise<StudentIdentity> {
  const email = normalizeEmail(emailInput);
  const database = db(env);
  const now = Date.now();
  const emailHash = await keyedHash(email, env.AUTH_HASH_SECRET ?? "");
  let user = await database.prepare("SELECT id, email_encrypted FROM users WHERE email_hash = ? AND status = 'active' AND deleted_at IS NULL").bind(emailHash).first<Row>();
  const userId = user ? stringValue(user.id) : randomId("user");
  if (!user) {
    const emailEncrypted = await encryptPhone(email, env.PHONE_ENCRYPTION_KEY ?? "");
    await database.batch([
      database.prepare(`
        INSERT INTO users (id, email_hash, email_encrypted, email_domain, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'student', 'active', ?, ?)
      `).bind(userId, emailHash, emailEncrypted, email.split("@")[1], now, now),
      database.prepare(`
        INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
        VALUES (?, 'student', 'active', ?, ?)
      `).bind(userId, now, now),
      database.prepare(`
        INSERT INTO learner_profiles (id, user_id, name, relation, gender, sport, level, goal, created_at, updated_at)
        VALUES (?, ?, '我的学员', 'self', 'unspecified', '田径', '待完善', '专项提升', ?, ?)
      `).bind(randomId("learner"), userId, now, now),
    ]);
    user = { id: userId, email_encrypted: emailEncrypted };
  }
  const coach = await database.prepare("SELECT id FROM coaches WHERE lower(siwc_email) = ? AND audit_status = 'approved' AND profile_kind = 'real' LIMIT 1").bind(email).first<Row>();
  if (coach) {
    await database.batch([
      database.prepare("UPDATE coaches SET user_id = ?, updated_at = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)").bind(userId, now, coach.id, userId),
      database.prepare(`
        INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
        VALUES (?, 'coach', 'active', ?, ?)
        ON CONFLICT(user_id, role) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
      `).bind(userId, now, now),
    ]);
  }
  if (email === PRIMARY_OPERATOR_EMAIL) {
    await database.prepare(`
      INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
      VALUES (?, 'operator', 'active', ?, ?)
      ON CONFLICT(user_id, role) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
    `).bind(userId, now, now).run();
  }
  return {
    authMethod: "email_otp",
    contactMasked: maskEmail(email),
    deviceId: "zhuguang-web",
    phoneLast4: "",
    sessionId: `web:${userId}`,
    userId,
  };
}

export async function getMobileIdentityD1(identity: StudentIdentity, env: ApiEnv) {
  const database = db(env);
  const [user, roleRows, coach] = await Promise.all([
    database.prepare("SELECT phone_last4, email_encrypted FROM users WHERE id = ? AND status = 'active' AND deleted_at IS NULL").bind(identity.userId).first<Row>(),
    database.prepare("SELECT role FROM user_roles WHERE user_id = ? AND status = 'active'").bind(identity.userId).all<Row>(),
    database.prepare(`
      SELECT id, name, sport, title, audit_status,
        (SELECT count(*) FROM booking_requests b WHERE b.coach_id = coaches.id AND b.status IN ('pending_coach', 'reschedule_requested')) AS pending_count
      FROM coaches WHERE user_id = ? AND profile_kind = 'real' AND audit_status IN ('approved', 'suspended') LIMIT 1
    `).bind(identity.userId).first<Row>(),
  ]);
  if (!user) throw new ApiError(401, "invalid_session", "登录状态已失效，请重新验证手机号");
  const roles = new Set<AccountMode>(["student"]);
  for (const row of roleRows.results ?? []) {
    if (row.role === "student" || row.role === "coach") roles.add(row.role);
  }
  let coachSummary: CoachAccountSummary | undefined;
  if (coach) {
    coachSummary = {
      auditStatus: coach.audit_status === "approved" ? "approved" : "suspended",
      id: numberValue(coach.id),
      name: stringValue(coach.name),
      pendingBookingCount: numberValue(coach.pending_count),
      sport: stringValue(coach.sport),
      title: stringValue(coach.title),
    };
    if (coachSummary.auditStatus === "approved") roles.add("coach");
    else roles.delete("coach");
  } else {
    roles.delete("coach");
  }
  const email = user.email_encrypted
    ? (await decryptPhone(stringValue(user.email_encrypted), env.PHONE_ENCRYPTION_KEY ?? "")).trim().toLowerCase()
    : undefined;
  const contactMasked = email
    ? maskEmail(email)
    : maskPhone(stringValue(user.phone_last4));
  return {
    authMethod: user.email_encrypted ? "email_otp" as const : "phone_otp" as const,
    availableModes: [...roles],
    coach: coachSummary,
    contactMasked,
    email,
    phoneMasked: contactMasked,
    roles: [...new Set((roleRows.results ?? []).map((row) => stringValue(row.role)).filter((role): role is "student" | "coach" | "operator" => role === "student" || role === "coach" || role === "operator"))],
    userId: identity.userId,
  };
}

export async function requestOtpD1(request: Request, phoneInput: unknown, env: ApiEnv) {
  const phone = normalizePhone(phoneInput);
  const hashSecret = env.AUTH_HASH_SECRET ?? "";
  const phoneHash = await keyedHash(phone, hashSecret);
  const ipHash = await keyedHash(getClientIp(request), hashSecret);
  const deviceHash = await keyedHash(request.headers.get("x-device-id")?.slice(0, 160) || "unknown-device", hashSecret);
  const database = db(env);
  const now = Date.now();
  const oneHourAgo = now - 60 * 60_000;
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const latest = await database.prepare(`
    SELECT resend_after, locked_until FROM auth_challenges
    WHERE phone_hash = ? ORDER BY created_at DESC LIMIT 1
  `).bind(phoneHash).first<Row>();
  if (numberValue(latest?.locked_until) > now) throw new ApiError(423, "otp_locked", "验证请求已锁定，请 30 分钟后重试");
  if (numberValue(latest?.resend_after) > now) {
    const retryAfter = Math.ceil((numberValue(latest?.resend_after) - now) / 1000);
    throw new ApiError(429, "otp_resend_too_soon", `请在 ${retryAfter} 秒后重新获取验证码`);
  }
  const [phoneCount, ipCount, deviceCount, dailyCount] = await Promise.all([
    database.prepare("SELECT count(*) AS count FROM auth_challenges WHERE phone_hash = ? AND created_at >= ?").bind(phoneHash, oneHourAgo).first<Row>(),
    database.prepare("SELECT count(*) AS count FROM auth_challenges WHERE ip_hash = ? AND created_at >= ?").bind(ipHash, oneHourAgo).first<Row>(),
    database.prepare("SELECT count(*) AS count FROM auth_challenges WHERE device_hash = ? AND created_at >= ?").bind(deviceHash, oneHourAgo).first<Row>(),
    database.prepare("SELECT count(*) AS count FROM auth_challenges WHERE created_at >= ?").bind(dayStart.getTime()).first<Row>(),
  ]);
  if (numberValue(dailyCount?.count) >= Number(env.SMS_DAILY_BUDGET ?? 1000)) {
    throw new ApiError(503, "sms_daily_budget_reached", "今日短信服务额度已达上限，请稍后再试");
  }
  if (numberValue(phoneCount?.count) >= 5 || numberValue(ipCount?.count) >= 20 || numberValue(deviceCount?.count) >= 8) {
    throw new ApiError(429, "otp_rate_limited", "验证码请求过于频繁，请稍后再试");
  }

  const challengeId = randomId("challenge");
  const code = env.APP_ENV === "production" ? randomOtp() : "888888";
  const [codeHash, phoneEncrypted] = await Promise.all([
    keyedHash(`${challengeId}:${code}`, hashSecret),
    encryptPhone(phone, env.PHONE_ENCRYPTION_KEY ?? ""),
  ]);
  await database.prepare(`
    INSERT INTO auth_challenges
      (id, phone_hash, phone_encrypted, phone_last4, code_hash, ip_hash, device_hash, attempts, expires_at, resend_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).bind(challengeId, phoneHash, phoneEncrypted, phone.slice(-4), codeHash, ipHash, deviceHash, now + 5 * 60_000, now + 60_000, now).run();
  try {
    await sendOtpSms(phone, code, challengeId, env);
  } catch (error) {
    await database.prepare("DELETE FROM auth_challenges WHERE id = ?").bind(challengeId).run();
    throw error;
  }
  return { challengeId, expiresIn: 300, retryAfter: 60 };
}

function newSessionRecord(
  userId: string,
  deviceId: string,
  contactMasked: string,
  authMethod: "phone_otp" | "email_otp",
  rotatedFromId?: string,
) {
  const accessToken = randomToken("zga");
  const refreshToken = randomToken("zgr");
  const now = Date.now();
  return {
    accessToken,
    accessTokenHashPromise: sha256Hex(accessToken),
    deviceId,
    authMethod,
    contactMasked,
    expiresAt: now + 15 * 60_000,
    id: randomId("session"),
    phoneMasked: contactMasked,
    refreshExpiresAt: now + 30 * 24 * 60 * 60_000,
    refreshToken,
    refreshTokenHashPromise: sha256Hex(refreshToken),
    rotatedFromId: rotatedFromId ?? null,
    userId,
  };
}

export async function verifyOtpD1(
  challengeId: string,
  code: string,
  deviceId: string,
  localFavoriteCoachIds: number[],
  env: ApiEnv,
): Promise<MobileSession> {
  const database = db(env);
  const now = Date.now();
  const challenge = await database.prepare("SELECT * FROM auth_challenges WHERE id = ?").bind(challengeId).first<Row>();
  if (!challenge || challenge.consumed_at) throw new ApiError(400, "challenge_invalid", "验证码请求无效，请重新获取");
  if (numberValue(challenge.expires_at) <= now) throw new ApiError(400, "challenge_expired", "验证码已过期，请重新获取");
  if (numberValue(challenge.locked_until) > now || numberValue(challenge.attempts) >= 5) {
    throw new ApiError(423, "challenge_locked", "验证次数过多，请 30 分钟后重试");
  }
  const expectedHash = await keyedHash(`${challengeId}:${code}`, env.AUTH_HASH_SECRET ?? "");
  if (expectedHash !== challenge.code_hash) {
    const attempts = numberValue(challenge.attempts) + 1;
    const lockedUntil = attempts >= 5 ? now + 30 * 60_000 : null;
    await database.prepare("UPDATE auth_challenges SET attempts = ?, locked_until = ? WHERE id = ?").bind(attempts, lockedUntil, challengeId).run();
    throw new ApiError(attempts >= 5 ? 423 : 400, attempts >= 5 ? "challenge_locked" : "invalid_otp", attempts >= 5 ? "验证次数过多，请 30 分钟后重试" : "验证码不正确");
  }

  let user = await database.prepare("SELECT id, phone_last4 FROM users WHERE phone_hash = ? AND deleted_at IS NULL").bind(challenge.phone_hash).first<Row>();
  const userId = user ? stringValue(user.id) : randomId("user");
  const phoneLast4 = stringValue(challenge.phone_last4);
  const session = newSessionRecord(userId, deviceId, maskPhone(phoneLast4), "phone_otp");
  const [accessTokenHash, refreshTokenHash] = await Promise.all([session.accessTokenHashPromise, session.refreshTokenHashPromise]);
  const statements: D1PreparedStatement[] = [];
  if (!user) {
    statements.push(database.prepare(`
      INSERT INTO users (id, phone_hash, phone_encrypted, phone_last4, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'student', 'active', ?, ?)
    `).bind(userId, challenge.phone_hash, challenge.phone_encrypted, phoneLast4, now, now));
    statements.push(database.prepare(`
      INSERT INTO learner_profiles
        (id, user_id, name, relation, gender, sport, level, goal, created_at, updated_at)
      VALUES (?, ?, '我的学员', 'self', 'unspecified', '羽毛球', '待完善', '专项提升', ?, ?)
    `).bind(randomId("learner"), userId, now, now));
    user = { id: userId, phone_last4: phoneLast4 };
  }
  statements.push(database.prepare(`
    INSERT INTO user_roles (user_id, role, status, granted_at, updated_at)
    VALUES (?, 'student', 'active', ?, ?)
    ON CONFLICT(user_id, role) DO UPDATE SET status = 'active', updated_at = excluded.updated_at
  `).bind(userId, now, now));
  statements.push(database.prepare("UPDATE auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, challengeId));
  statements.push(database.prepare(`
    INSERT INTO sessions
      (id, user_id, device_id, auth_method, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, rotated_from_id, last_seen_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(session.id, userId, deviceId, session.authMethod, accessTokenHash, refreshTokenHash, session.expiresAt, session.refreshExpiresAt, null, now, now));
  for (const coachId of [...new Set(localFavoriteCoachIds)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 100)) {
    statements.push(database.prepare(`
      INSERT OR IGNORE INTO favorites (user_id, coach_id, created_at)
      SELECT ?, id, ? FROM coaches WHERE id = ? AND audit_status = 'approved' AND listing_status = 'online'
    `).bind(userId, now, coachId));
  }
  await database.batch(statements);
  const mobileIdentity = await getMobileIdentityD1({ authMethod: "phone_otp", contactMasked: session.contactMasked, deviceId, phoneLast4, sessionId: session.id, userId }, env);
  return {
    accessToken: session.accessToken,
    authMethod: session.authMethod,
    availableModes: mobileIdentity.availableModes,
    coach: mobileIdentity.coach,
    contactMasked: session.contactMasked,
    expiresAt: session.expiresAt,
    phoneMasked: session.phoneMasked,
    refreshToken: session.refreshToken,
  };
}

export async function refreshSessionD1(refreshToken: string, deviceId: string, env: ApiEnv): Promise<MobileSession> {
  const database = db(env);
  const tokenHash = await sha256Hex(refreshToken);
  const row = await database.prepare(`
    SELECT s.*, u.phone_last4, u.email_encrypted FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.refresh_token_hash = ?
  `).bind(tokenHash).first<Row>();
  if (!row) throw new ApiError(401, "invalid_session", "登录状态已失效，请重新验证手机号");
  const now = Date.now();
  if (row.revoked_at) {
    await database.prepare("UPDATE sessions SET revoked_at = coalesce(revoked_at, ?) WHERE user_id = ? AND device_id = ?").bind(now, row.user_id, row.device_id).run();
    throw new ApiError(401, "refresh_reuse_detected", "检测到会话异常，请重新验证手机号");
  }
  if (numberValue(row.refresh_expires_at) <= now || stringValue(row.device_id) !== deviceId) {
    throw new ApiError(401, "invalid_session", "登录状态已失效，请重新验证手机号");
  }
  const authMethod = row.auth_method === "email_otp" ? "email_otp" as const : "phone_otp" as const;
  const contactMasked = authMethod === "email_otp" && row.email_encrypted
    ? maskEmail(await decryptPhone(stringValue(row.email_encrypted), env.PHONE_ENCRYPTION_KEY ?? ""))
    : maskPhone(stringValue(row.phone_last4));
  const session = newSessionRecord(stringValue(row.user_id), deviceId, contactMasked, authMethod, stringValue(row.id));
  const [accessTokenHash, refreshTokenHash] = await Promise.all([session.accessTokenHashPromise, session.refreshTokenHashPromise]);
  await database.batch([
    database.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(now, row.id),
    database.prepare(`
      INSERT INTO sessions
        (id, user_id, device_id, auth_method, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, rotated_from_id, last_seen_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(session.id, row.user_id, deviceId, authMethod, accessTokenHash, refreshTokenHash, session.expiresAt, session.refreshExpiresAt, row.id, now, now),
  ]);
  const mobileIdentity = await getMobileIdentityD1({
    authMethod,
    contactMasked,
    deviceId,
    phoneLast4: stringValue(row.phone_last4),
    sessionId: session.id,
    userId: stringValue(row.user_id),
  }, env);
  return {
    accessToken: session.accessToken,
    authMethod,
    availableModes: mobileIdentity.availableModes,
    coach: mobileIdentity.coach,
    contactMasked,
    expiresAt: session.expiresAt,
    phoneMasked: session.phoneMasked,
    refreshToken: session.refreshToken,
  };
}

export async function logoutD1(identity: StudentIdentity, env: ApiEnv) {
  await db(env).prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(Date.now(), identity.sessionId).run();
}

export async function deleteAccountD1(identity: StudentIdentity, env: ApiEnv) {
  const database = db(env);
  const account = await database.prepare("SELECT email_encrypted FROM users WHERE id = ? AND status = 'active' AND deleted_at IS NULL").bind(identity.userId).first<Row>();
  if (account?.email_encrypted) {
    const email = (await decryptPhone(stringValue(account.email_encrypted), env.PHONE_ENCRYPTION_KEY ?? "")).trim().toLowerCase();
    if (email === PRIMARY_OPERATOR_EMAIL) throw new ApiError(403, "protected_operator_account", "最高权限账号不能被注销");
  }
  const now = Date.now();
  await database.batch([
    database.prepare(`
      UPDATE users SET phone_hash = ?, phone_encrypted = NULL, phone_last4 = NULL,
        email_hash = ?, email_encrypted = NULL, email_domain = NULL,
        status = 'deleted', deleted_at = ?, updated_at = ?
      WHERE id = ? AND status = 'active'
    `).bind(`deleted_${randomId("phone")}`, `deleted_${randomId("email")}`, now, now, identity.userId),
    database.prepare("UPDATE sessions SET revoked_at = coalesce(revoked_at, ?) WHERE user_id = ?").bind(now, identity.userId),
    database.prepare("DELETE FROM favorites WHERE user_id = ?").bind(identity.userId),
    database.prepare("DELETE FROM notifications WHERE user_id = ?").bind(identity.userId),
    database.prepare(`
      UPDATE learner_profiles SET name = '已注销学员', guardian_name = NULL, guardian_phone_encrypted = NULL, goal = '', updated_at = ?
      WHERE user_id = ?
    `).bind(now, identity.userId),
  ]);
  return { deletionEffectiveAt: now, retainedForDisputesDays: 90 };
}

export async function listCoachesD1(env: ApiEnv, filters: URLSearchParams) {
  const clauses = ["profile_kind = 'real'", "audit_status = 'approved'", "listing_status = 'online'", "city = '北京'"];
  const values: unknown[] = [];
  for (const [field, column] of [["sport", "sport"], ["district", "district"]] as const) {
    const value = filters.get(field);
    if (value) {
      clauses.push(`${column} = ?`);
      values.push(value);
    }
  }
  const maxPriceFen = Number(filters.get("maxPriceFen"));
  if (Number.isFinite(maxPriceFen) && maxPriceFen > 0) {
    clauses.push("price_fen <= ?");
    values.push(maxPriceFen);
  }
  const query = `SELECT coaches.*,
    (SELECT name FROM venues WHERE venues.coach_id = coaches.id AND active = 1 ORDER BY created_at LIMIT 1) AS venue_name,
    (SELECT count(*) FROM availability_slots slots WHERE slots.coach_id = coaches.id AND slots.status = 'open' AND slots.starts_at > unixepoch() * 1000) AS open_slot_count
    FROM coaches WHERE ${clauses.join(" AND ")} ORDER BY CASE profile_kind WHEN 'real' THEN 0 ELSE 1 END, rating_basis_points DESC, lessons DESC, id ASC LIMIT 100`;
  const result = await db(env).prepare(query).bind(...values).all<Row>();
  const goal = filters.get("goal") ?? "";
  const audience = filters.get("audience") ?? "";
  return (result.results ?? []).map((row) => mapCoach(row, env)).filter((coach) =>
    (!goal || matchesTrainingGoal([...coach.goals, ...coach.strengths], goal))
    && (!audience || matchesAudience(coach.audience, audience)));
}

export async function getCoachD1(coachId: number, env: ApiEnv) {
  const row = await db(env).prepare(`SELECT coaches.*,
    (SELECT name FROM venues WHERE venues.coach_id = coaches.id AND active = 1 ORDER BY created_at LIMIT 1) AS venue_name,
    (SELECT count(*) FROM availability_slots slots WHERE slots.coach_id = coaches.id AND slots.status = 'open' AND slots.starts_at > unixepoch() * 1000) AS open_slot_count
    FROM coaches WHERE id = ? AND profile_kind = 'real'`).bind(coachId).first<Row>();
  if (!row) throw new ApiError(404, "coach_not_found", "未找到该教练");
  if (row.audit_status !== "approved" || row.listing_status !== "online") {
    throw new ApiError(410, "coach_offline", "该教练当前未公开展示");
  }
  return mapCoach(row, env);
}

export async function listSlotsD1(coachId: number, env: ApiEnv, requirePublic = true) {
  const visibilityClause = requirePublic ? "AND listing_status = 'online'" : "";
  const coach = await db(env).prepare(`SELECT profile_kind FROM coaches WHERE id = ? AND audit_status = 'approved' ${visibilityClause}`).bind(coachId).first<Row>();
  if (!coach) throw new ApiError(410, "coach_offline", "该教练当前未公开展示");
  if (coach.profile_kind === "demo") return [];
  const result = await db(env).prepare(`
    SELECT s.id, s.coach_id, s.venue_id, s.starts_at, s.ends_at, s.status,
      v.name AS venue_name, v.address AS venue_address, v.district AS venue_district
    FROM availability_slots s
    JOIN venues v ON v.id = s.venue_id AND v.active = 1
    WHERE s.coach_id = ? AND s.starts_at > ? AND s.status = 'open'
    ORDER BY s.starts_at ASC LIMIT 100
  `).bind(coachId, Date.now()).all<Row>();
  return (result.results ?? []).map((row) => ({
    ...beijingDateParts(numberValue(row.starts_at), numberValue(row.ends_at)),
    available: row.status === "open",
    coachId: numberValue(row.coach_id),
    id: stringValue(row.id),
    venueAddress: stringValue(row.venue_address),
    venueDistrict: stringValue(row.venue_district),
    venueId: stringValue(row.venue_id),
    venueName: stringValue(row.venue_name),
  }));
}

async function listLearners(userId: string, env: ApiEnv): Promise<LearnerProfile[]> {
  const result = await db(env).prepare("SELECT * FROM learner_profiles WHERE user_id = ? ORDER BY created_at ASC").bind(userId).all<Row>();
  const currentYear = new Date().getFullYear();
  return (result.results ?? []).map((row) => ({
    age: row.birth_year ? Math.max(0, currentYear - numberValue(row.birth_year)) : 0,
    gender: stringValue(row.gender) as LearnerProfile["gender"],
    goal: stringValue(row.goal),
    guardianName: row.guardian_name ? stringValue(row.guardian_name) : undefined,
    id: stringValue(row.id),
    level: stringValue(row.level),
    name: stringValue(row.name),
    relation: stringValue(row.relation) as LearnerProfile["relation"],
    sport: stringValue(row.sport),
  }));
}

async function listBookings(userId: string, env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT b.*, s.starts_at, s.ends_at FROM booking_requests b
    JOIN availability_slots s ON s.id = b.slot_id
    WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 100
  `).bind(userId).all<Row>();
  return (result.results ?? []).map(mapBooking);
}

async function listConversations(userId: string, env: ApiEnv): Promise<MobileConversation[]> {
  const database = db(env);
  const result = await database.prepare("SELECT * FROM conversations WHERE student_user_id = ? ORDER BY last_message_at DESC LIMIT 50").bind(userId).all<Row>();
  return Promise.all((result.results ?? []).map(async (conversation) => {
    const messagesResult = await database.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200").bind(conversation.id).all<Row>();
    const mappedMessages: MobileMessage[] = (messagesResult.results ?? []).map((message) => ({
      body: stringValue(message.body),
      conversationId: stringValue(message.conversation_id),
      createdAt: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(numberValue(message.created_at))),
      id: stringValue(message.id),
      read: Boolean(message.read_at),
      sender: stringValue(message.sender_type) as MobileMessage["sender"],
    }));
    const last = mappedMessages.at(-1);
    return {
      coachId: conversation.coach_id ? numberValue(conversation.coach_id) : undefined,
      id: stringValue(conversation.id),
      kind: stringValue(conversation.kind) as MobileConversation["kind"],
      messages: mappedMessages,
      subtitle: last?.body ?? "暂无消息",
      title: stringValue(conversation.title),
      unreadCount: mappedMessages.filter((message) => !message.read && message.sender !== "student").length,
      updatedAt: last?.createdAt ?? "",
    };
  }));
}

export async function bootstrapD1(request: Request, env: ApiEnv) {
  const [coaches, identity] = await Promise.all([listCoachesD1(env, new URLSearchParams()), authenticateStudent(request, env, false)]);
  if (!identity) return { bookings: [], coaches, conversations: [], favoriteCoachIds: [], learnerProfiles: [], minimumAppVersion: "1.0.0" };
  const [bookings, conversations, favoriteRows, learnerProfiles] = await Promise.all([
    listBookings(identity.userId, env),
    listConversations(identity.userId, env),
    db(env).prepare("SELECT coach_id FROM favorites WHERE user_id = ? ORDER BY coach_id").bind(identity.userId).all<Row>(),
    listLearners(identity.userId, env),
  ]);
  return {
    bookings,
    coaches,
    conversations,
    favoriteCoachIds: (favoriteRows.results ?? []).map((row) => numberValue(row.coach_id)),
    learnerProfiles,
    minimumAppVersion: "1.0.0",
  };
}

export async function setFavoriteD1(userId: string, coachId: number, favorite: boolean, env: ApiEnv) {
  const database = db(env);
  if (favorite) {
    const result = await database.prepare(`
      INSERT OR IGNORE INTO favorites (user_id, coach_id, created_at)
      SELECT ?, id, ? FROM coaches WHERE id = ? AND profile_kind = 'real' AND audit_status = 'approved' AND listing_status = 'online'
    `).bind(userId, Date.now(), coachId).run();
    if (!result.meta.changes) {
      const coach = await database.prepare("SELECT id FROM coaches WHERE id = ? AND profile_kind = 'real' AND audit_status = 'approved' AND listing_status = 'online'").bind(coachId).first<Row>();
      if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
    }
  } else {
    await database.prepare("DELETE FROM favorites WHERE user_id = ? AND coach_id = ?").bind(userId, coachId).run();
  }
  const rows = await database.prepare("SELECT coach_id FROM favorites WHERE user_id = ? ORDER BY coach_id").bind(userId).all<Row>();
  return { favoriteCoachIds: (rows.results ?? []).map((row) => numberValue(row.coach_id)) };
}

export async function createBookingD1(
  identity: StudentIdentity,
  input: { coachId: number; learnerId: string; note: string; slotId: string; venueId: string },
  idempotencyKey: string,
  env: ApiEnv,
) {
  const database = db(env);
  const existing = await database.prepare(`
    SELECT b.*, s.starts_at, s.ends_at FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id
    WHERE b.user_id = ? AND b.idempotency_key = ?
  `).bind(identity.userId, idempotencyKey).first<Row>();
  if (existing) return mapBooking(existing);
  const slot = await database.prepare(`
    SELECT s.*, c.trial_price_fen, c.audit_status, c.listing_status, c.profile_kind, c.pricing_status, c.booking_enabled FROM availability_slots s
    JOIN coaches c ON c.id = s.coach_id
    WHERE s.id = ? AND s.coach_id = ? AND s.venue_id = ?
  `).bind(input.slotId, input.coachId, input.venueId).first<Row>();
  if (!slot || slot.audit_status !== "approved" || slot.listing_status !== "online" || slot.profile_kind !== "real" || slot.pricing_status !== "published" || slot.booking_enabled === 0) {
    throw new ApiError(404, "slot_not_found", "未找到该可约时段");
  }
  if (slot.status !== "open") throw new ApiError(409, "slot_unavailable", "该时段刚刚被预约，请选择其他时间");
  if (numberValue(slot.starts_at) <= Date.now()) throw new ApiError(409, "slot_expired", "该时段已过期，请选择未来时间");
  let learner = await database.prepare("SELECT id FROM learner_profiles WHERE id = ? AND user_id = ?").bind(input.learnerId, identity.userId).first<Row>();
  if (!learner) learner = await database.prepare("SELECT id FROM learner_profiles WHERE user_id = ? ORDER BY created_at LIMIT 1").bind(identity.userId).first<Row>();
  if (!learner) throw new ApiError(422, "learner_required", "请先完善学员档案");
  const bookingId = randomId("booking");
  const now = Date.now();
  try {
    await database.batch([
      database.prepare(`
        INSERT INTO booking_requests
          (id, idempotency_key, user_id, learner_profile_id, coach_id, venue_id, slot_id, status, fee_fen, payment_status, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_coach', ?, 'offline_unpaid', ?, ?, ?)
      `).bind(bookingId, idempotencyKey, identity.userId, learner.id, input.coachId, input.venueId, input.slotId, numberValue(slot.trial_price_fen), input.note.slice(0, 500), now, now),
      database.prepare("UPDATE availability_slots SET status = 'held', updated_at = ? WHERE id = ? AND status = 'open'").bind(now, input.slotId),
      database.prepare(`
        INSERT INTO booking_events (id, booking_id, actor_type, actor_id, from_status, to_status, detail_json, created_at)
        VALUES (?, ?, 'student', ?, NULL, 'pending_coach', '{}', ?)
      `).bind(randomId("event"), bookingId, identity.userId, now),
      database.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
        VALUES (?, ?, 'booking_submitted', '预约申请已提交', '教练确认后预约生效，费用在线下支付。', 'booking', ?, 'student', 'zhuguang://student/bookings', ?)
      `).bind(randomId("notification"), identity.userId, bookingId, now),
      database.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
        SELECT ?, c.user_id, 'coach_booking_pending', '有新的预约待确认', '请进入教练工作台及时处理预约。', 'booking', ?, 'coach', 'zhuguang://coach/appointments', ?
        FROM coaches c WHERE c.id = ? AND c.user_id IS NOT NULL
      `).bind(randomId("notification"), bookingId, now, input.coachId),
    ]);
  } catch (error) {
    console.warn("Booking slot claim rejected", { error, slotId: input.slotId });
    throw new ApiError(409, "slot_unavailable", "该时段刚刚被预约，请选择其他时间");
  }
  const created = await database.prepare(`
    SELECT b.*, s.starts_at, s.ends_at FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id WHERE b.id = ?
  `).bind(bookingId).first<Row>();
  if (!created) throw new ApiError(500, "booking_create_failed", "预约提交失败，请稍后重试");
  return mapBooking(created);
}

export async function cancelBookingD1(identity: StudentIdentity, bookingId: string, env: ApiEnv) {
  const database = db(env);
  const booking = await database.prepare(`
    SELECT b.*, s.starts_at, s.ends_at FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id
    WHERE b.id = ? AND b.user_id = ?
  `).bind(bookingId, identity.userId).first<Row>();
  if (!booking) throw new ApiError(404, "booking_not_found", "未找到该预约");
  const fromStatus = stringValue(booking.status) as BookingStatus;
  if (!canTransitionBooking(fromStatus, "cancelled_by_student")) throw new ApiError(409, "invalid_booking_transition", "当前预约状态不能取消");
  const now = Date.now();
  const results = await database.batch([
    database.prepare("UPDATE booking_requests SET status = 'cancelled_by_student', updated_at = ? WHERE id = ? AND user_id = ? AND status = ?").bind(now, bookingId, identity.userId, fromStatus),
    database.prepare("UPDATE availability_slots SET status = 'open', updated_at = ? WHERE id = ?").bind(now, booking.slot_id),
    database.prepare(`
      INSERT INTO booking_events (id, booking_id, actor_type, actor_id, from_status, to_status, detail_json, created_at)
      VALUES (?, ?, 'student', ?, ?, 'cancelled_by_student', '{}', ?)
    `).bind(randomId("event"), bookingId, identity.userId, fromStatus, now),
    database.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
      SELECT ?, c.user_id, 'booking_status', '学员取消了预约', '时段已自动释放，可重新开放给其他学员。', 'booking', ?, 'coach', 'zhuguang://coach/appointments', ?
      FROM coaches c WHERE c.id = ? AND c.user_id IS NOT NULL
    `).bind(randomId("notification"), bookingId, now, booking.coach_id),
  ]);
  if (!results[0].meta.changes) throw new ApiError(409, "booking_changed", "预约状态已更新，请刷新后重试");
  return mapBooking({ ...booking, status: "cancelled_by_student" });
}

export async function sendStudentMessageD1(identity: StudentIdentity, conversationId: string, body: string, env: ApiEnv) {
  const database = db(env);
  const conversation = await database.prepare("SELECT id, coach_id FROM conversations WHERE id = ? AND student_user_id = ?").bind(conversationId, identity.userId).first<Row>();
  if (!conversation) throw new ApiError(404, "conversation_not_found", "未找到该会话");
  const now = Date.now();
  await database.batch([
    database.prepare(`
      INSERT INTO messages (id, conversation_id, sender_type, sender_id, body, read_at, created_at)
      VALUES (?, ?, 'student', ?, ?, ?, ?)
    `).bind(randomId("message"), conversationId, identity.userId, body.slice(0, 1000), now, now),
    database.prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").bind(now, conversationId),
    database.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
      SELECT ?, c.user_id, 'student_message', '学员发来新消息', ?, 'conversation', ?, 'coach', 'zhuguang://coach/messages', ?
      FROM coaches c WHERE c.id = ? AND c.user_id IS NOT NULL
    `).bind(randomId("notification"), body.slice(0, 120), conversationId, now, conversation.coach_id),
  ]);
  const conversations = await listConversations(identity.userId, env);
  const updated = conversations.find((item) => item.id === conversationId);
  if (!updated) throw new ApiError(500, "message_create_failed", "消息发送失败，请稍后重试");
  return updated;
}

export async function listNotificationsD1(identity: StudentIdentity, env: ApiEnv) {
  const result = await db(env).prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(identity.userId).all<Row>();
  return (result.results ?? []).map((row) => ({
    body: stringValue(row.body),
    createdAt: numberValue(row.created_at),
    deepLink: row.deep_link ? stringValue(row.deep_link) : undefined,
    id: stringValue(row.id),
    read: Boolean(row.read_at),
    targetMode: row.target_mode === "coach" ? "coach" as const : "student" as const,
    title: stringValue(row.title),
    type: stringValue(row.type),
  }));
}

export async function authenticateCoach(request: Request, env: ApiEnv): Promise<CoachIdentity> {
  const mobileIdentity = await authenticateStudent(request, env, false);
  if (mobileIdentity) {
    const row = await db(env).prepare(`
      SELECT c.id, c.name FROM coaches c
      JOIN user_roles r ON r.user_id = c.user_id AND r.role = 'coach' AND r.status = 'active'
      WHERE c.user_id = ? AND c.profile_kind = 'real' AND c.audit_status = 'approved' LIMIT 1
    `).bind(mobileIdentity.userId).first<Row>();
    if (!row) throw new ApiError(403, "coach_not_approved", "教练身份尚未通过人工审核或已被暂停");
    return {
      coachId: numberValue(row.id),
      email: "",
      name: stringValue(row.name),
      userId: mobileIdentity.userId,
    };
  }
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) throw new ApiError(401, "coach_sign_in_required", "请使用已获邀的教练账号登录");
  const allowlist = (env.COACH_EMAIL_ALLOWLIST ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length && !allowlist.includes(email)) throw new ApiError(403, "coach_not_invited", "该账号尚未加入教练试点名单");
  const row = await db(env).prepare("SELECT id, name FROM coaches WHERE lower(siwc_email) = ? AND profile_kind = 'real' AND audit_status = 'approved'").bind(email).first<Row>();
  if (!row) throw new ApiError(403, "coach_not_approved", "教练身份尚未通过人工审核");
  return { coachId: numberValue(row.id), email, name: stringValue(row.name) };
}

export async function coachOverviewD1(identity: CoachIdentity, env: ApiEnv) {
  const database = db(env);
  const coachRow = await database.prepare("SELECT * FROM coaches WHERE id = ? AND profile_kind = 'real' AND audit_status = 'approved'").bind(identity.coachId).first<Row>();
  if (!coachRow) throw new ApiError(403, "coach_not_approved", "教练身份尚未通过人工审核或已被暂停");
  const [coach, bookings, conversations, slots, venues] = await Promise.all([
    Promise.resolve(mapCoach(coachRow, env)),
    database.prepare(`
      SELECT b.*, s.starts_at, s.ends_at, l.name AS learner_name, v.name AS venue_name, c.name AS coach_name, c.sport
      FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id
      JOIN learner_profiles l ON l.id = b.learner_profile_id
      JOIN venues v ON v.id = b.venue_id
      JOIN coaches c ON c.id = b.coach_id
      WHERE b.coach_id = ? ORDER BY b.created_at DESC LIMIT 100
    `).bind(identity.coachId).all<Row>(),
    database.prepare("SELECT id, title, last_message_at FROM conversations WHERE coach_id = ? ORDER BY last_message_at DESC LIMIT 50").bind(identity.coachId).all<Row>(),
    listSlotsD1(identity.coachId, env, false),
    database.prepare("SELECT id, coach_id, name, address, district FROM venues WHERE coach_id = ? AND active = 1 ORDER BY created_at").bind(identity.coachId).all<Row>(),
  ]);
  const mappedConversations: MobileConversation[] = await Promise.all((conversations.results ?? []).map(async (conversation) => {
    const messageRows = await database.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200").bind(conversation.id).all<Row>();
    const messages: MobileMessage[] = (messageRows.results ?? []).map((message) => ({
      body: stringValue(message.body),
      conversationId: stringValue(message.conversation_id),
      createdAt: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(numberValue(message.created_at))),
      id: stringValue(message.id),
      read: Boolean(message.read_at),
      sender: stringValue(message.sender_type) as MobileMessage["sender"],
    }));
    const last = messages.at(-1);
    return {
      coachId: identity.coachId,
      id: stringValue(conversation.id),
      kind: "coach",
      messages,
      subtitle: last?.body || "暂无消息",
      title: stringValue(conversation.title),
      unreadCount: messages.filter((message) => !message.read && message.sender === "student").length,
      updatedAt: last?.createdAt || "",
    };
  }));
  return {
    bookings: (bookings.results ?? []).map(mapBooking),
    coach,
    conversations: mappedConversations,
    slots,
    venues: (venues.results ?? []).map((venue) => ({
      address: stringValue(venue.address),
      coachId: numberValue(venue.coach_id),
      district: stringValue(venue.district),
      id: stringValue(venue.id),
      name: stringValue(venue.name),
    })),
  };
}

export async function coachTransitionBookingD1(identity: CoachIdentity, bookingId: string, toStatus: BookingStatus, env: ApiEnv) {
  const database = db(env);
  const booking = await database.prepare(`
    SELECT b.*, s.starts_at, s.ends_at FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id
    WHERE b.id = ? AND b.coach_id = ?
  `).bind(bookingId, identity.coachId).first<Row>();
  if (!booking) throw new ApiError(404, "booking_not_found", "未找到该预约");
  const fromStatus = stringValue(booking.status) as BookingStatus;
  if (!canTransitionBooking(fromStatus, toStatus)) throw new ApiError(409, "invalid_booking_transition", "不允许从当前状态执行该操作");
  if (!new Set<BookingStatus>(["confirmed", "reschedule_requested", "completed", "rejected", "cancelled_by_coach"]).has(toStatus)) {
    throw new ApiError(422, "invalid_booking_status", "教练端不支持该状态操作");
  }
  const now = Date.now();
  const slotStatus = toStatus === "confirmed" ? "booked" : ["rejected", "cancelled_by_coach"].includes(toStatus) ? "open" : "held";
  const results = await database.batch([
    database.prepare("UPDATE booking_requests SET status = ?, updated_at = ?, completed_at = ? WHERE id = ? AND coach_id = ? AND status = ?").bind(toStatus, now, toStatus === "completed" ? now : null, bookingId, identity.coachId, fromStatus),
    database.prepare("UPDATE availability_slots SET status = ?, updated_at = ? WHERE id = ?").bind(slotStatus, now, booking.slot_id),
    database.prepare(`
      INSERT INTO booking_events (id, booking_id, actor_type, actor_id, from_status, to_status, detail_json, created_at)
      VALUES (?, ?, 'coach', ?, ?, ?, '{}', ?)
    `).bind(randomId("event"), bookingId, String(identity.coachId), fromStatus, toStatus, now),
    database.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
      VALUES (?, ?, 'booking_status', '预约状态已更新', ?, 'booking', ?, 'student', 'zhuguang://student/bookings', ?)
    `).bind(randomId("notification"), booking.user_id, bookingStatusText(toStatus), bookingId, now),
  ]);
  if (!results[0].meta.changes) throw new ApiError(409, "booking_changed", "预约状态已更新，请刷新后重试");
  return mapBooking({ ...booking, status: toStatus });
}

export function bookingStatusText(status: BookingStatus) {
  const copy: Record<BookingStatus, string> = {
    cancelled_by_coach: "教练已取消预约",
    cancelled_by_student: "学员已取消预约",
    completed: "课程已完成",
    confirmed: "教练已确认预约，请按约到场并线下支付",
    pending_coach: "预约等待教练确认",
    rejected: "教练未接受本次预约",
    reschedule_requested: "教练发起了改期协商",
  };
  return copy[status];
}

export async function sendStudentBookingStatusSms(bookingId: string, status: BookingStatus, env: ApiEnv) {
  const row = await db(env).prepare(`
    SELECT u.phone_encrypted FROM booking_requests b JOIN users u ON u.id = b.user_id WHERE b.id = ?
  `).bind(bookingId).first<Row>();
  if (!row?.phone_encrypted) return null;
  const phone = await decryptPhone(stringValue(row.phone_encrypted), env.PHONE_ENCRYPTION_KEY ?? "");
  return sendBookingStatusSms(phone, bookingStatusText(status), bookingId, env);
}

export async function sendCoachBookingStatusSms(bookingId: string, statusText: string, env: ApiEnv) {
  const row = await db(env).prepare(`
    SELECT u.phone_encrypted FROM booking_requests b
    JOIN coaches c ON c.id = b.coach_id JOIN users u ON u.id = c.user_id WHERE b.id = ?
  `).bind(bookingId).first<Row>();
  if (!row?.phone_encrypted) return null;
  const phone = await decryptPhone(stringValue(row.phone_encrypted), env.PHONE_ENCRYPTION_KEY ?? "");
  return sendBookingStatusSms(phone, statusText, bookingId, env);
}

export async function upsertLearnerD1(
  identity: StudentIdentity,
  input: {
    age?: number;
    gender: LearnerProfile["gender"];
    goal: string;
    id?: string;
    level: string;
    name: string;
    relation: LearnerProfile["relation"];
    sport: string;
  },
  env: ApiEnv,
) {
  const database = db(env);
  const now = Date.now();
  const birthYear = input.age && input.age > 0 ? new Date().getFullYear() - input.age : null;
  const id = input.id || randomId("learner");
  if (input.id) {
    const result = await database.prepare(`
      UPDATE learner_profiles SET name = ?, relation = ?, gender = ?, birth_year = ?, sport = ?, level = ?, goal = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(input.name, input.relation, input.gender, birthYear, input.sport, input.level, input.goal, now, id, identity.userId).run();
    if (!result.meta.changes) throw new ApiError(404, "learner_not_found", "未找到该学员档案");
  } else {
    await database.prepare(`
      INSERT INTO learner_profiles (id, user_id, name, relation, gender, birth_year, sport, level, goal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, identity.userId, input.name, input.relation, input.gender, birthYear, input.sport, input.level, input.goal, now, now).run();
  }
  const learners = await listLearners(identity.userId, env);
  return learners.find((learner) => learner.id === id) ?? learners[0];
}

export async function createConversationD1(identity: StudentIdentity, coachId: number, env: ApiEnv) {
  const database = db(env);
  const coach = await database.prepare("SELECT id, name, profile_kind, user_id FROM coaches WHERE id = ? AND audit_status = 'approved' AND listing_status = 'online'").bind(coachId).first<Row>();
  if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
  if (coach.profile_kind === "demo") throw new ApiError(409, "demo_coach_unavailable", "演示资料不提供咨询服务");
  const id = randomId("conversation");
  const now = Date.now();
  const kind = coach.user_id ? "coach" : "support";
  const title = coach.user_id ? `${stringValue(coach.name)}教练` : `平台咨询 · ${stringValue(coach.name)}`;
  await database.prepare(`
    INSERT OR IGNORE INTO conversations (id, student_user_id, coach_id, kind, title, last_message_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, identity.userId, coachId, kind, title, now, now).run();
  const conversations = await listConversations(identity.userId, env);
  const created = conversations.find((conversation) => conversation.coachId === coachId);
  if (!created) throw new ApiError(500, "conversation_create_failed", "会话创建失败，请稍后重试");
  return created;
}

export async function createCoachSlotD1(
  identity: CoachIdentity,
  input: { endsAt: number; startsAt: number; venueId: string },
  env: ApiEnv,
) {
  const fieldErrors = validateScheduleDraft(input);
  if (Object.keys(fieldErrors).length) throw new ApiError(422, "invalid_slot_time", "请检查训练时间", fieldErrors);
  const database = db(env);
  const venue = await database.prepare("SELECT id FROM venues WHERE id = ? AND coach_id = ? AND active = 1").bind(input.venueId, identity.coachId).first<Row>();
  if (!venue) throw new ApiError(404, "venue_not_found", "未找到该训练场馆");
  const now = Date.now();
  await database.prepare(`
    UPDATE availability_slots SET status = 'expired', updated_at = ?
    WHERE coach_id = ? AND status = 'open' AND starts_at <= ?
  `).bind(now, identity.coachId, now).run();
  const overlap = await database.prepare(`
    SELECT id, starts_at, ends_at FROM availability_slots
    WHERE coach_id = ? AND status IN ('open', 'held', 'booked') AND starts_at < ? AND ends_at > ?
    LIMIT 1
  `).bind(identity.coachId, input.endsAt, input.startsAt).first<Row>();
  if (overlap) {
    const conflict = beijingDateParts(numberValue(overlap.starts_at), numberValue(overlap.ends_at));
    throw new ApiError(409, "slot_conflict", `与${conflict.date} ${conflict.time}–${conflict.endTime}的已有排期冲突，请选择其他时间`);
  }
  const id = randomId("slot");
  try {
    await database.prepare(`
      INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `).bind(id, identity.coachId, input.venueId, input.startsAt, input.endsAt, now, now).run();
  } catch {
    throw new ApiError(409, "slot_conflict", "该时间段已存在，请勿重复添加");
  }
  return { ...beijingDateParts(input.startsAt, input.endsAt), available: true, coachId: identity.coachId, id };
}

export async function deleteCoachSlotD1(identity: CoachIdentity, slotId: string, env: ApiEnv) {
  const result = await db(env).prepare("DELETE FROM availability_slots WHERE id = ? AND coach_id = ? AND status = 'open'").bind(slotId, identity.coachId).run();
  if (!result.meta.changes) throw new ApiError(409, "slot_not_removable", "该时段已被占用、用于改期或不存在");
  return { id: slotId, removed: true };
}

export async function sendCoachMessageD1(identity: CoachIdentity, conversationId: string, body: string, env: ApiEnv) {
  const database = db(env);
  const conversation = await database.prepare("SELECT id, student_user_id FROM conversations WHERE id = ? AND coach_id = ?").bind(conversationId, identity.coachId).first<Row>();
  if (!conversation) throw new ApiError(404, "conversation_not_found", "未找到该会话");
  const now = Date.now();
  const messageId = randomId("message");
  await database.batch([
    database.prepare(`
      INSERT INTO messages (id, conversation_id, sender_type, sender_id, body, created_at)
      VALUES (?, ?, 'coach', ?, ?, ?)
    `).bind(messageId, conversationId, String(identity.coachId), body.slice(0, 1000), now),
    database.prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").bind(now, conversationId),
    database.prepare(`
      INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at)
      VALUES (?, ?, 'coach_message', '教练发来新消息', ?, 'conversation', ?, 'student', 'zhuguang://student/messages', ?)
    `).bind(randomId("notification"), conversation.student_user_id, body.slice(0, 120), conversationId, now),
  ]);
  return { body, conversationId, createdAt: now, id: messageId, sender: "coach" };
}

export async function markOfflinePaidD1(identity: CoachIdentity, bookingId: string, paid: boolean, env: ApiEnv) {
  const result = await db(env).prepare(`
    UPDATE booking_requests SET payment_status = ?, updated_at = ?
    WHERE id = ? AND coach_id = ? AND status IN ('confirmed', 'completed')
  `).bind(paid ? "offline_paid" : "offline_unpaid", Date.now(), bookingId, identity.coachId).run();
  if (!result.meta.changes) throw new ApiError(409, "payment_status_rejected", "当前预约不能修改线下收款状态");
  return { bookingId, paymentStatus: paid ? "offline_paid" : "offline_unpaid" };
}
