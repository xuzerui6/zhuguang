import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { handleApiRequest } from "../server/api/router";
import type { ApiEnv } from "../server/api/contracts";
import { keyedHash } from "../server/api/security";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

class StatementAdapter implements D1PreparedStatement {
  constructor(private database: DatabaseSync, private query: string, private values: unknown[] = []) {}
  bind(...values: unknown[]) { return new StatementAdapter(this.database, this.query, values); }
  async first<T = Record<string, unknown>>(column?: string) {
    const row = this.database.prepare(this.query).get(...this.values as SQLInputValue[]) as T | undefined;
    return column ? ((row as Record<string, unknown> | undefined)?.[column] as T ?? null) : row ?? null;
  }
  async all<T = Record<string, unknown>>() {
    const results = this.database.prepare(this.query).all(...this.values as SQLInputValue[]) as T[];
    return { meta: {}, results, success: true };
  }
  async run<T = Record<string, unknown>>() {
    const result = this.database.prepare(this.query).run(...this.values as SQLInputValue[]);
    return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }, results: [] as T[], success: true };
  }
}

class D1Adapter implements D1Database {
  constructor(readonly sqlite = new DatabaseSync(":memory:")) {}
  prepare(query: string) { return new StatementAdapter(this.sqlite, query); }
  async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run<T>());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  async exec(query: string) { this.sqlite.exec(query); return { count: 1, duration: 0 }; }
}

const context = { waitUntil(promise: Promise<unknown>) { void promise.catch(() => undefined); } };

async function request(env: ApiEnv, path: string, init: RequestInit = {}) {
  const response = await handleApiRequest(new Request(`https://api.local${path}`, init), env, context);
  assert.ok(response);
  const payload = response.headers.get("content-type")?.includes("json") ? await response.json() as Record<string, unknown> : null;
  return { payload, response };
}

function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { body: JSON.stringify(body), headers: { "content-type": "application/json", "x-device-id": "device-test", ...headers }, method: "POST" };
}

async function migrate(database: D1Adapter) {
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of ["0000_late_hawkeye.sql", "0001_gifted_glorian.sql", "0002_brave_raza.sql"]) {
    const source = await readFile(new URL(file, directory), "utf8");
    for (const statement of source.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.sqlite.exec(statement);
  }
  database.sqlite.exec("PRAGMA foreign_keys = ON");
}

function seedSupply(database: D1Adapter) {
  const now = Date.now();
  const startsAt = now + 24 * 60 * 60_000;
  const endsAt = startsAt + 90 * 60_000;
  database.sqlite.prepare(`
    INSERT INTO coaches
      (id, name, sport, city, district, level, title, bio, price_fen, trial_price_fen, rating_basis_points, lessons, review_count,
       experience_years, response_minutes, audience_json, goals_json, strengths_json, availability_summary_json, audit_status, created_at, updated_at)
    VALUES (1, '周明', '羽毛球', '北京', '朝阳区', '国家队退役', '专项提升教练', '十年专业训练经验', 52000, 9900, 492, 386, 128,
      10, 9, '["青少年"]', '["专项提升"]', '["步伐与移动"]', '["周末 10:00"]', 'approved', ?, ?)
  `).run(now, now);
  database.sqlite.prepare("INSERT INTO venues (id, coach_id, name, address, city, district, active, created_at) VALUES ('venue-1', 1, '朝阳体育中心', '朝阳区安定路 1 号', '北京', '朝阳区', 1, ?)").run(now);
  database.sqlite.prepare("INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, created_at, updated_at) VALUES ('slot-1', 1, 'venue-1', ?, ?, 'open', ?, ?)").run(startsAt, endsAt, now, now);
}

async function authenticate(env: ApiEnv, phone: string, favoriteCoachIds: number[] = []) {
  const challengeResult = await request(env, "/api/v1/auth/otp/request", json({ phone }));
  assert.equal(challengeResult.response.status, 201);
  const challengeId = ((challengeResult.payload?.data as Record<string, unknown>).challengeId) as string;
  const verifyResult = await request(env, "/api/v1/auth/otp/verify", json({ challengeId, code: "888888", favoriteCoachIds }));
  assert.equal(verifyResult.response.status, 200);
  return verifyResult.payload?.data as { accessToken: string; refreshToken: string };
}

test("D1 migration, auth rotation, favorite merge and slot concurrency form a real API loop", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = {
    APP_ENV: "test",
    AUTH_HASH_SECRET: "test-auth-hash-secret-with-adequate-length",
    DB: database,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  };

  const first = await authenticate(env, "13800000001", [1, 1]);
  const studentMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${first.accessToken}`, "x-device-id": "device-test" } });
  const studentIdentity = studentMe.payload?.data as { availableModes: string[]; userId: string };
  assert.deepEqual(studentIdentity.availableModes, ["student"]);
  database.sqlite.prepare("UPDATE coaches SET user_id = ? WHERE id = 1").run(studentIdentity.userId);
  database.sqlite.prepare("INSERT INTO user_roles (user_id, role, status, granted_at, updated_at) VALUES (?, 'coach', 'active', ?, ?)").run(studentIdentity.userId, Date.now(), Date.now());
  const coachMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${first.accessToken}`, "x-device-id": "device-test" } });
  assert.deepEqual((coachMe.payload?.data as { availableModes: string[] }).availableModes, ["student", "coach"]);
  const coachOverview = await request(env, "/api/v1/coach/overview", { headers: { authorization: `Bearer ${first.accessToken}`, "x-device-id": "device-test" } });
  assert.equal(coachOverview.response.status, 200);
  database.sqlite.prepare("UPDATE user_roles SET status = 'suspended' WHERE user_id = ? AND role = 'coach'").run(studentIdentity.userId);
  const revokedCoach = await request(env, "/api/v1/coach/overview", { headers: { authorization: `Bearer ${first.accessToken}`, "x-device-id": "device-test" } });
  assert.equal(revokedCoach.response.status, 403);
  database.sqlite.prepare("UPDATE user_roles SET status = 'active' WHERE user_id = ? AND role = 'coach'").run(studentIdentity.userId);
  const bootstrap = await request(env, "/api/v1/bootstrap", { headers: { authorization: `Bearer ${first.accessToken}`, "x-device-id": "device-test" } });
  assert.deepEqual((bootstrap.payload?.data as { favoriteCoachIds: number[] }).favoriteCoachIds, [1]);

  const refreshed = await request(env, "/api/v1/auth/refresh", json({ refreshToken: first.refreshToken }));
  assert.equal(refreshed.response.status, 200);
  const rotated = refreshed.payload?.data as { accessToken: string; refreshToken: string };

  const second = await authenticate(env, "13800000002");
  const bookingInit = (token: string, idempotencyKey: string) => json({ coachId: 1, learnerId: "client-draft", note: "重点提升反手", slotId: "slot-1", venueId: "venue-1" }, {
    authorization: `Bearer ${token}`,
    "idempotency-key": idempotencyKey,
  });
  const firstBooking = await request(env, "/api/v1/bookings", bookingInit(rotated.accessToken, "submit-1"));
  assert.equal(firstBooking.response.status, 201);
  const booking = firstBooking.payload?.data as { id: string; status: string; time: string };
  assert.equal(booking.status, "pending_coach");
  assert.match(booking.time, /^\d{2}:\d{2}$/u);

  const idempotentReplay = await request(env, "/api/v1/bookings", bookingInit(rotated.accessToken, "submit-1"));
  assert.equal((idempotentReplay.payload?.data as { id: string }).id, booking.id);

  const collision = await request(env, "/api/v1/bookings", bookingInit(second.accessToken, "submit-2"));
  assert.equal(collision.response.status, 409);
  assert.equal((collision.payload?.error as Record<string, unknown>).code, "slot_unavailable");

  const cancelled = await request(env, `/api/v1/bookings/${booking.id}/cancel`, json({}, { authorization: `Bearer ${rotated.accessToken}` }));
  assert.equal((cancelled.payload?.data as { status: string }).status, "cancelled_by_student");
  const afterRelease = await request(env, "/api/v1/bookings", bookingInit(second.accessToken, "submit-2"));
  assert.equal(afterRelease.response.status, 201);

  const replay = await request(env, "/api/v1/auth/refresh", json({ refreshToken: first.refreshToken }));
  assert.equal(replay.response.status, 401);
  assert.equal((replay.payload?.error as Record<string, unknown>).code, "refresh_reuse_detected");
  const revokedDevice = await request(env, "/api/v1/bootstrap", { headers: { authorization: `Bearer ${rotated.accessToken}`, "x-device-id": "device-test" } });
  assert.deepEqual((revokedDevice.payload?.data as { bookings: unknown[] }).bookings, []);

  const unauthorized = await request(env, "/api/v1/favorites/1", { method: "PUT" });
  assert.equal(unauthorized.response.status, 401);
  database.sqlite.close();
});

test("OTP policy enforces five attempts, hourly limits and production SMS configuration", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = {
    APP_ENV: "test",
    AUTH_HASH_SECRET: "test-auth-hash-secret-with-adequate-length",
    DB: database,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  };

  const challenge = await request(env, "/api/v1/auth/otp/request", json({ phone: "13800000003" }));
  const challengeId = ((challenge.payload?.data as Record<string, unknown>).challengeId) as string;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await request(env, "/api/v1/auth/otp/verify", json({ challengeId, code: "000000" }));
    assert.equal(result.response.status, attempt === 5 ? 423 : 400);
  }
  const locked = await request(env, "/api/v1/auth/otp/verify", json({ challengeId, code: "888888" }));
  assert.equal(locked.response.status, 423);

  const phone = "13800000004";
  const phoneHash = await keyedHash(phone, env.AUTH_HASH_SECRET!);
  const now = Date.now();
  for (let index = 0; index < 5; index += 1) {
    database.sqlite.prepare(`
      INSERT INTO auth_challenges
        (id, phone_hash, phone_encrypted, phone_last4, code_hash, ip_hash, attempts, expires_at, resend_after, created_at)
      VALUES (?, ?, 'encrypted', '0004', 'hash', ?, 0, ?, 0, ?)
    `).run(`rate-${index}`, phoneHash, `ip-${index}`, now + 60_000, now - index);
  }
  const rateLimited = await request(env, "/api/v1/auth/otp/request", json({ phone }));
  assert.equal(rateLimited.response.status, 429);
  assert.equal((rateLimited.payload?.error as Record<string, unknown>).code, "otp_rate_limited");

  const productionFailure = await request({ ...env, APP_ENV: "production" }, "/api/v1/auth/otp/request", json({ phone: "13800000005" }));
  assert.equal(productionFailure.response.status, 503);
  assert.equal((productionFailure.payload?.error as Record<string, unknown>).code, "sms_not_configured");
  database.sqlite.close();
});
