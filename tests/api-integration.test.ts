import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import { handleApiRequest } from "../server/api/router";
import type { ApiEnv } from "../server/api/contracts";
import { sendEmailOtp } from "../server/api/email";
import { requestEmailOtpD1 } from "../server/api/email-auth";
import { buildJPushPayload } from "../server/api/push";
import { keyedHash } from "../server/api/security";
import { sendOtpSms } from "../server/api/sms";
import { getOpsOverviewD1, listOpsLeadsD1, getOpsProductFunnelD1 } from "../server/api/operations";
import { classifyMetricEntityD1, updateOperatorCatalogItemD1 } from "../server/api/expansion";

test("P1 operational counts exclude unclassified/QA and classification audit is atomic", async () => {
  const database = new D1Adapter(); await migrate(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: 'test', DB: database };
  database.sqlite.exec(`INSERT INTO service_leads(id,contact_name,sport,district,goal,source,status,created_at,updated_at) VALUES
    ('qa-lead','QA','田径','通州区','isolated','qa','new',1,1),('real-lead','Test','田径','通州区','isolated','qa','new',1,1),('old-lead','Legacy','田径','通州区','isolated','qa','new',1,1);
    INSERT INTO product_events(id,session_id,surface,role,flow,step,outcome,created_at) VALUES ('event-qa','test','web','student','booking','start','ok',${Date.now()});`);
  assert.deepEqual(await listOpsLeadsD1(env), []);
  await classifyMetricEntityD1('service_lead','qa-lead','qa','隔离分类测试','operator','r1',env);
  await classifyMetricEntityD1('service_lead','real-lead','production_eligible','隔离分类测试','operator','r2',env);
  assert.equal((await listOpsLeadsD1(env)).length,1);
  const overview = await getOpsOverviewD1(env);
  assert.equal(overview.leads.reduce((n,row)=>n+Number(row.count),0),1);
  assert.equal((await getOpsProductFunnelD1(env)).length,0);
  await classifyMetricEntityD1('product_event','event-qa','qa','匿名事件分类','operator','r3',env);
  database.sqlite.exec("CREATE TRIGGER qa_fail_audit BEFORE INSERT ON ops_audit_logs BEGIN SELECT RAISE(ABORT,'injected audit failure'); END;");
  await assert.rejects(classifyMetricEntityD1('service_lead','qa-lead','production_eligible','审计失败测试','operator','r4',env),/injected/);
  assert.equal(database.sqlite.prepare("SELECT classification FROM entity_metric_classifications WHERE entity_id='qa-lead'").get()?.classification,'qa');
  const sport = database.sqlite.prepare('SELECT id,status FROM service_sports LIMIT 1').get()!;
  await assert.rejects(updateOperatorCatalogItemD1('sport',String(sport.id),'disabled','审计失败测试','operator','r5',env),/injected/);
  assert.equal(database.sqlite.prepare('SELECT status FROM service_sports WHERE id=?').get(sport.id as string)?.status,sport.status);
  assert.equal(database.sqlite.prepare('SELECT count(*) AS n FROM service_leads').get()?.n,3);
});

test("patched Tencent SMS SDK constructs and retains success/failure semantics", async () => {
  const sdk = await import("tencentcloud-sdk-nodejs-sms");
  const proto = sdk.sms.v20210111.Client.prototype;
  const original = proto.SendSms;
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', TENCENTCLOUD_SECRET_ID: "isolated", TENCENTCLOUD_SECRET_KEY: "isolated", TENCENT_SMS_SDK_APP_ID: "test", TENCENT_SMS_SIGN_NAME: "test", TENCENT_SMS_TEMPLATE_ID: "test" };
  try {
    proto.SendSms = async (input) => { assert.deepEqual(input.PhoneNumberSet, ["+8613800000000"]); return { RequestId: "test-send", SendStatusSet: [{ Code: "Ok" }] }; };
    assert.equal(await sendOtpSms("13800000000", "000000", "test-challenge", env), "test-send");
    proto.SendSms = async () => ({ RequestId: "test-failure", SendStatusSet: [{ Code: "Failed" }] });
    await assert.rejects(sendOtpSms("13800000000", "000000", "test-challenge", env), (error: unknown) => (error as { status?: number }).status === 502);
  } finally { proto.SendSms = original; }
});

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

test("Tencent SES sends a signed private-subject OTP email", async () => {
  const originalFetch = globalThis.fetch;
  let captured: { body?: string; headers?: HeadersInit } = {};
  globalThis.fetch = async (_input, init) => {
    captured = { body: String(init?.body || ""), headers: init?.headers };
    return Response.json({ Response: { MessageId: "ses-message-1", RequestId: "ses-request-1" } });
  };
  try {
    const messageId = await sendEmailOtp("learner@example.com", "123456", {
      TENCENTCLOUD_SECRET_ID: "test-secret-id",
      TENCENTCLOUD_SECRET_KEY: "test-secret-key",
      TENCENT_SES_FROM_EMAIL: "no-reply@notify.beijingzhuguang.top",
      TENCENT_SES_FROM_NAME: "逐光",
      TENCENT_SES_REGION: "ap-guangzhou",
      TENCENT_SES_TEMPLATE_ID: "57672",
    });
    const payload = JSON.parse(captured.body || "{}") as {
      FromEmailAddress: string;
      Template: { TemplateData: string; TemplateID: number };
      Subject: string;
    };
    const headers = new Headers(captured.headers);
    assert.equal(messageId, "ses-message-1");
    assert.equal(payload.Subject, "逐光登录验证码");
    assert.doesNotMatch(payload.Subject, /123456/u);
    assert.match(payload.FromEmailAddress, /no-reply@notify\.beijingzhuguang\.top/u);
    assert.equal(payload.Template.TemplateID, 57672);
    assert.deepEqual(JSON.parse(payload.Template.TemplateData), { code: "123456" });
    assert.match(headers.get("authorization") || "", /^TC3-HMAC-SHA256 Credential=test-secret-id\//u);
    assert.equal(headers.get("x-tc-region"), "ap-guangzhou");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("JPush payloads use fixed channels, private lock-screen copy and role deep links", () => {
  const payload = buildJPushPayload({
    body: "private conversation text",
    deep_link: "zhuguang://student/messages",
    notification_id: "notification-test",
    push_registration_id: "registration-test",
    target_mode: "student",
    title: "服务消息",
    type: "service_message",
  });
  assert.deepEqual(payload.audience.registration_id, ["registration-test"]);
  assert.equal(payload.notification.android.channel_id, "zhuguang_message");
  assert.equal(payload.notification.android.extras.deepLink, "zhuguang://student/messages");
  assert.equal(payload.notification.android.extras.targetMode, "student");
  assert.equal("intent" in payload.notification.android, false);
  assert.notEqual(payload.notification.android.alert, "private conversation text");
  assert.equal("small_icon" in payload.notification.android, false);

  const operatorPayload = buildJPushPayload({
    body: "booking status changed",
    deepLink: "zhuguang://student/bookings",
    push_registration_id: "registration-test",
    targetMode: "student",
    title: "booking",
    type: "booking_status",
  });
  assert.equal("intent" in operatorPayload.notification.android, false);
  assert.equal(operatorPayload.notification.android.extras.targetMode, "student");
});

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
  private batchQueue: Promise<unknown> = Promise.resolve();
  constructor(readonly sqlite = new DatabaseSync(":memory:")) {}
  prepare(query: string) { return new StatementAdapter(this.sqlite, query); }
  async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]) {
    const result = this.batchQueue.then(() => this.executeBatch<T>(statements));
    this.batchQueue = result.catch(() => undefined);
    return result;
  }
  private async executeBatch<T>(statements: D1PreparedStatement[]) {
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

class MemoryR2 implements R2Bucket {
  readonly objects = new Map<string, { bytes: Uint8Array; customMetadata?: Record<string, string> }>();

  async delete(key: string) { this.objects.delete(key); }

  async get(key: string) {
    const stored = this.objects.get(key);
    return stored ? this.object(stored) : null;
  }

  async head(key: string) {
    const stored = this.objects.get(key);
    return stored ? this.object(stored) : null;
  }

  async put(key: string, value: ReadableStream | ArrayBuffer | string, options?: Record<string, unknown>) {
    const bytes = typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, {
      bytes,
      customMetadata: options?.customMetadata as Record<string, string> | undefined,
    });
    return null;
  }

  private object(stored: { bytes: Uint8Array; customMetadata?: Record<string, string> }): R2ObjectBody {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(stored.bytes);
        controller.close();
      },
    });
    return {
      body,
      customMetadata: stored.customMetadata,
      httpEtag: "test-etag",
      size: stored.bytes.byteLength,
      writeHttpMetadata() {},
    };
  }
}

const context = { waitUntil(promise: Promise<unknown>) { void promise.catch(() => undefined); } };

test("operator endpoints distinguish missing authentication from wrong role", async () => {
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", OPERATOR_API_SECRET: "isolated-operator-key" };
  const anonymous = await request(env, "/api/v1/operator/overview");
  assert.equal(anonymous.response.status, 401);
  assert.equal((anonymous.payload?.error as { code: string }).code, "authentication_required");
  const forged = await request(env, "/api/v1/operator/overview", { headers: { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": "invalid" } });
  assert.equal(forged.response.status, 401);
  const other = await request(env, "/api/v1/operator/overview", { headers: { "x-operator-actor": "student@example.com", "x-operator-secret": env.OPERATOR_API_SECRET! } });
  assert.equal(other.response.status, 403);
  assert.equal((other.payload?.error as { code: string }).code, "role_forbidden");
});

test("operator public coach count excludes demo and unapproved supply", async () => {
  const database = new D1Adapter(); await migrate(database); seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, OPERATOR_API_SECRET: "count-test" };
  await classifyMetricEntityD1('coach','1','production_eligible','隔离供给核验','operator','count',env);
  const readCount = async () => {
    const result = await request(env, "/api/v1/operator/overview", { headers: { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": "count-test" } });
    assert.equal(result.response.status, 200);
    return ((result.payload?.data as { coaches: Array<{ status: string; count: number }> }).coaches).find((row) => row.status === "online")?.count ?? 0;
  };
  database.sqlite.prepare("UPDATE coaches SET profile_kind='demo',listing_status='online' WHERE id=1").run();
  assert.equal(await readCount(), 0);
  database.sqlite.prepare("UPDATE coaches SET profile_kind='real' WHERE id=1").run();
  assert.equal(await readCount(), 1);
  database.sqlite.prepare("UPDATE coaches SET audit_status='suspended' WHERE id=1").run();
  assert.equal(await readCount(), 0);
  database.sqlite.close();
});

test("P1 real-clock 31-minute isolated web session soak", { skip: process.env.ZHUGUANG_SESSION_SOAK !== "true", timeout: 1_930_000 }, async () => {
  const { renewWebSession, forwardRenewedCookies } = await import("../app/_lib/web-auth-refresh");
  const database = new D1Adapter();
  await migrate(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, AUTH_HASH_SECRET: "soak-auth-secret-with-sufficient-length", PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 41).toString("base64"), OPERATOR_API_SECRET: "isolated-proxy-secret" };
  const session = await authenticate(env, "13800000991");
  const webEnv = { ZHUGUANG_MOBILE_API_URL: "https://api.local", ZHUGUANG_PILOT_APP_KEY: "isolated-channel", ZHUGUANG_OPERATOR_API_SECRET: env.OPERATOR_API_SECRET };
  let cookie = `zg_web_access=${session.accessToken}; zg_web_refresh=${session.refreshToken}; zg_web_device=device-test`;
  let refreshedAt = 0;
  const fetcher: typeof fetch = async (input, init) => (await handleApiRequest(new Request(String(input), init), env, context))!;
  const started = Date.now();
  const report = { startedAt: new Date(started).toISOString(), completed: false, checks: [] as Array<{ minute: number; authenticated: boolean; rotated: boolean }> };
  await mkdir("artifacts/qa/code25", { recursive: true });
  for (const minute of [0, 16, 31]) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, started + minute * 60_000 - Date.now())));
    if (minute === 31 && refreshedAt) await new Promise((resolve) => setTimeout(resolve, Math.max(0, refreshedAt + 15 * 60_000 + 1000 - Date.now())));
    const incoming = new Request("https://web.local/student", { headers: { cookie } });
    const token = cookie.match(/zg_web_access=([^;]+)/u)?.[1];
    const identity = await fetcher("https://api.local/api/v1/me", { headers: { authorization: `Bearer ${token}`, "x-device-id": "device-test" } });
    const result = await renewWebSession(incoming, webEnv, fetcher, identity.status === 401);
    assert.ok(identity.ok || result.authenticated);
    cookie = forwardRenewedCookies(incoming, result.changes).get("cookie")!;
    if (result.changes.length) refreshedAt = Date.now();
    console.log(`SESSION_SOAK minute=${minute} authenticated=true rotated=${result.changes.length > 0}`);
    report.checks.push({ minute, authenticated: true, rotated: result.changes.length > 0 });
    await writeFile("artifacts/qa/code25/session-soak.json", JSON.stringify(report, null, 2));
  }
  assert.equal(database.sqlite.prepare("SELECT count(*) AS total FROM session_rotation_claims").get()?.total, 2);
  report.completed = true;
  await writeFile("artifacts/qa/code25/session-soak.json", JSON.stringify(report, null, 2));
  database.sqlite.close();
});

async function request(env: ApiEnv, path: string, init: RequestInit = {}) {
  const response = await handleApiRequest(new Request(`https://api.local${path}`, init), env, context);
  assert.ok(response);
  const payload = response.headers.get("content-type")?.includes("json") ? await response.json() as Record<string, unknown> : null;
  return { payload, response };
}

function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { body: JSON.stringify(body), headers: { "content-type": "application/json", "x-device-id": "device-test", ...headers }, method: "POST" };
}

async function migrate(database: D1Adapter, through23 = true) {
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of ["0000_late_hawkeye.sql", "0001_gifted_glorian.sql", "0002_brave_raza.sql", "0003_slimy_obadiah_stane.sql", "0004_rainy_vector.sql", "0006_verified_coach_profiles.sql", "0007_operational_closure.sql", "0008_public_app_downloads.sql", "0009_business_scheduling.sql", "0010_student_time_requests.sql", "0011_user_account_profiles.sql", "0012_trusted_reviews_and_telemetry.sql", "0013_review_closure_and_message_receipts.sql", "0014_secure_service_leads.sql", "0015_beijing_service_catalog.sql", "0016_booking_contract_and_evidence.sql", "0017_transaction_sandbox.sql", "0018_trust_metric_provenance.sql"]) {
    const source = await readFile(new URL(file, directory), "utf8");
    for (const statement of source.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) database.sqlite.exec(statement);
  }
  database.sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0019_session_rotation_receipts.sql", "0020_completion_decision_idempotency.sql", "0021_entity_metric_classification.sql", "0022_public_review_provenance.sql", "0023_release_safety_and_classification.sql"]) {
    if (!through23 && file.startsWith("0023")) continue;
    database.sqlite.exec(await readFile(new URL(file, directory), "utf8"));
  }
}

test("verified reviews enforce eligibility, privacy, thresholds, reactions and report resolution", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const operatorSecret = "operator-review-secret";
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "review-test-auth-secret-with-adequate-length",
    DB: database,
    OPERATOR_API_SECRET: operatorSecret,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 31).toString("base64"),
  };
  const session = await authenticate(env, "13800000881");
  const me = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${session.accessToken}` } });
  const userId = String((me.payload?.data as { userId: string }).userId);
  const now = Date.now();
  database.sqlite.prepare("INSERT INTO learner_profiles (id, user_id, name, relation, sport, level, goal, created_at, updated_at) VALUES ('learner-review', ?, '测试学员', 'self', '羽毛球', '初学', '专项提升', ?, ?)").run(userId, now, now);
  database.sqlite.prepare("INSERT INTO booking_requests (id, idempotency_key, user_id, learner_profile_id, coach_id, venue_id, slot_id, status, fee_fen, payment_status, note, created_at, updated_at, completed_at) VALUES ('booking-review', 'review-booking', ?, 'learner-review', 1, 'venue-1', 'slot-1', 'completed', 9900, 'offline_paid', 'QA review', ?, ?, ?)").run(userId, now, now, now);

  const tooShort = await request(env, "/api/v1/reviews", json({ bookingId: "booking-review", body: "太短", rating: 5, tags: ["专业可靠"] }, { authorization: `Bearer ${session.accessToken}` }));
  assert.equal((tooShort.payload?.error as { code: string }).code, "invalid_review_body");
  const created = await request(env, "/api/v1/reviews", json({ bookingId: "booking-review", body: "教练讲解清晰，训练计划针对性强，整节课沟通顺畅并且准时守约。", rating: 5, tags: ["专业可靠", "讲解清晰", "沟通顺畅"] }, { authorization: `Bearer ${session.accessToken}` }));
  assert.equal(created.response.status, 201);
  const reviewId = String((created.payload?.data as { id: string }).id);
  const operatorHeaders = { "content-type": "application/json", "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };
  const approved = await request(env, `/api/v1/operator/reviews/${reviewId}`, { body: JSON.stringify({ note: "真实履约内容审核通过", status: "approved" }), headers: operatorHeaders, method: "PATCH" });
  assert.equal(approved.response.status, 200);

  for (const [entityType, entityId] of [["user", userId], ["booking", "booking-review"], ["coach", "1"], ["review", reviewId]]) {
    const classified = await request(env, "/api/v1/operator/trust-metrics/classifications", json({ entityType, entityId, classification: "production_eligible", reason: "隔离测试公开评价资格" }, operatorHeaders));
    assert.equal(classified.response.status, 201);
  }

  env.PILOT_APP_KEY = "review-test-app-key";
  const publicReviews = await request(env, "/api/v1/coaches/1/reviews");
  assert.equal(publicReviews.response.status, 200);
  const publicData = publicReviews.payload?.data as { items: Array<{ reviewerLabel: string }>; summary: { averageRating: number | null; total: number } };
  assert.equal(publicData.summary.total, 1);
  assert.equal(publicData.summary.averageRating, null);
  assert.equal(publicData.items[0].reviewerLabel, "平台履约学员");
  env.PILOT_APP_KEY = undefined;

  assert.equal((await request(env, `/api/v1/reviews/${reviewId}/helpful`, json({}, { authorization: `Bearer ${session.accessToken}` }))).response.status, 201);
  assert.equal((await request(env, `/api/v1/reviews/${reviewId}/helpful`, json({}, { authorization: `Bearer ${session.accessToken}` }))).response.status, 409);
  assert.equal((await request(env, `/api/v1/reviews/${reviewId}/report`, json({ reason: "包含需要运营核查的信息" }, { authorization: `Bearer ${session.accessToken}` }))).response.status, 201);
  const resolved = await request(env, `/api/v1/operator/reviews/${reviewId}/report`, { body: JSON.stringify({ decision: "keep", note: "核查后未发现隐私或不实信息" }), headers: operatorHeaders, method: "PATCH" });
  assert.equal(resolved.response.status, 200);
  assert.equal(database.sqlite.prepare("SELECT report_count FROM coach_reviews WHERE id = ?").get(reviewId)?.report_count, 0);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS count FROM ops_audit_logs WHERE action = 'review.report.resolve'").get()?.count, 1);
  database.sqlite.close();
});

test("completed courses expose review eligibility, notify once and allow one rejected resubmission", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const operatorSecret = "operator-review-resubmit";
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", AUTH_HASH_SECRET: "review-resubmit-auth-secret-long-enough", DB: database, OPERATOR_API_SECRET: operatorSecret, PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 33).toString("base64") };
  const student = await authenticate(env, "13800000882");
  const coach = await authenticate(env, "13800000883");
  const studentMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${student.accessToken}` } });
  const coachMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${coach.accessToken}` } });
  const studentId = String((studentMe.payload?.data as { userId: string }).userId);
  const coachUserId = String((coachMe.payload?.data as { userId: string }).userId);
  const now = Date.now();
  database.sqlite.prepare("UPDATE coaches SET user_id = ? WHERE id = 1").run(coachUserId);
  database.sqlite.prepare("INSERT INTO user_roles (user_id, role, status, granted_at, updated_at) VALUES (?, 'coach', 'active', ?, ?)").run(coachUserId, now, now);
  database.sqlite.prepare("INSERT INTO learner_profiles (id, user_id, name, relation, sport, level, goal, created_at, updated_at) VALUES ('learner-review-flow', ?, '测试学员', 'self', '羽毛球', '初学', '专项提升', ?, ?)").run(studentId, now, now);
  database.sqlite.prepare("UPDATE availability_slots SET status = 'booked' WHERE id = 'slot-1'").run();
  database.sqlite.prepare("INSERT INTO booking_requests (id, idempotency_key, user_id, learner_profile_id, coach_id, venue_id, slot_id, status, fee_fen, payment_status, note, created_at, updated_at) VALUES ('booking-review-flow', 'review-flow', ?, 'learner-review-flow', 1, 'venue-1', 'slot-1', 'confirmed', 9900, 'offline_paid', 'QA review flow', ?, ?)").run(studentId, now, now);

  const completed = await request(env, "/api/v1/coach/bookings/booking-review-flow/status", json({ status: "completed" }, { authorization: `Bearer ${coach.accessToken}` }));
  assert.equal(completed.response.status, 200);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS count FROM notifications WHERE id = 'review_available_booking-review-flow'").get()?.count, 1);
  const bootstrap = await request(env, "/api/v1/bootstrap", { headers: { authorization: `Bearer ${student.accessToken}` } });
  const booking = (bootstrap.payload?.data as { bookings: Array<{ review: { canSubmit: boolean; status: string } }> }).bookings[0];
  assert.deepEqual({ canSubmit: booking.review.canSubmit, status: booking.review.status }, { canSubmit: true, status: "available" });

  const created = await request(env, "/api/v1/reviews", json({ bookingId: "booking-review-flow", body: "课程安排清晰，教练能够针对动作问题逐项讲解，训练过程认真负责。", rating: 4, tags: ["讲解清晰"] }, { authorization: `Bearer ${student.accessToken}` }));
  const reviewId = String((created.payload?.data as { id: string }).id);
  const operatorHeaders = { "content-type": "application/json", "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };
  await request(env, `/api/v1/operator/reviews/${reviewId}`, { body: JSON.stringify({ note: "请补充更具体的训练体验", status: "rejected" }), headers: operatorHeaders, method: "PATCH" });
  const rejectedBootstrap = await request(env, "/api/v1/bootstrap", { headers: { authorization: `Bearer ${student.accessToken}` } });
  const rejected = (rejectedBootstrap.payload?.data as { bookings: Array<{ review: { canResubmit: boolean; rejectionReason: string } }> }).bookings[0].review;
  assert.equal(rejected.canResubmit, true);
  assert.equal(rejected.rejectionReason, "请补充更具体的训练体验");
  const resubmitted = await request(env, `/api/v1/reviews/${reviewId}/resubmit`, { body: JSON.stringify({ body: "教练针对起动、移动和击球衔接进行了逐项纠正，并给出了课后练习建议。", rating: 5, tags: ["专业可靠", "计划有针对性"] }), headers: { authorization: `Bearer ${student.accessToken}`, "content-type": "application/json" }, method: "PATCH" });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS count FROM coach_review_versions WHERE review_id = ?").get(reviewId)?.count, 2);
  const repeated = await request(env, `/api/v1/reviews/${reviewId}/resubmit`, { body: JSON.stringify({ body: "再次提交同一评价内容用于验证重复操作会被服务端拒绝，确保只有一次机会。", rating: 5, tags: [] }), headers: { authorization: `Bearer ${student.accessToken}`, "content-type": "application/json" }, method: "PATCH" });
  assert.equal(repeated.response.status, 409);
  database.sqlite.close();
});

test("coach conversations preserve unread student messages and clear them only for the owning coach", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", AUTH_HASH_SECRET: "message-receipt-auth-secret-long-enough", DB: database, PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 34).toString("base64") };
  const student = await authenticate(env, "13800000884");
  const coach = await authenticate(env, "13800000885");
  const studentMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${student.accessToken}` } });
  const coachMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${coach.accessToken}` } });
  const studentId = String((studentMe.payload?.data as { userId: string }).userId);
  const coachUserId = String((coachMe.payload?.data as { userId: string }).userId);
  const now = Date.now();
  database.sqlite.prepare("UPDATE user_profiles SET nickname = '晨光学员' WHERE user_id = ?").run(studentId);
  database.sqlite.prepare("UPDATE coaches SET user_id = ? WHERE id = 1").run(coachUserId);
  database.sqlite.prepare("INSERT INTO user_roles (user_id, role, status, granted_at, updated_at) VALUES (?, 'coach', 'active', ?, ?)").run(coachUserId, now, now);
  const conversation = await request(env, "/api/v1/conversations", json({ coachId: 1 }, { authorization: `Bearer ${student.accessToken}` }));
  const conversationId = String((conversation.payload?.data as { id: string }).id);
  await request(env, `/api/v1/conversations/${conversationId}/messages`, json({ body: "教练您好，我想确认训练前需要准备哪些装备。" }, { authorization: `Bearer ${student.accessToken}` }));
  assert.equal(database.sqlite.prepare("SELECT read_at FROM messages WHERE conversation_id = ? AND sender_type = 'student'").get(conversationId)?.read_at, null);
  const overview = await request(env, "/api/v1/coach/overview", { headers: { authorization: `Bearer ${coach.accessToken}` } });
  const coachConversation = (overview.payload?.data as { conversations: Array<{ title: string; unreadCount: number }> }).conversations[0];
  assert.equal(coachConversation.title, "晨光学员");
  assert.equal(coachConversation.unreadCount, 1);
  const read = await request(env, `/api/v1/coach/conversations/${conversationId}/read`, json({}, { authorization: `Bearer ${coach.accessToken}` }));
  assert.equal(read.response.status, 200);
  assert.notEqual(database.sqlite.prepare("SELECT read_at FROM messages WHERE conversation_id = ? AND sender_type = 'student'").get(conversationId)?.read_at, null);
  const otherCoach = await authenticate(env, "13800000886");
  const denied = await request(env, `/api/v1/coach/conversations/${conversationId}/read`, json({}, { authorization: `Bearer ${otherCoach.accessToken}` }));
  assert.equal(denied.response.status, 403);
  database.sqlite.close();
});

test("registered Android and iOS devices can request email OTP when Turnstile is unreachable", async () => {
  const database = new D1Adapter();
  await migrate(database);
  const deviceId = "device_123e4567-e89b-42d3-a456-426614174000";
  const now = Date.now();
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "test-auth-hash-secret-with-adequate-length",
    DB: database,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    PILOT_APP_KEY: "test-app-key",
    TENCENTCLOUD_SECRET_ID: "test-secret-id",
    TENCENTCLOUD_SECRET_KEY: "test-secret-key",
    TENCENT_SES_FROM_EMAIL: "no-reply@notify.beijingzhuguang.top",
    TENCENT_SES_REGION: "ap-guangzhou",
    TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  };
  const nativeHeaders = {
    "x-app-platform": "android",
    "x-app-version-code": "16",
    "x-device-id": deviceId,
    "x-zhuguang-app-key": "test-app-key",
  };

  await assert.rejects(
    () => requestEmailOtpD1(new Request("https://api.local/api/v1/auth/email/request"), { email: "learner@example.com" }, env),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "turnstile_required",
  );
  await assert.rejects(
    () => requestEmailOtpD1(new Request("https://api.local/api/v1/auth/email/request", { headers: nativeHeaders }), { email: "learner@example.com" }, env),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "turnstile_required",
  );

  database.sqlite.prepare(`
    INSERT INTO app_installations
      (id, platform, app_version_code, app_version_name, status, last_seen_at, created_at, updated_at)
    VALUES (?, 'android', 16, '1.3.1', 'active', ?, ?, ?)
  `).run(deviceId, now, now, now);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ Response: { MessageId: "native-otp-message", RequestId: "native-otp-request" } });
  try {
    const result = await requestEmailOtpD1(
      new Request("https://api.local/api/v1/auth/email/request", { headers: nativeHeaders }),
      { email: "learner@example.com" },
      env,
    );
    assert.equal(result.expiresIn, 300);
    assert.equal(database.sqlite.prepare("SELECT status FROM email_deliveries LIMIT 1").get()?.status, "sent");

    const iosDeviceId = "device_223e4567-e89b-42d3-a456-426614174001";
    const iosHeaders = {
      "x-app-platform": "ios",
      "x-app-version-code": "19",
      "x-device-id": iosDeviceId,
      "x-zhuguang-app-key": "test-app-key",
    };
    database.sqlite.prepare(`
      INSERT INTO app_installations
        (id, platform, app_version_code, app_version_name, status, last_seen_at, created_at, updated_at)
      VALUES (?, 'ios', 19, '1.3.4', 'active', ?, ?, ?)
    `).run(iosDeviceId, now, now, now);
    const iosResult = await requestEmailOtpD1(
      new Request("https://api.local/api/v1/auth/email/request", { headers: iosHeaders }),
      { email: "ios-learner@example.com" },
      env,
    );
    assert.equal(iosResult.expiresIn, 300);
  } finally {
    globalThis.fetch = originalFetch;
  }

  database.sqlite.prepare("UPDATE app_installations SET status = 'revoked' WHERE id = ?").run(deviceId);
  await assert.rejects(
    () => requestEmailOtpD1(new Request("https://api.local/api/v1/auth/email/request", { headers: nativeHeaders }), { email: "second@example.com" }, env),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "turnstile_required",
  );
});

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
  database.sqlite.prepare("INSERT OR IGNORE INTO coach_service_regions (coach_id, region_id, is_primary, created_at) VALUES (1, 'beijing-chaoyang', 1, ?)").run(now);
  database.sqlite.prepare("INSERT OR IGNORE INTO coach_sports (coach_id, sport_id, is_primary, created_at) VALUES (1, 'sport-badminton', 1, ?)").run(now);
  database.sqlite.prepare("INSERT INTO venues (id, coach_id, name, address, city, district, active, created_at) VALUES ('venue-1', 1, '朝阳体育中心', '朝阳区安定路 1 号', '北京', '朝阳区', 1, ?)").run(now);
  database.sqlite.prepare("INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, created_at, updated_at) VALUES ('slot-1', 1, 'venue-1', ?, ?, 'open', ?, ?)").run(startsAt, endsAt, now, now);
}

async function authenticate(env: ApiEnv, phone: string, favoriteCoachIds: number[] = []) {
  const challengeResult = await request(env, "/api/v1/auth/otp/request", json({ phone }));
  assert.equal(challengeResult.response.status, 201);
  const challengeId = ((challengeResult.payload?.data as Record<string, unknown>).challengeId) as string;
  const verifyResult = await request(env, "/api/v1/auth/otp/verify", json({ challengeId, code: "888888", favoriteCoachIds }));
  assert.equal(verifyResult.response.status, 200);
  const session = verifyResult.payload?.data as { accessToken: string; refreshToken: string };
  const profile = await request(env, "/api/v1/me/profile", {
    body: JSON.stringify({ bio: "", district: "通州区", nickname: `测试用户${phone.slice(-2)}` }),
    headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json", "x-device-id": "device-test" },
    method: "PATCH",
  });
  assert.equal(profile.response.status, 200);
  return session;
}

test("account profiles validate identity claims, protect avatar tickets and merge duplicate contacts safely", async () => {
  const database = new D1Adapter();
  const media = new MemoryR2();
  await migrate(database);
  const operatorSecret = "operator-test-secret";
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "profile-test-auth-secret-with-adequate-length",
    DB: database,
    MEDIA: media,
    MOBILE_API_ORIGIN: "https://api.beijingzhuguang.top",
    OPERATOR_API_SECRET: operatorSecret,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString("base64"),
    TENCENTCLOUD_SECRET_ID: "test-secret-id",
    TENCENTCLOUD_SECRET_KEY: "test-secret-key",
    TENCENT_SES_FROM_EMAIL: "no-reply@notify.beijingzhuguang.top",
    TENCENT_SES_REGION: "ap-guangzhou",
    UPDATE_DOWNLOAD_SECRET: "profile-avatar-ticket-secret",
  };
  const first = await authenticate(env, "13800000101");
  const second = await authenticate(env, "13800000102");
  const firstMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${first.accessToken}` } });
  const secondMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${second.accessToken}` } });
  const firstUserId = String((firstMe.payload?.data as { userId: string }).userId);
  const secondUserId = String((secondMe.payload?.data as { userId: string }).userId);

  const reserved = await request(env, "/api/v1/me/profile", {
    body: JSON.stringify({ bio: "", district: "通州区", nickname: "逐光官方客服" }),
    headers: { authorization: `Bearer ${first.accessToken}`, "content-type": "application/json" },
    method: "PATCH",
  });
  assert.equal(reserved.response.status, 422);
  assert.equal((reserved.payload?.error as { code: string }).code, "nickname_reserved");
  const contactNickname = await request(env, "/api/v1/me/profile", {
    body: JSON.stringify({ bio: "", district: "通州区", nickname: "联系13800000000" }),
    headers: { authorization: `Bearer ${first.accessToken}`, "content-type": "application/json" },
    method: "PATCH",
  });
  assert.equal((contactNickname.payload?.error as { code: string }).code, "nickname_contains_contact");

  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  for (const session of [first, second]) {
    const uploaded = await request(env, "/api/v1/me/avatar", {
      body: webp,
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "image/webp", "x-device-id": "device-profile-test" },
      method: "POST",
    });
    assert.equal(uploaded.response.status, 201);
  }
  assert.equal(media.objects.size, 2);
  const firstProfile = await request(env, "/api/v1/me/profile", { headers: { authorization: `Bearer ${first.accessToken}` } });
  const avatarUrl = new URL(String((firstProfile.payload?.data as { avatarUrl: string }).avatarUrl));
  const avatar = await request(env, `${avatarUrl.pathname}${avatarUrl.search}`);
  assert.equal(avatar.response.status, 200);
  const tampered = await request(env, `${avatarUrl.pathname}?expires=${avatarUrl.searchParams.get("expires")}&token=invalid`);
  assert.equal(tampered.response.status, 403);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ Response: { MessageId: "bind-message", RequestId: "bind-request" } });
  try {
    const bindEmail = async (accessToken: string) => {
      const challenge = await request(env, "/api/v1/me/contact-challenges", json({ kind: "email", value: "shared@example.com" }, { authorization: `Bearer ${accessToken}` }));
      assert.equal(challenge.response.status, 201);
      const challengeId = String((challenge.payload?.data as { challengeId: string }).challengeId);
      return request(env, `/api/v1/me/contact-challenges/${challengeId}/verify`, json({ code: "888888" }, { authorization: `Bearer ${accessToken}` }));
    };
    assert.equal((await bindEmail(first.accessToken)).response.status, 200);
    const conflict = await bindEmail(second.accessToken);
    assert.equal((conflict.payload?.data as { mergeRequired: boolean }).mergeRequired, true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const operatorHeaders = { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };
  const merges = await request(env, "/api/v1/operator/account-merge-requests", { headers: operatorHeaders });
  const mergeId = String((merges.payload?.data as Array<{ id: string }>)[0].id);
  const approved = await request(env, `/api/v1/operator/account-merge-requests/${mergeId}`, {
    body: JSON.stringify({ decision: "approved", note: "测试账号重复联系方式合并", primaryUserId: firstUserId }),
    headers: { ...operatorHeaders, "content-type": "application/json" },
    method: "PATCH",
  });
  assert.equal(approved.response.status, 200);
  assert.equal(database.sqlite.prepare("SELECT status FROM users WHERE id = ?").get(secondUserId)?.status, "merged");
  assert.equal(media.objects.size, 1);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS count FROM ops_audit_logs WHERE action = 'account.merge.approve'").get()?.count, 1);
  database.sqlite.close();
});

test("D1 migration, auth rotation, favorite merge and slot concurrency form a real API loop", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
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
  const pricedSlots = await request(env, "/api/v1/coaches/1/slots");
  const pricedSlot = (pricedSlots.payload?.data as Array<{ durationMinutes: number; regularFeeFen: number; trialFeeFen: number }>)[0];
  assert.equal(pricedSlot.durationMinutes, 90);
  assert.equal(pricedSlot.regularFeeFen, 78000);
  assert.equal(pricedSlot.trialFeeFen, 14850);
  const bookingInit = (token: string, idempotencyKey: string, slotId = "slot-1") => json({ coachId: 1, learnerId: "client-draft", note: "重点提升反手", slotId, venueId: "venue-1" }, {
    authorization: `Bearer ${token}`,
    "idempotency-key": idempotencyKey,
  });
  const firstBooking = await request(env, "/api/v1/bookings", bookingInit(rotated.accessToken, "submit-1"));
  assert.equal(firstBooking.response.status, 201);
  const booking = firstBooking.payload?.data as { feeFen: number; id: string; status: string; time: string };
  assert.equal(booking.status, "pending_coach");
  assert.equal(booking.feeFen, 14850);
  assert.match(booking.time, /^\d{2}:\d{2}$/u);

  const idempotentReplay = await request(env, "/api/v1/bookings", bookingInit(rotated.accessToken, "submit-1"));
  assert.equal((idempotentReplay.payload?.data as { id: string }).id, booking.id);

  const firstSlot = database.sqlite.prepare("SELECT ends_at FROM availability_slots WHERE id = 'slot-1'").get() as { ends_at: number };
  const secondStartsAt = firstSlot.ends_at + 60 * 60_000;
  database.sqlite.prepare("INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, created_at, updated_at) VALUES ('slot-2', 1, 'venue-1', ?, ?, 'open', ?, ?)").run(secondStartsAt, secondStartsAt + 90 * 60_000, Date.now(), Date.now());
  const repeatBooking = await request(env, "/api/v1/bookings", bookingInit(rotated.accessToken, "submit-repeat", "slot-2"));
  assert.equal(repeatBooking.response.status, 201);
  assert.equal((repeatBooking.payload?.data as { feeFen: number }).feeFen, 78000);

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

test("service leads remain backward compatible while contacts require audited single-record reveal", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "test-auth-hash-secret-with-adequate-length",
    DB: database,
    OPERATOR_API_SECRET: "operator-test-secret",
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 12).toString("base64"),
  };

  const created = await request(env, "/api/v1/service-leads", json({
    coachId: 1,
    contactEmail: "student@example.com",
    contactName: "李女士",
    district: "通州区",
    goal: "中考体育与跑姿评估",
    sport: "田径",
  }));
  assert.equal(created.response.status, 201);
  const modern = await request(env, "/api/v1/service-leads", json({
    contactName: "王先生",
    contactPhone: "13800000009",
    contactWechat: "runner_beijing",
    desiredTime: "工作日晚上",
    district: "朝阳区",
    goal: "体能提升",
    learnerStage: "初中",
    sport: "田径",
  }));
  assert.equal(modern.response.status, 201);
  const noContact = await request(env, "/api/v1/service-leads", json({ contactName: "无联系方式", district: "通州区", goal: "咨询", sport: "田径" }));
  assert.equal(noContact.response.status, 422);
  const privacyRequest = await request(env, "/api/v1/privacy-requests", json({
    contactName: "匿名咨询用户",
    contactWechat: "privacy_contact",
    request: "请求查询并更正此前提交的训练咨询资料",
  }));
  assert.equal(privacyRequest.response.status, 201);

  const stored = database.sqlite.prepare("SELECT contact_email_encrypted, contact_phone_encrypted, contact_wechat_encrypted FROM service_leads ORDER BY created_at LIMIT 1").get() as { contact_email_encrypted: string; contact_phone_encrypted: string | null; contact_wechat_encrypted: string | null };
  assert.notEqual(stored.contact_email_encrypted, "student@example.com");
  assert.equal(stored.contact_phone_encrypted, null);
  assert.equal(stored.contact_wechat_encrypted, null);

  const unauthorised = await request(env, "/api/v1/operator/leads");
  assert.equal(unauthorised.response.status, 401);
  const operatorView = await request(env, "/api/v1/operator/leads?classification=all", { headers: { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": "operator-test-secret" } });
  assert.equal(operatorView.response.status, 200);
  const leads = operatorView.payload?.data as Array<Record<string, unknown>>;
  assert.equal(leads.some((lead) => "contact_email" in lead || "contact_phone" in lead || "contact_wechat" in lead), false);
  const emailLead = leads.find((lead) => lead.contact_name === "李女士")!;
  assert.equal(emailLead.has_email, 1);
  assert.equal(emailLead.lead_kind, "student_inquiry");

  const deniedReveal = await request(env, `/api/v1/operator/service-leads/${emailLead.id}/contact-reveal`, { method: "POST" });
  assert.equal(deniedReveal.response.status, 401);
  const revealed = await request(env, `/api/v1/operator/service-leads/${emailLead.id}/contact-reveal`, {
    headers: { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": "operator-test-secret" },
    method: "POST",
  });
  assert.equal(revealed.response.status, 200);
  assert.equal((revealed.payload?.data as { email: string }).email, "student@example.com");
  const audit = database.sqlite.prepare("SELECT detail_json, request_id FROM ops_audit_logs WHERE action = 'lead.contact.reveal'").get() as { detail_json: string; request_id: string };
  assert.match(audit.request_id, /^request_/u);
  assert.deepEqual(JSON.parse(audit.detail_json), { channels: ["email"] });
  assert.doesNotMatch(audit.detail_json, /student@example\.com/u);
  database.sqlite.close();
});

test("Beijing catalog, immutable contracts, fulfillment V2 and test payments stay feature-gated", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  database.sqlite.exec("UPDATE service_regions SET status = 'published'; UPDATE service_sports SET status = 'published'");
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "expansion-test-auth-secret-with-adequate-length",
    BEIJING_CATALOG_V2_ENABLED: "true",
    CANCELLATION_POLICY_VERSION_ID: "test-cancel-v1",
    DB: database,
    FULFILLMENT_V2_ENABLED: "true",
    ONLINE_TRANSACTION_ENABLED: "true",
    PAYMENT_PROVIDER: "test",
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 44).toString("base64"),
    EVIDENCE: new MemoryR2(),
    SUPPORT_EVIDENCE_ENABLED: "true",
    TERMS_VERSION_ID: "test-terms-v1",
  };
  const student = await authenticate(env, "13800000901");
  const coach = await authenticate(env, "13800000902");
  const studentMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${student.accessToken}` } });
  const coachMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${coach.accessToken}` } });
  const studentId = String((studentMe.payload?.data as { userId: string }).userId);
  const coachUserId = String((coachMe.payload?.data as { userId: string }).userId);
  const learnerId = String(database.sqlite.prepare("SELECT id FROM learner_profiles WHERE user_id = ? LIMIT 1").get(studentId)?.id);
  database.sqlite.prepare("UPDATE coaches SET user_id = ? WHERE id = 1").run(coachUserId);
  database.sqlite.prepare("INSERT INTO user_roles (user_id, role, status, granted_at, updated_at) VALUES (?, 'coach', 'active', ?, ?)").run(coachUserId, Date.now(), Date.now());

  const catalog = await request(env, "/api/v1/catalog");
  assert.equal(catalog.response.status, 200);
  assert.deepEqual((catalog.payload?.data as { regions: Array<{ name: string }> }).regions.map((item) => item.name), ["朝阳区"]);
  const outsideBeijing = await request(env, "/api/v1/bookings", json({ coachId: 1, customAddress: "测试地址", customDistrict: "上海市", durationMinutes: 60, learnerId, locationType: "custom", startsAt: Date.now() + 4 * 60 * 60_000 }, { authorization: `Bearer ${student.accessToken}`, "idempotency-key": "outside-beijing" }));
  assert.equal(outsideBeijing.response.status, 422);

const created = await request(env, "/api/v1/bookings", json({ coachId: 1, durationMinutes: 90, learnerId, locationType: "venue", startsAt: Date.now() + 5 * 60 * 60_000, venueId: "venue-1" }, { authorization: `Bearer ${student.accessToken}`, "idempotency-key": "v2-booking", "x-booking-flow": "2" }));
  assert.equal(created.response.status, 201);
  const bookingId = String((created.payload?.data as { id: string }).id);
  const snapshot = database.sqlite.prepare("SELECT * FROM booking_contract_snapshots WHERE booking_id = ?").get(bookingId) as Record<string, unknown>;
  assert.equal(snapshot.duration_minutes, 90);
  assert.equal(snapshot.terms_version_id, "test-terms-v1");
  assert.equal(JSON.parse(String(snapshot.location_json)).district, "朝阳区");

  const legacy = await request(env, "/api/v1/bookings", json({ coachId: 1, durationMinutes: 60, learnerId, locationType: "venue", startsAt: Date.now() + 10 * 60 * 60_000, venueId: "venue-1" }, { authorization: `Bearer ${student.accessToken}`, "idempotency-key": "legacy-no-flow-header" }));
  assert.equal(legacy.response.status, 201);
  const legacyId = String((legacy.payload?.data as { id: string }).id);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM booking_contract_snapshots WHERE booking_id=?").get(legacyId)?.n, 0);
  assert.equal((await request(env, `/api/v1/coach/bookings/${legacyId}/status`, json({ status: "confirmed" }, { authorization: `Bearer ${coach.accessToken}` }))).response.status, 200);
  assert.equal((await request(env, `/api/v1/coach/bookings/${legacyId}/status`, json({ status: "completed" }, { authorization: `Bearer ${coach.accessToken}` }))).response.status, 200);

  assert.equal((await request(env, `/api/v1/coach/bookings/${bookingId}/status`, json({ status: "confirmed" }, { authorization: `Bearer ${coach.accessToken}` }))).response.status, 200);
  const ticket = await request(env, "/api/v1/support-tickets", json({ bookingId, body: "需要提交训练现场凭证", category: "service", subject: "测试证据权限" }, { authorization: `Bearer ${student.accessToken}` }));
  assert.equal(ticket.response.status, 201);
  const ticketId = String((ticket.payload?.data as { id: string }).id);
  const uploaded = await request(env, `/api/v1/support-tickets/${ticketId}/attachments`, {
    body: new Uint8Array([1, 2, 3]),
    headers: { authorization: `Bearer ${student.accessToken}`, "content-type": "image/png", "x-file-name": encodeURIComponent("测试凭证.png") },
    method: "POST",
  });
  assert.equal(uploaded.response.status, 201);
  const attachmentId = String((uploaded.payload?.data as { id: string }).id);
  const coachDownload = await request(env, `/api/v1/coach/support-tickets/${ticketId}/attachments/${attachmentId}`, { headers: { authorization: `Bearer ${coach.accessToken}` } });
  assert.equal(coachDownload.response.status, 200);
  assert.equal(coachDownload.response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual([...new Uint8Array(await coachDownload.response.arrayBuffer())], [1, 2, 3]);
  const directComplete = await request(env, `/api/v1/coach/bookings/${bookingId}/status`, json({ status: "completed" }, { authorization: `Bearer ${coach.accessToken}` }));
  assert.equal((directComplete.payload?.error as { code: string }).code, "completion_confirmation_required");
  env.FULFILLMENT_V2_ENABLED = "false";
  assert.equal((await request(env, `/api/v1/coach/bookings/${bookingId}/status`, json({ status: "completed" }, { authorization: `Bearer ${coach.accessToken}` }))).response.status, 409);
  const completion = await request(env, `/api/v1/coach/bookings/${bookingId}/completion-request`, json({ note: "测试课程已完成" }, { authorization: `Bearer ${coach.accessToken}` }));
  const completionId = String((completion.payload?.data as { id: string }).id);
  assert.equal(completion.response.status, 201);
  assert.equal((await request(env, `/api/v1/booking-completion-requests/${completionId}/respond`, json({ decision: "accepted" }, { authorization: `Bearer ${student.accessToken}` }))).response.status, 200);
  assert.equal(database.sqlite.prepare("SELECT status FROM booking_requests WHERE id = ?").get(bookingId)?.status, "completed");

  database.sqlite.prepare("UPDATE booking_requests SET status = 'confirmed' WHERE id = ?").run(bookingId);
  const order = await request(env, `/api/v1/bookings/${bookingId}/payment-orders`, json({}, { authorization: `Bearer ${student.accessToken}`, "idempotency-key": "test-order-1" }));
  assert.equal(order.response.status, 201);
  const orderId = String((order.payload?.data as { id: string }).id);
  assert.equal((await request(env, `/api/v1/payment-orders/${orderId}/test-confirm`, json({}, { authorization: `Bearer ${student.accessToken}` }))).response.status, 200);
  assert.equal(database.sqlite.prepare("SELECT payment_status FROM booking_requests WHERE id = ?").get(bookingId)?.payment_status, "online_paid");

  const productionBlocked = await request({ ...env, APP_ENV: "production" }, `/api/v1/bookings/${bookingId}/payment-orders`, json({}, { authorization: `Bearer ${student.accessToken}`, "idempotency-key": "production-must-block" }));
  assert.equal((productionBlocked.payload?.error as { code: string }).code, "online_transaction_unavailable");
  database.sqlite.close();
});

test("trust metrics exclude unclassified and QA history until explicitly eligible", async () => {
  const database = new D1Adapter(); await migrate(database); seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, PUBLIC_TRUST_METRICS_ENABLED: "true", OPERATOR_API_SECRET: "metric-secret" };
  const empty = await request(env, "/api/v1/public/trust-metrics");
  assert.deepEqual((empty.payload?.data as { metrics: unknown[] }).metrics, []);
  const headers = { "content-type": "application/json", "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": "metric-secret" };
  const classified = await request(env, "/api/v1/operator/trust-metrics/classifications", { body: JSON.stringify({ classification: "production_eligible", entityId: "1", entityType: "coach", reason: "真实教练资料已人工核验" }), headers, method: "POST" });
  assert.equal(classified.response.status, 201);
  const visible = await request(env, "/api/v1/public/trust-metrics");
  assert.deepEqual((visible.payload?.data as { metrics: Array<{ key: string; value: number }> }).metrics, [{ key: "verifiedCoaches", label: "已核验公开教练", value: 1 }]);
  database.sqlite.close();
});

test("P1 web refresh coalesces trusted retries without minting duplicate sessions", async () => {
  const database = new D1Adapter(); await migrate(database); seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, AUTH_HASH_SECRET: "refresh-regression-secret", OPERATOR_API_SECRET: "trusted-web-proxy", PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64") };
  const session = await authenticate(env, "13800000751");
  database.sqlite.exec("UPDATE sessions SET access_expires_at = 0");
  const init = () => json({ refreshToken: session.refreshToken }, { "x-operator-secret": "trusted-web-proxy", "idempotency-key": "refresh-regression-01" });
  const results = await Promise.all([request(env, "/api/v1/auth/refresh", init()), request(env, "/api/v1/auth/refresh", init())]);
  assert.deepEqual(results.map((r) => r.response.status), [200, 200]);
  assert.ok(JSON.stringify(results[0].payload?.data) === JSON.stringify(results[1].payload?.data), "parallel refresh must return the same session");
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM sessions WHERE revoked_at IS NULL").get()?.n, 1);
  const replay = await request(env, "/api/v1/auth/refresh", init());
  assert.ok(JSON.stringify(replay.payload?.data) === JSON.stringify(results[0].payload?.data), "trusted retry must return the same session");
  const reuse = await request(env, "/api/v1/auth/refresh", json({ refreshToken: session.refreshToken }));
  assert.equal(reuse.response.status, 401);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM sessions WHERE revoked_at IS NULL").get()?.n, 0);
  database.sqlite.close();
});

test("native booking capability header is allowed by production CORS without exposing foreign origins", async () => {
  const result = await request({ APP_ENV: "production" }, "/api/v1/bookings", { method: "OPTIONS", headers: { origin: "https://localhost", "access-control-request-method": "POST", "access-control-request-headers": "x-booking-flow,authorization" } });
  assert.equal(result.response.headers.get("access-control-allow-origin"), "https://localhost");
  assert.match(result.response.headers.get("access-control-allow-headers") || "", /\bx-booking-flow\b/u);
  const foreign = await request({ APP_ENV: "production" }, "/api/v1/bookings", { method: "OPTIONS", headers: { origin: "https://untrusted.example" } });
  assert.equal(foreign.response.headers.get("access-control-allow-origin"), null);
});

test("public channel identity never authorizes learner, coach or operator data", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  database.sqlite.prepare("UPDATE coaches SET siwc_email='xuzerui6@gmail.com' WHERE id=1").run();
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, PILOT_APP_KEY: "public-channel-identity" };
  for (const path of ["/api/v1/bookings", "/api/v1/coach/overview", "/api/v1/operator/coaches"]) {
    const result = await request(env, path, { headers: { "x-zhuguang-app-key": env.PILOT_APP_KEY!, "x-operator-actor": "xuzerui6@gmail.com" } });
    assert.equal(result.response.status, 401, path);
  }
  const forged = await request(env, "/api/v1/coach/overview", { headers: { "x-zhuguang-app-key": env.PILOT_APP_KEY!, "oai-authenticated-user-email": "xuzerui6@gmail.com" } });
  assert.equal(forged.response.status, 401, "a client cannot manufacture a trusted coach email");
  database.sqlite.close();
});

test("P1 completion decisions are atomic under contention and replay", async () => {
  for (const decisions of [["accepted", "accepted"], ["accepted", "disputed"], ["disputed", "disputed"]]) {
    const database = new D1Adapter(); await migrate(database); seedSupply(database);
    const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, AUTH_HASH_SECRET: "completion-regression-secret", PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 18).toString("base64"), FULFILLMENT_V2_ENABLED: "true" };
    const student = await authenticate(env, "13800000752");
    const userId = String(database.sqlite.prepare("SELECT user_id FROM sessions LIMIT 1").get()?.user_id);
    const learnerId = String(database.sqlite.prepare("SELECT id FROM learner_profiles WHERE user_id = ? LIMIT 1").get(userId)?.id);
    database.sqlite.prepare("INSERT INTO booking_requests (id,idempotency_key,user_id,learner_profile_id,coach_id,venue_id,slot_id,status,fee_fen,payment_status,note,created_at,updated_at) VALUES ('race-booking','race-booking',?,?,1,'venue-1','slot-1','confirmed',9900,'offline_paid','QA concurrency',?,?)").run(userId,learnerId,Date.now(),Date.now());
    database.sqlite.prepare("INSERT INTO booking_completion_requests (id,booking_id,requested_by_user_id,status) VALUES ('race-completion','race-booking',?,'pending_student')").run(userId);
    const submit = (decision: string, key: string) => request(env, "/api/v1/booking-completion-requests/race-completion/respond", json({ decision, note: "测试决定" }, { authorization: `Bearer ${student.accessToken}`, "idempotency-key": key }));
    database.sqlite.exec("CREATE TRIGGER qa_fail_event BEFORE INSERT ON booking_events BEGIN SELECT RAISE(ABORT,'injected transaction failure'); END");
    assert.equal((await submit("accepted", "completion-rollback")).response.status, 500);
    assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM booking_completion_responses").get()?.n, 0);
    assert.equal(database.sqlite.prepare("SELECT status FROM booking_completion_requests WHERE id='race-completion'").get()?.status, "pending_student");
    database.sqlite.exec("DROP TRIGGER qa_fail_event");
    const results = await Promise.all(decisions.map((decision, index) => submit(decision, `completion-${index}`)));
    assert.equal(results.filter((r) => r.response.status === 200).length, 1);
    assert.equal(results.filter((r) => r.response.status === 409).length, 1);
    const winner = results.findIndex((r) => r.response.status === 200);
    const replay = await submit(decisions[winner], `completion-${winner}`);
    assert.deepEqual(replay.payload?.data, results[winner].payload?.data);
    assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM booking_events WHERE booking_id='race-booking'").get()?.n, 1);
    const ticketCount = database.sqlite.prepare("SELECT count(*) AS n FROM support_tickets WHERE completion_request_id='race-completion'").get()?.n;
    assert.equal(ticketCount, decisions[winner] === "disputed" ? 1 : 0);
    database.sqlite.close();
  }
});

test("P1 logout revokes successors and encrypted retry receipts cannot restore them", async () => {
  const database = new D1Adapter(); await migrate(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, AUTH_HASH_SECRET: "logout-regression-secret", OPERATOR_API_SECRET: "trusted-web-proxy", PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64") };
  const session = await authenticate(env, "13800000754");
  const init = () => json({ refreshToken: session.refreshToken }, { "x-operator-secret": "trusted-web-proxy", "idempotency-key": "logout-race-refresh" });
  const refreshed = await request(env, "/api/v1/auth/refresh", init());
  assert.equal(refreshed.response.status, 200);
  const logout = await request(env, "/api/v1/auth/logout-refresh", json({ refreshToken: session.refreshToken }));
  assert.equal(logout.response.status, 200);
  assert.equal((await request(env, "/api/v1/auth/refresh", init())).response.status, 401);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM sessions WHERE revoked_at IS NULL").get()?.n, 0);
  database.sqlite.close();
});

test("P1 review metrics require own, booking and account provenance; ticket classification persists", async () => {
  const database = new D1Adapter(); await migrate(database); seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, AUTH_HASH_SECRET: "classification-auth-secret", PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 12).toString("base64"), OPERATOR_API_SECRET: "classification-secret", PUBLIC_TRUST_METRICS_ENABLED: "true" };
  await authenticate(env, "13800000755");
  const userId = String(database.sqlite.prepare("SELECT user_id FROM sessions LIMIT 1").get()?.user_id);
  const learnerId = String(database.sqlite.prepare("SELECT id FROM learner_profiles WHERE user_id=? LIMIT 1").get(userId)?.id);
  database.sqlite.prepare("INSERT INTO booking_requests (id,idempotency_key,user_id,learner_profile_id,coach_id,venue_id,slot_id,status,fee_fen,payment_status,note,created_at,updated_at) VALUES ('metric-booking','metric-booking',?,?,1,'venue-1','slot-1','completed',9900,'offline_paid','QA metrics',?,?)").run(userId,learnerId,Date.now(),Date.now());
  database.sqlite.prepare("INSERT INTO coach_reviews(id,booking_id,user_id,coach_id,rating,body,status) VALUES('metric-review','metric-booking',?,1,5,'isolated fixture','approved')").run(userId);
  database.sqlite.prepare("INSERT INTO support_tickets(id,created_by_user_id,created_by_role,category,subject) VALUES('metric-ticket',?,'student','other','QA fixture')").run(userId);
  const classify = (entityType: string, entityId: string, classification: string) => request(env, "/api/v1/operator/trust-metrics/classifications", json({ entityType, entityId, classification, reason: "隔离数据分类验证" }, { "x-operator-secret": "classification-secret", "x-operator-actor": "xuzerui6@gmail.com" }));
  const reviewCount = async () => ((await request(env,"/api/v1/public/trust-metrics")).payload?.data as { metrics: Array<{key:string;value:number}> }).metrics.find((m) => m.key === "verifiedReviews")?.value || 0;
  const publicReviewCount = async () => ((await request(env, "/api/v1/coaches/1/reviews")).payload?.data as { summary: { total: number } }).summary.total;
  assert.equal(await publicReviewCount(), 0, "unclassified reviews must not appear on coach profiles");
  for (const [type,id] of [["user",userId],["booking","metric-booking"],["coach","1"]]) assert.equal((await classify(type,id,"production_eligible")).response.status,201);
  assert.equal(await reviewCount(),0);
  await classify("review","metric-review","production_eligible");
  assert.equal(await reviewCount(),1);
  assert.equal(await publicReviewCount(),1);
  await classify("coach","1","qa");
  assert.equal(await reviewCount(),0);
  assert.equal(await publicReviewCount(),0);
  await classify("coach","1","production_eligible");
  await classify("review","metric-review","qa");
  assert.equal(await reviewCount(),0);
  await classify("review","metric-review","production_eligible");
  await classify("user",userId,"excluded");
  assert.equal(await reviewCount(),0);
  await classify("support_ticket","metric-ticket","excluded");
  assert.equal(database.sqlite.prepare("SELECT classification FROM entity_metric_classifications WHERE entity_type='support_ticket'").get()?.classification,"excluded");
  database.sqlite.close();
});

test("P1 classification rejects nonexistent entities without false audit success", async () => {
  const database = new D1Adapter(); await migrate(database); seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, OPERATOR_API_SECRET: "classification-secret" };
  for (const entityType of ["user", "coach", "booking", "review", "support_ticket"]) {
    const response = await request(env, "/api/v1/operator/trust-metrics/classifications", json({ entityType, entityId: "999999", classification: "production_eligible", reason: "测试不存在记录" }, { "x-operator-secret": "classification-secret", "x-operator-actor": "xuzerui6@gmail.com" }));
    assert.equal(response.response.status, 404);
  }
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM metric_classification_events").get()?.n, 0);
  database.sqlite.close();
});

test("OTP policy enforces five attempts, hourly limits and production SMS configuration", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
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

test("coach media honors quoted, weak and multi-value ETags", async () => {
  const database = new D1Adapter();
  const media = new MemoryR2();
  await migrate(database);
  seedSupply(database);
  database.sqlite.prepare("UPDATE coaches SET avatar_object_key = 'coaches/1/avatar.webp' WHERE id = 1").run();
  await media.put("coaches/1/avatar.webp", "coach-avatar");
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, MEDIA: media, MOBILE_API_ORIGIN: "https://api.example.test" };

  const catalog = await request(env, "/api/v1/coaches/1");
  assert.match((catalog.payload?.data as { avatarUrl: string }).avatarUrl, /^https:\/\/api\.example\.test\/api\/v1\/media\/coaches\/1\/avatar\?v=\d+$/u);

  const initial = await request(env, "/api/v1/media/coaches/1/avatar");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.response.headers.get("etag"), "test-etag");
  assert.equal(await initial.response.text(), "coach-avatar");

  const quoted = await request(env, "/api/v1/media/coaches/1/avatar", { headers: { "if-none-match": '"test-etag"' } });
  assert.equal(quoted.response.status, 304);
  const weakMultiValue = await request(env, "/api/v1/media/coaches/1/avatar", { headers: { "if-none-match": '"other", W/"test-etag"' } });
  assert.equal(weakMultiValue.response.status, 304);
  const stale = await request(env, "/api/v1/media/coaches/1/avatar", { headers: { "if-none-match": '"stale"' } });
  assert.equal(stale.response.status, 200);
  database.sqlite.close();
});

test("operator listing controls hide public discovery without changing audit state", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const operatorSecret = "operator-listing-secret";
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database, OPERATOR_API_SECRET: operatorSecret };
  const operatorHeaders = { "content-type": "application/json", "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };

  const before = await request(env, "/api/v1/coaches");
  assert.equal((before.payload?.data as unknown[]).length, 1);

  const forgedOperator = await request(env, "/api/v1/operator/coaches", { headers: { "x-operator-actor": "other@example.com", "x-operator-secret": operatorSecret } });
  assert.equal(forgedOperator.response.status, 403);

  const hidden = await request(env, "/api/v1/operator/coaches/1/listing", {
    body: JSON.stringify({ reason: "资料例行复核", status: "offline" }),
    headers: operatorHeaders,
    method: "PATCH",
  });
  assert.equal(hidden.response.status, 200);
  assert.equal((hidden.payload?.data as { status: string }).status, "offline");

  const publicList = await request(env, "/api/v1/coaches");
  assert.deepEqual(publicList.payload?.data, []);
  const publicDetail = await request(env, "/api/v1/coaches/1");
  assert.equal(publicDetail.response.status, 410);
  assert.equal((publicDetail.payload?.error as { code: string }).code, "coach_offline");

  const operationsList = await request(env, "/api/v1/operator/coaches", { headers: { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret } });
  const operationsCoach = (operationsList.payload?.data as Array<{ audit_status: string; listing_status: string }>)[0];
  assert.equal(operationsCoach.audit_status, "approved");
  assert.equal(operationsCoach.listing_status, "offline");

  const history = await request(env, "/api/v1/operator/coaches/1/events", { headers: { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret } });
  const event = (history.payload?.data as Array<{ event_type: string; reason: string }>)[0];
  assert.deepEqual({ eventType: event.event_type, reason: event.reason }, { eventType: "listing", reason: "资料例行复核" });

  const restored = await request(env, "/api/v1/operator/coaches/1/listing", {
    body: JSON.stringify({ reason: "复核完成", status: "online" }),
    headers: operatorHeaders,
    method: "PATCH",
  });
  assert.equal(restored.response.status, 200);
  assert.equal((await request(env, "/api/v1/coaches")).response.status, 200);
  database.sqlite.close();
});

test("public coach discovery normalizes natural-language filters and reports applied options", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: "test", DB: database };

  const result = await request(env, "/api/v1/coaches?sport=%E7%BE%BD%E6%AF%9B%E7%90%83%E9%A1%B9%E7%9B%AE&district=%E5%8C%97%E4%BA%AC%E5%B8%82%E6%9C%9D%E9%98%B3&goal=%E4%B8%93%E9%A1%B9%E8%AE%AD%E7%BB%83&audience=%E9%9D%92%E5%B0%91%E5%B9%B4%E5%84%BF%E7%AB%A5");
  assert.equal(result.response.status, 200);
  assert.equal((result.payload?.data as unknown[]).length, 1);
  const meta = result.payload?.meta as {
    appliedFilters: Record<string, string>;
    availableOptions: { districts: string[]; sports: string[] };
  };
  assert.deepEqual(meta.appliedFilters, {
    audience: "青少年儿童",
    district: "朝阳区",
    goal: "专项提升",
    sport: "羽毛球",
  });
  assert.ok(meta.availableOptions.districts.includes("通州区"));
  assert.ok(meta.availableOptions.sports.includes("田径"));
  database.sqlite.close();
});

test("coach scheduling uses approved venues while operator business changes remain audited", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  database.sqlite.exec("DELETE FROM availability_slots; DELETE FROM venues;");
  const operatorSecret = "operator-business-secret";
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "test-auth-hash-secret-with-adequate-length",
    DB: database,
    OPERATOR_API_SECRET: operatorSecret,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 18).toString("base64"),
  };
  const session = await authenticate(env, "13800000018");
  const me = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${session.accessToken}`, "x-device-id": "device-test" } });
  const userId = (me.payload?.data as { userId: string }).userId;
  const now = Date.now();
  database.sqlite.prepare("UPDATE coaches SET user_id = ? WHERE id = 1").run(userId);
  database.sqlite.prepare("INSERT INTO user_roles (user_id, role, status, granted_at, updated_at) VALUES (?, 'coach', 'active', ?, ?)").run(userId, now, now);
  const coachHeaders = { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json", "x-device-id": "device-test" };
  const operatorHeaders = { "content-type": "application/json", "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };

  const submitted = await request(env, "/api/v1/coach/profile-change-requests", { body: JSON.stringify({ field: "venue", value: { address: "通州区运河东大街1号", district: "通州区", name: "通州合作训练场" } }), headers: coachHeaders, method: "POST" });
  assert.equal(submitted.response.status, 201);
  const changeId = (submitted.payload?.data as { id: string }).id;
  const reviewed = await request(env, `/api/v1/operator/profile-change-requests/${changeId}`, { body: JSON.stringify({ decision: "approved", note: "场馆资料核验通过" }), headers: operatorHeaders, method: "PATCH" });
  assert.equal(reviewed.response.status, 200);
  const venue = database.sqlite.prepare("SELECT id, name FROM venues WHERE coach_id = 1 AND active = 1").get() as { id: string; name: string };
  assert.equal(venue.name, "通州合作训练场");

  const staleStartsAt = now - 60 * 60_000;
  database.sqlite.prepare("INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, created_at, updated_at) VALUES ('stale-open-slot', 1, ?, ?, ?, 'open', ?, ?)").run(venue.id, staleStartsAt, now + 2 * 60 * 60_000, now, now);
  const replacesStaleOpen = await request(env, "/api/v1/coach/slots", { body: JSON.stringify({ endsAt: now + 90 * 60_000, startsAt: now + 30 * 60_000, venueId: venue.id }), headers: coachHeaders, method: "POST" });
  assert.equal(replacesStaleOpen.response.status, 201);
  assert.equal((database.sqlite.prepare("SELECT status FROM availability_slots WHERE id = 'stale-open-slot'").get() as { status: string }).status, "expired");

  const startsAt = Date.now() + 3 * 24 * 60 * 60_000;
  const validSlot = await request(env, "/api/v1/coach/slots", { body: JSON.stringify({ endsAt: startsAt + 90 * 60_000, startsAt, venueId: venue.id }), headers: coachHeaders, method: "POST" });
  assert.equal(validSlot.response.status, 201);
  const overlap = await request(env, "/api/v1/coach/slots", { body: JSON.stringify({ endsAt: startsAt + 120 * 60_000, startsAt: startsAt + 30 * 60_000, venueId: venue.id }), headers: coachHeaders, method: "POST" });
  assert.equal(overlap.response.status, 409);
  assert.equal((overlap.payload?.error as { code: string }).code, "slot_conflict");
  assert.match((overlap.payload?.error as { message: string }).message, /\d{2}:\d{2}–\d{2}:\d{2}/u);
  const tooShort = await request(env, "/api/v1/coach/slots", { body: JSON.stringify({ endsAt: startsAt + 15 * 60_000, startsAt: startsAt + 5 * 60 * 60_000, venueId: venue.id }), headers: coachHeaders, method: "POST" });
  assert.equal(tooShort.response.status, 422);
  assert.equal(((tooShort.payload?.error as { fieldErrors: Record<string, string> }).fieldErrors).endsAt, "训练时长不能少于30分钟");

  const secondStudent = await authenticate(env, "13800000019");
  const secondMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${secondStudent.accessToken}`, "x-device-id": "device-test" } });
  const secondUserId = (secondMe.payload?.data as { userId: string }).userId;
  database.sqlite.prepare("INSERT INTO learner_profiles (id, user_id, name, relation, gender, sport, level, goal, created_at, updated_at) VALUES (?, ?, '学员甲', 'self', 'unspecified', '田径', '入门', '专项提升', ?, ?)").run("learner-time-a", userId, now, now);
  database.sqlite.prepare("INSERT INTO learner_profiles (id, user_id, name, relation, gender, sport, level, goal, created_at, updated_at) VALUES (?, ?, '学员乙', 'self', 'unspecified', '田径', '入门', '专项提升', ?, ?)").run("learner-time-b", secondUserId, now, now);
  const requestedStartsAt = now + 10 * 24 * 60 * 60_000;
  const timeRequest = (token: string, learnerId: string, key: string) => request(env, "/api/v1/bookings", json({ coachId: 1, durationMinutes: 90, learnerId, locationType: "venue", note: "学员指定时间", startsAt: requestedStartsAt, venueId: venue.id }, { authorization: `Bearer ${token}`, "idempotency-key": key }));
  const requestA = await timeRequest(session.accessToken, "learner-time-a", "time-request-a");
  const requestB = await timeRequest(secondStudent.accessToken, "learner-time-b", "time-request-b");
  assert.equal(requestA.response.status, 201);
  assert.equal(requestB.response.status, 201);
  assert.equal((requestA.payload?.data as { feeFen: number }).feeFen, 14850);
  const requestAId = (requestA.payload?.data as { id: string }).id;
  const requestBId = (requestB.payload?.data as { id: string }).id;
  const confirmA = await request(env, `/api/v1/coach/bookings/${requestAId}/status`, { body: JSON.stringify({ status: "confirmed" }), headers: coachHeaders, method: "POST" });
  const confirmB = await request(env, `/api/v1/coach/bookings/${requestBId}/status`, { body: JSON.stringify({ status: "confirmed" }), headers: coachHeaders, method: "POST" });
  assert.equal(confirmA.response.status, 200);
  assert.equal(confirmB.response.status, 409);
  assert.equal((confirmB.payload?.error as { code: string }).code, "coach_time_conflict");

  const settings = await request(env, "/api/v1/operator/coaches/1/business-settings", { body: JSON.stringify({ bookingEnabled: false, district: "通州区", priceFen: 28000, pricingStatus: "published", reason: "试点价格调整", trialPriceFen: 12900 }), headers: operatorHeaders, method: "PATCH" });
  assert.equal(settings.response.status, 200);
  assert.equal((settings.payload?.data as { bookingEnabled: boolean; priceFen: number }).bookingEnabled, false);
  assert.equal((settings.payload?.data as { priceFen: number }).priceFen, 28000);
  const audit = database.sqlite.prepare("SELECT detail_json FROM ops_audit_logs WHERE action = 'coach.business.update' ORDER BY created_at DESC LIMIT 1").get() as { detail_json: string };
  assert.match(audit.detail_json, /试点价格调整/u);
  const publicCoach = await request(env, "/api/v1/coaches/1");
  assert.equal(publicCoach.response.status, 410);
  assert.equal((publicCoach.payload?.error as { code: string }).code, "coach_offline");
  database.sqlite.close();
});

test("profile review, reschedule confirmation and support tickets keep public state consistent", async () => {
  const database = new D1Adapter();
  await migrate(database);
  seedSupply(database);
  const operatorSecret = "operator-workflow-secret";
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "workflow-auth-hash-secret-with-adequate-length",
    DB: database,
    OPERATOR_API_SECRET: operatorSecret,
    PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString("base64"),
  };
  const coachSession = await authenticate(env, "13800000011");
  const coachMe = await request(env, "/api/v1/me", { headers: { authorization: `Bearer ${coachSession.accessToken}` } });
  const coachUserId = (coachMe.payload?.data as { userId: string }).userId;
  database.sqlite.prepare("UPDATE coaches SET user_id = ? WHERE id = 1").run(coachUserId);
  database.sqlite.prepare("INSERT INTO user_roles (user_id, role, status, granted_at, updated_at) VALUES (?, 'coach', 'active', ?, ?)").run(coachUserId, Date.now(), Date.now());
  const coachHeaders = { authorization: `Bearer ${coachSession.accessToken}`, "content-type": "application/json" };
  const change = await request(env, "/api/v1/coach/profile-change-requests", { body: JSON.stringify({ field: "title", value: "田径专项训练教练" }), headers: coachHeaders, method: "POST" });
  assert.equal(change.response.status, 201);
  assert.equal((await request(env, "/api/v1/coaches/1")).payload?.data && ((await request(env, "/api/v1/coaches/1")).payload?.data as { title: string }).title, "专项提升教练");
  const requestId = (change.payload?.data as { id: string }).id;
  const operatorHeaders = { "content-type": "application/json", "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };
  const approved = await request(env, `/api/v1/operator/profile-change-requests/${requestId}`, { body: JSON.stringify({ decision: "approved", note: "资料核验通过" }), headers: operatorHeaders, method: "PATCH" });
  assert.equal(approved.response.status, 200);
  const publicCoach = await request(env, "/api/v1/coaches/1");
  assert.equal((publicCoach.payload?.data as { title: string }).title, "田径专项训练教练");

  const studentSession = await authenticate(env, "13800000012");
  const startsAt = Date.now() + 48 * 60 * 60_000;
  database.sqlite.prepare("INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, created_at, updated_at) VALUES ('slot-2', 1, 'venue-1', ?, ?, 'open', ?, ?)").run(startsAt, startsAt + 90 * 60_000, Date.now(), Date.now());
  const booking = await request(env, "/api/v1/bookings", json({ coachId: 1, learnerId: "workflow-learner", note: "测试改期闭环", slotId: "slot-1", venueId: "venue-1" }, { authorization: `Bearer ${studentSession.accessToken}`, "idempotency-key": "workflow-booking" }));
  const bookingId = (booking.payload?.data as { id: string }).id;
  const proposal = await request(env, "/api/v1/coach/reschedule-proposals", { body: JSON.stringify({ bookingId, note: "调整到后天", slotId: "slot-2" }), headers: coachHeaders, method: "POST" });
  assert.equal(proposal.response.status, 201);
  const proposalId = (proposal.payload?.data as { id: string }).id;
  const response = await request(env, `/api/v1/reschedule-proposals/${proposalId}/respond`, json({ decision: "accepted" }, { authorization: `Bearer ${studentSession.accessToken}` }));
  assert.equal((response.payload?.data as { status: string }).status, "accepted");
  const storedBooking = database.sqlite.prepare("SELECT slot_id, status FROM booking_requests WHERE id = ?").get(bookingId) as { slot_id: string; status: string };
  assert.deepEqual({ slot_id: storedBooking.slot_id, status: storedBooking.status }, { slot_id: "slot-2", status: "confirmed" });

  const ticket = await request(env, "/api/v1/support-tickets", json({ bookingId, body: "需要确认线下支付安排", category: "payment", subject: "线下支付咨询" }, { authorization: `Bearer ${studentSession.accessToken}` }));
  assert.equal(ticket.response.status, 201);
  const tickets = await request(env, "/api/v1/operator/support-tickets", { headers: operatorHeaders });
  assert.equal((tickets.payload?.data as unknown[]).length, 1);
  database.sqlite.close();
});

test("operator release flow validates artifacts, publishes and serves a ticketed APK", async () => {
  const database = new D1Adapter();
  const releases = new MemoryR2();
  const operatorSecret = "operator-test-secret";
  await migrate(database);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "public-download-hash-secret-with-adequate-length",
    DB: database,
    OPERATOR_API_SECRET: operatorSecret,
    RELEASES: releases,
    UPDATE_DOWNLOAD_SECRET: "download-test-secret",
  };
  const operatorHeaders: Record<string, string> = { "x-operator-actor": "xuzerui6@gmail.com", "x-operator-secret": operatorSecret };
  const apk = new TextEncoder().encode("PK\u0003\u0004signed-test-apk");

  const invalidApk = await request(env, "/api/v1/operator/releases/6/artifact", {
    body: new TextEncoder().encode("not-an-apk"),
    headers: { ...operatorHeaders, "content-type": "application/vnd.android.package-archive", "x-release-version-name": "1.2.1" },
    method: "PUT",
  });
  assert.equal(invalidApk.response.status, 422);
  assert.equal(releases.objects.size, 0);

  const rejectedPath = await request(env, "/api/v1/operator/releases/6/artifact", {
    body: apk,
    headers: { ...operatorHeaders, "content-type": "application/vnd.android.package-archive", "x-release-version-name": "../../1.2.1" },
    method: "PUT",
  });
  assert.equal(rejectedPath.response.status, 422);
  assert.equal(releases.objects.size, 0);

  const uploaded = await request(env, "/api/v1/operator/releases/6/artifact", {
    body: apk,
    headers: { ...operatorHeaders, "content-type": "application/vnd.android.package-archive", "x-release-version-name": "1.2.1" },
    method: "PUT",
  });
  assert.equal(uploaded.response.status, 201);
  const artifact = uploaded.payload?.data as { receiptId: string; objectKey: string; sha256: string; sizeBytes: number };
  assert.equal(typeof artifact.receiptId, "string");
  assert.match(artifact.objectKey, /^android\/1.2.1\//u);

  const mismatch = await request(env, "/api/v1/operator/releases", json({
    confirmed: true, reason: "隔离验证版本创建", receiptId: artifact.receiptId,
    certificateSha256: "AA:BB",
    forced: false,
    minimumSupportedVersionCode: 5,
    notes: ["真机更新验证"],
    objectKey: artifact.objectKey,
    packageId: "com.zhuguang.coachos",
    rolloutPercentage: 100,
    sha256: "wrong-sha",
    sizeBytes: artifact.sizeBytes,
    versionCode: 6,
    versionName: "1.2.1",
  }, { ...operatorHeaders, "idempotency-key": "release-mismatch" }));
  assert.equal(mismatch.response.status, 422);

  const created = await request(env, "/api/v1/operator/releases", json({
    certificateSha256: "ab".repeat(32),
    confirmed: true, reason: "隔离验证版本创建", receiptId: artifact.receiptId,
    forced: false,
    minimumSupportedVersionCode: 5,
    notes: ["真机更新验证"],
    rolloutPercentage: 50,
  }, { ...operatorHeaders, "idempotency-key": "release-create-test" }));
  assert.equal(created.response.status, 201);

  const policy = await request(env, "/api/v1/operator/releases/6/policy", {
    body: JSON.stringify({ forced: false, minimumSupportedVersionCode: 5, rolloutPercentage: 100, confirmed: true, reason: "隔离验证版本策略" }),
    headers: { ...operatorHeaders, "content-type": "application/json", "idempotency-key": "release-policy-test" },
    method: "PATCH",
  });
  assert.equal((policy.payload?.data as { rolloutPercentage: number }).rolloutPercentage, 100);
  const published = await request(env, "/api/v1/operator/releases/6/publish", json({ confirmed: true, reason: "隔离验证版本发布" }, { ...operatorHeaders, "idempotency-key": "release-publish-test" }));
  assert.equal((published.payload?.data as { status: string }).status, "published");

  database.sqlite.exec("INSERT INTO users(id,status) VALUES ('notify-on','active'),('notify-off','active'); INSERT INTO notification_preferences(user_id,update_enabled) VALUES ('notify-off',0);");
  const notify = () => request(env, "/api/v1/operator/releases/6/notify", json({ confirmed: true, reason: "隔离验证通知去重" }, { ...operatorHeaders, "idempotency-key": "release-notify-test" }));
  const notifications = await Promise.all([notify(), notify()]);
  assert.deepEqual(notifications[0].payload?.data, notifications[1].payload?.data);
  assert.equal((notifications[0].payload?.data as { queuedUsers: number }).queuedUsers, 1);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM notifications WHERE user_id='notify-off'").get()?.n, 0);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM release_operations WHERE action='notify'").get()?.n, 1);
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM ops_audit_logs WHERE action='release.notify'").get()?.n, 1);
  database.sqlite.exec("CREATE TRIGGER fail_release_audit BEFORE INSERT ON ops_audit_logs WHEN NEW.action='release.pause' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END;");
  const paused = await request(env, "/api/v1/operator/releases/6/pause", json({ confirmed: true, reason: "隔离验证审计回滚" }, { ...operatorHeaders, "idempotency-key": "release-pause-test" }));
  assert.equal(paused.response.status, 500);
  assert.equal(database.sqlite.prepare("SELECT status FROM app_releases WHERE version_code=6").get()?.status, "published");
  assert.equal(database.sqlite.prepare("SELECT count(*) AS n FROM release_operations WHERE action='pause'").get()?.n, 0);

  const listed = await request(env, "/api/v1/operator/releases", { headers: operatorHeaders });
  const releaseList = listed.payload?.data as Array<{ artifactPresent: boolean; versionCode: number }>;
  assert.deepEqual(releaseList.map((release) => [release.versionCode, release.artifactPresent]), [[6, true]]);

  database.sqlite.prepare("UPDATE app_releases SET notes_json=? WHERE version_code=6")
    .run(JSON.stringify(['"会话续期","弱网恢复","发布安全"']));
  const publicLatest = await request(env, "/api/v1/public/app/releases/latest");
  assert.equal(publicLatest.response.status, 200);
  assert.deepEqual(
    publicLatest.payload?.data && {
      minAndroid: (publicLatest.payload.data as { minAndroid: string }).minAndroid,
      notes: (publicLatest.payload.data as { notes: string[] }).notes,
      versionCode: (publicLatest.payload.data as { versionCode: number }).versionCode,
    },
    { minAndroid: "7.0", notes: ["会话续期", "弱网恢复", "发布安全"], versionCode: 6 },
  );
  const publicTicket = await request(env, "/api/v1/public/app/releases/6/download-ticket", {
    body: JSON.stringify({ downloadId: "browser-download-device-0001" }),
    headers: { "cf-connecting-ip": "203.0.113.12", "content-type": "application/json" },
    method: "POST",
  });
  assert.equal(publicTicket.response.status, 201);
  const publicDownloadUrl = new URL((publicTicket.payload?.data as { url: string }).url);
  const publicDownload = await handleApiRequest(new Request(publicDownloadUrl), env, context);
  assert.ok(publicDownload);
  assert.equal(publicDownload.headers.get("content-disposition"), 'attachment; filename="zhuguang-android-1.2.1.apk"');

  const latest = await request(env, "/api/v1/app/releases/latest", { headers: { "x-app-version-code": "5", "x-device-id": "device-release-test" } });
  assert.equal((latest.payload?.data as { versionCode: number }).versionCode, 6);
  const alreadyCurrent = await request(env, "/api/v1/app/releases/latest", { headers: { "x-app-version-code": "6", "x-device-id": "device-release-test" } });
  assert.equal(alreadyCurrent.response.status, 404);
  assert.equal((alreadyCurrent.payload?.error as { code: string }).code, "release_not_available");
  const ticket = await request(env, "/api/v1/app/releases/6/download-ticket", { headers: { "x-device-id": "device-release-test" }, method: "POST" });
  const downloadUrl = new URL((ticket.payload?.data as { url: string }).url);
  const download = await handleApiRequest(new Request(downloadUrl), env, context);
  assert.ok(download);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("x-content-sha256"), artifact.sha256);
  assert.equal(await download.text(), "PK\u0003\u0004signed-test-apk");
  database.sqlite.close();
});

test("0023 preserves populated classifications, audit rows, views and immutable triggers", async () => {
  const db = new D1Adapter(); await migrate(db, false);
  db.sqlite.exec(`INSERT INTO metric_classification_events(id,entity_type,entity_id,classification,reason,actor) VALUES ('old-event','booking','historical','qa','isolated preservation','test');
    INSERT INTO entity_metric_classifications VALUES ('booking','historical','qa','old-event',123);
    INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,created_at) VALUES ('old-audit','test','test','booking','historical','{}',123);`);
  const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  const before = tables.map(({ name }) => ({ name, columns: (db.sqlite.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).map((c) => `"${c.name}"`).join(','), rows: db.sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() }));
  db.sqlite.exec(await readFile(new URL("../drizzle/0023_release_safety_and_classification.sql", import.meta.url), "utf8"));
  for (const table of before) assert.deepEqual(db.sqlite.prepare(`SELECT ${table.columns} FROM "${table.name}" ORDER BY rowid`).all(), table.rows, table.name);
  assert.deepEqual(db.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.sqlite.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM public_eligible_coach_reviews").get()?.n, 0);
  assert.throws(() => db.sqlite.exec("DELETE FROM metric_classification_events"), /immutable/);
  assert.throws(() => db.sqlite.exec("UPDATE ops_audit_logs SET actor='changed'"), /immutable/);
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name='entity_metric_classification_lookup'").get()?.n, 1);
  db.sqlite.close();
});

test("release receipts expire, are single-use, reject malformed policies and survive failed audit", async () => {
  const db = new D1Adapter(); await migrate(db);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com', APP_ENV: 'test', DB: db, RELEASES: new MemoryR2(), OPERATOR_API_SECRET: 'isolated-release' };
  const headers = { 'x-operator-actor': 'xuzerui6@gmail.com', 'x-operator-secret': 'isolated-release' };
  const upload = async () => (await request(env,'/api/v1/operator/releases/25/artifact', { method:'PUT', body:'PK\u0003\u0004isolated-apk', headers: {...headers,'content-type':'application/vnd.android.package-archive','x-release-version-name':'1.3.10'} })).payload?.data as { receiptId: string };
  const receipt = await upload();
  const body = { receiptId: receipt.receiptId, confirmed:true, reason:'isolated validation', certificateSha256:'ab'.repeat(32), forced:false, minimumSupportedVersionCode:24, rolloutPercentage:10, notes:['isolated'] };
  const create = (input: unknown, key: string) => request(env,'/api/v1/operator/releases',json(input,{...headers,'idempotency-key':key}));
  for (const invalid of [{...body,certificateSha256:123},{...body,rolloutPercentage:1.5},{...body,forced:'false'},{...body,confirmed:false},{...body,reason:''}]) assert.equal((await create(invalid,crypto.randomUUID())).response.status,422);
  db.sqlite.exec("UPDATE release_upload_receipts SET expires_at=1");
  assert.equal((await create(body,'expired-receipt')).response.status,422);
  body.receiptId=(await upload()).receiptId;
  db.sqlite.exec("CREATE TRIGGER injected_release_audit BEFORE INSERT ON ops_audit_logs BEGIN SELECT RAISE(ABORT,'injected'); END;");
  assert.equal((await create(body,'audit-retry-key')).response.status,500);
  assert.equal(db.sqlite.prepare("SELECT consumed_at FROM release_upload_receipts WHERE id=?").get(body.receiptId)?.consumed_at,null);
  db.sqlite.exec("DROP TRIGGER injected_release_audit");
  const results = await Promise.all([create(body,'audit-retry-key'),create(body,'concurrent-create')]);
  assert.equal(results.filter((r)=>r.response.status===201).length,1);
  assert.ok(results.some((r)=>[409,422].includes(r.response.status)));
  assert.equal((await create(body,results[0].response.status===201?'audit-retry-key':'concurrent-create')).response.status,201);
  assert.equal((await create(body,'duplicate-consume')).response.status,422);
  const revision = db.sqlite.prepare("SELECT revision FROM app_releases WHERE version_code=25").get()?.revision;
  const originalBatch = db.batch.bind(db);
  let releaseBoth!: () => void; let arrived = 0;
  const barrier = new Promise<void>((resolve) => { releaseBoth = resolve; });
  db.batch = async (statements) => { if (++arrived === 2) releaseBoth(); await barrier; return originalBatch(statements); };
  const policies = await Promise.all([20,50].map((rolloutPercentage)=>request(env,'/api/v1/operator/releases/25/policy',{...json({...body,rolloutPercentage},{...headers,'idempotency-key':crypto.randomUUID()}),method:'PATCH'})));
  assert.deepEqual(policies.map((r)=>r.response.status).sort(),[200,409]);
  assert.equal(db.sqlite.prepare("SELECT revision FROM app_releases WHERE version_code=25").get()?.revision,Number(revision)+1);
  db.sqlite.close();
});

test("release canary is restricted to an active installation, exact version and expiry", async () => {
  const { latestReleaseD1, stableRolloutBucket } = await import("../server/api/releases");
  const { sha256Hex } = await import("../server/api/security");
  const database = new D1Adapter(); await migrate(database);
  const now = Date.now();
  database.sqlite.prepare(`INSERT INTO app_releases
    (version_code,version_name,minimum_supported_version_code,forced,rollout_percentage,notes_json,size_bytes,sha256,certificate_sha256,package_id,object_key,status,published_at,created_at,updated_at)
    VALUES (24,'1.3.9',5,0,10,'[]',10,'sha','cert','com.zhuguang.coachos','qa.apk','published',?,?,?)`).run(now,now,now);
  let installationId = "qa-canary-0";
  for (let i = 1; await stableRolloutBucket(installationId) < 10; i++) installationId = `qa-canary-${i}`;
  const config = { versionCode: 24, installationSha256: await sha256Hex(installationId), expiresAt: now + 60_000 };
  const env = { APP_ENV: "test", DB: database, RELEASE_CANARY_JSON: JSON.stringify(config) };
  await assert.rejects(latestReleaseD1(installationId, 22, env), { code: "release_not_available" });
  database.sqlite.prepare(`INSERT INTO app_installations (id,platform,app_version_code,app_version_name,status,last_seen_at,created_at,updated_at)
    VALUES (?,'android',22,'1.3.7','active',?,?,?)`).run(installationId,now,now,now);
  assert.equal((await latestReleaseD1(installationId, 22, env)).versionCode, 24);
  for (const invalid of [{ ...config, versionCode: 25 }, { ...config, expiresAt: now - 1 }, { ...config, installationSha256: "0".repeat(64) }]) {
    await assert.rejects(latestReleaseD1(installationId, 22, { ...env, RELEASE_CANARY_JSON: JSON.stringify(invalid) }), { code: "release_not_available" });
  }
  database.sqlite.prepare("UPDATE app_releases SET status='paused'").run();
  await assert.rejects(latestReleaseD1(installationId, 22, env), { code: "release_not_available" });
  database.sqlite.close();
});

test("public APK downloads require a complete 100% release and rate-limit anonymous devices", async () => {
  const database = new D1Adapter();
  const releases = new MemoryR2();
  await migrate(database);
  const now = Date.now();
  database.sqlite.prepare(`
    INSERT INTO app_releases
      (version_code, version_name, minimum_supported_version_code, forced, rollout_percentage, notes_json, size_bytes, sha256, certificate_sha256, package_id, object_key, status, published_at, created_at, updated_at)
    VALUES (9, '1.2.4', 5, 0, 50, '[]', 10, 'sha', 'cert', 'com.zhuguang.coachos', 'android/1.2.4/app.apk', 'published', ?, ?, ?)
  `).run(now, now, now);
  const env: ApiEnv = { PRIMARY_OPERATOR_EMAIL: 'xuzerui6@gmail.com',
    APP_ENV: "test",
    AUTH_HASH_SECRET: "public-download-hash-secret-with-adequate-length",
    DB: database,
    RELEASES: releases,
    UPDATE_DOWNLOAD_SECRET: "download-test-secret",
  };
  const unavailable = await request(env, "/api/v1/public/app/releases/latest");
  assert.equal(unavailable.response.status, 404);

  await releases.put("android/1.2.4/app.apk", "apk");
  database.sqlite.prepare("UPDATE app_releases SET rollout_percentage = 100 WHERE version_code = 9").run();
  assert.equal((await request(env, "/api/v1/public/app/releases/latest")).response.status, 200);

  for (let index = 0; index < 10; index += 1) {
    const ticket = await request(env, "/api/v1/public/app/releases/9/download-ticket", {
      body: JSON.stringify({ downloadId: "browser-download-device-limit" }),
      headers: { "cf-connecting-ip": "203.0.113.20", "content-type": "application/json" },
      method: "POST",
    });
    assert.equal(ticket.response.status, 201);
  }
  const limited = await request(env, "/api/v1/public/app/releases/9/download-ticket", {
    body: JSON.stringify({ downloadId: "browser-download-device-limit" }),
    headers: { "cf-connecting-ip": "203.0.113.20", "content-type": "application/json" },
    method: "POST",
  });
  assert.equal(limited.response.status, 429);
  assert.equal((limited.payload?.error as { code: string }).code, "download_rate_limited");
  database.sqlite.close();
});
