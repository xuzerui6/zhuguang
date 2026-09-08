import { BEIJING_DISTRICTS } from "../../shared/coach-catalog";
import { BODY_LIMITS, readBoundedBody } from "./request-body";
import { ApiError, type ApiEnv } from "./contracts";
import type { CoachIdentity, StudentIdentity } from "./repository";
import { randomId, sha256Hex } from "./security";

type Row = Record<string, unknown>;
type CompletionDecision = "accepted" | "disputed";
type CatalogStatus = "configured" | "published" | "disabled";

const evidenceTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const truthy = (value?: string) => value?.trim().toLowerCase() === "true";

async function hashBytes(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function db(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function rows(result: D1Result<Row>) {
  return result.results ?? [];
}

function assertFeature(enabled: boolean, code: string, message: string) {
  if (!enabled) throw new ApiError(404, code, message);
}

function paymentMode(env: ApiEnv) {
  const requested = truthy(env.ONLINE_TRANSACTION_ENABLED);
  const provider = env.PAYMENT_PROVIDER?.trim().toLowerCase() || "none";
  const testOnly = requested && provider === "test" && env.APP_ENV !== "production";
  return { enabled: testOnly, provider: testOnly ? "test" : "none", requested } as const;
}

export function getPlatformCapabilities(env: ApiEnv) {
  const payment = paymentMode(env);
  return {
    beijingCatalogV2: truthy(env.BEIJING_CATALOG_V2_ENABLED),
    fulfillmentV2: truthy(env.FULFILLMENT_V2_ENABLED),
    onlineTransactions: { enabled: payment.enabled, mode: payment.provider },
    publicTrustMetrics: truthy(env.PUBLIC_TRUST_METRICS_ENABLED),
    supportEvidence: truthy(env.SUPPORT_EVIDENCE_ENABLED) && Boolean(env.EVIDENCE),
  };
}

export async function listPublicCatalogD1(env: ApiEnv) {
  if (!truthy(env.BEIJING_CATALOG_V2_ENABLED)) return { city: "北京", regions: [], sports: [] };
  const database = db(env);
  const [regions, sports] = await Promise.all([
    database.prepare(`SELECT DISTINCT r.id, r.district AS name, r.sort_order FROM service_regions r
      JOIN coach_service_regions cr ON cr.region_id = r.id JOIN coaches c ON c.id = cr.coach_id
      WHERE r.status = 'published' AND c.profile_kind = 'real' AND c.audit_status = 'approved'
        AND c.listing_status = 'online' AND c.city='北京' AND r.city='北京' ORDER BY r.sort_order, r.district`).all<Row>(),
    database.prepare(`SELECT DISTINCT s.id, s.name, s.sort_order FROM service_sports s
      JOIN coach_sports cs ON cs.sport_id = s.id JOIN coaches c ON c.id = cs.coach_id
      WHERE s.status = 'published' AND c.profile_kind = 'real' AND c.audit_status = 'approved'
        AND c.listing_status = 'online' AND c.city='北京' ORDER BY s.sort_order, s.name`).all<Row>(),
  ]);
  return { city: "北京", regions: rows(regions), sports: rows(sports) };
}

export async function listOperatorCatalogD1(env: ApiEnv) {
  const database = db(env);
  const [regions, sports] = await Promise.all([
    database.prepare(`SELECT r.*, count(DISTINCT cr.coach_id) AS coach_count FROM service_regions r
      LEFT JOIN coach_service_regions cr ON cr.region_id = r.id GROUP BY r.id ORDER BY r.sort_order`).all<Row>(),
    database.prepare(`SELECT s.*, count(DISTINCT cs.coach_id) AS coach_count FROM service_sports s
      LEFT JOIN coach_sports cs ON cs.sport_id = s.id GROUP BY s.id ORDER BY s.sort_order`).all<Row>(),
  ]);
  return { regions: rows(regions), sports: rows(sports) };
}

export async function updateOperatorCatalogItemD1(kind: "region" | "sport", id: string, status: CatalogStatus, reason: string, actor: string, requestId: string, env: ApiEnv) {
  if (!new Set<CatalogStatus>(["configured", "published", "disabled"]).has(status)) throw new ApiError(422, "invalid_catalog_status", "目录状态无效");
  if (reason.trim().length < 4) throw new ApiError(422, "reason_required", "请填写至少4字的修改原因");
  const database = db(env); const now = Date.now(); const table = kind === "region" ? "service_regions" : "service_sports";
  const before = await database.prepare(`SELECT status,updated_at FROM ${table} WHERE id=?`).bind(id).first<Row>();
  if (!before) throw new ApiError(404, 'catalog_item_not_found', '未找到目录项');
  const auditId=randomId('audit');
  const result = await database.batch([
    database.prepare(`INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,request_id,created_at) SELECT ?,?,'catalog.status.update',?,?,?,?,? FROM ${table} WHERE id=? AND status=? AND updated_at=?`)
      .bind(auditId,actor,`service_${kind}`,id,JSON.stringify({reason:reason.trim(),before:before.status,status}),requestId,now,id,before.status,before.updated_at),
    database.prepare(`UPDATE ${table} SET status=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM ops_audit_logs WHERE id=?)`).bind(status,Math.max(now,Number(before.updated_at)+1),id,auditId),
  ]);
  if (!result[0].meta.changes) throw new ApiError(409,'catalog_conflict','目录已变化，请刷新后重试');
  return { id, status };
}

export async function createCompletionRequestD1(identity: CoachIdentity, bookingId: string, note: string, env: ApiEnv) {
  if (!identity.userId) throw new ApiError(401, "authentication_required", "请先登录教练账号");
  const database = db(env); const now = Date.now(); const id = randomId("completion");
  const booking = await database.prepare("SELECT id, user_id FROM booking_requests WHERE id = ? AND coach_id = ? AND status = 'confirmed' AND contract_snapshot_id IS NOT NULL").bind(bookingId, identity.coachId).first<Row>();
  if (!booking) throw new ApiError(409, "booking_not_completable", "只有已确认课程可以发起完成确认");
  try {
    await database.batch([
      database.prepare("INSERT INTO booking_completion_requests (id, booking_id, requested_by_user_id, status, coach_note, requested_at, updated_at) VALUES (?, ?, ?, 'pending_student', ?, ?, ?)")
        .bind(id, bookingId, identity.userId, note.trim().slice(0, 1000), now, now),
      database.prepare("INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at) VALUES (?, ?, 'completion_confirmation', '请确认本次课程已完成', '确认后课程才会进入已完成状态；如有异议可直接发起售后。', 'booking', ?, 'student', 'zhuguang://student/bookings', ?)")
        .bind(randomId("notification"), booking.user_id, bookingId, now),
      database.prepare("INSERT INTO booking_events (id, booking_id, actor_type, actor_id, from_status, to_status, detail_json, created_at) VALUES (?, ?, 'coach', ?, 'confirmed', 'confirmed', ?, ?)")
        .bind(randomId("event"), bookingId, identity.userId, JSON.stringify({ action: "completion_requested", completionRequestId: id }), now),
    ]);
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error))) throw new ApiError(409, "completion_request_exists", "该课程已经发起过完成确认");
    throw error;
  }
  return { bookingId, id, status: "pending_student" as const };
}

export async function respondCompletionRequestD1(identity: StudentIdentity, id: string, decision: CompletionDecision, note: string, env: ApiEnv, idempotencyKey?: string, requestId?: string) {
  const database = db(env); const now = Date.now();
  const normalizedNote = note.trim().slice(0, 1000);
  const requestHash = await sha256Hex(JSON.stringify({ id, decision, note: normalizedNote }));
  const key = idempotencyKey || `legacy:${identity.userId}:${requestHash}`;
  const replay = async () => {
    const prior = await database.prepare("SELECT * FROM booking_completion_responses WHERE completion_request_id = ? OR (user_id = ? AND idempotency_key = ?)").bind(id, identity.userId, key).first<Row>();
    if (!prior) return null;
    if (prior.user_id !== identity.userId || prior.idempotency_key !== key || prior.request_hash !== requestHash) throw new ApiError(409, "completion_decision_conflict", "该课程已作出其他决定，请刷新查看");
    return JSON.parse(String(prior.result_json)) as { bookingId: string; id: string; status: CompletionDecision; ticketId?: string };
  };
  const prior = await replay();
  if (prior) return prior;
  const item = await database.prepare(`SELECT r.id, r.booking_id, b.user_id, b.coach_id FROM booking_completion_requests r
    JOIN booking_requests b ON b.id = r.booking_id WHERE r.id = ? AND b.user_id = ? AND r.status = 'pending_student' AND b.status = 'confirmed'`)
    .bind(id, identity.userId).first<Row>();
  if (!item) throw new ApiError(409, "completion_request_not_pending", "该完成确认已处理或不存在");
  const ticketId = randomId("ticket");
  const operationId = randomId("completion_decision");
  const result = { bookingId: String(item.booking_id), id, status: decision, ...(decision === "disputed" ? { ticketId } : {}) };
  const guard = "EXISTS (SELECT 1 FROM booking_completion_responses WHERE operation_id = ?)";
  const statements = [
    database.prepare(`INSERT INTO booking_completion_responses (completion_request_id,operation_id,user_id,idempotency_key,request_hash,decision,result_json,request_id,created_at)
      SELECT r.id,?,?,?,?,?,?,?,? FROM booking_completion_requests r JOIN booking_requests b ON b.id=r.booking_id
      WHERE r.id=? AND r.status='pending_student' AND b.status='confirmed' AND b.user_id=?`).bind(operationId,identity.userId,key,requestHash,decision,JSON.stringify(result),requestId ?? null,now,id,identity.userId),
    database.prepare(`UPDATE booking_completion_requests SET status=?,student_note=?,responded_at=?,updated_at=? WHERE id=? AND ${guard}`).bind(decision,normalizedNote,now,now,id,operationId),
    database.prepare(`INSERT INTO booking_events (id,booking_id,actor_type,actor_id,from_status,to_status,detail_json,created_at)
      SELECT ?,?,'student',?,'confirmed',?,?,? WHERE ${guard}`).bind(randomId("event"),item.booking_id,identity.userId,decision === "accepted" ? "completed" : "confirmed",JSON.stringify({ completionRequestId:id,decision,requestId }),now,operationId),
  ];
  if (decision === "accepted") {
    statements.push(database.prepare(`UPDATE booking_requests SET status='completed',completed_at=?,updated_at=? WHERE id=? AND ${guard}`).bind(now,now,item.booking_id,operationId));
    statements.push(database.prepare(`INSERT OR IGNORE INTO notifications (id,user_id,type,title,body,entity_type,entity_id,target_mode,deep_link,created_at)
      SELECT ?,?,'review_available','本次课程可以评价了','课程已完成，可在有效期内提交真实体验。','booking',?,'student','zhuguang://student/bookings',? WHERE ${guard}`).bind(`review_available_${item.booking_id}`,identity.userId,item.booking_id,now,operationId));
  } else {
    statements.push(database.prepare(`INSERT INTO support_tickets (id,booking_id,created_by_user_id,created_by_role,category,priority,subject,status,ticket_kind,completion_request_id,created_at,updated_at)
      SELECT ?,?,?,'student','service','high','课程完成确认异议','open','completion_dispute',?,?,? WHERE ${guard}`).bind(ticketId,item.booking_id,identity.userId,id,now,now,operationId));
    statements.push(database.prepare(`INSERT INTO support_ticket_messages (id,ticket_id,sender_type,sender_id,body,created_at) SELECT ?,?,'student',?,?,? WHERE ${guard}`).bind(randomId("ticket_message"),ticketId,identity.userId,normalizedNote || "学员对课程完成状态提出异议",now,operationId));
  }
  try {
    const applied = await database.batch(statements);
    if (applied[0].meta.changes) return result;
  } catch (error) {
    const saved = await replay();
    if (saved) return saved;
    throw error;
  }
  const saved = await replay();
  if (saved) return saved;
  throw new ApiError(409, "completion_request_not_pending", "课程状态已变化，请刷新查看");
}

async function assertTicketAccess(userId: string, ticketId: string, env: ApiEnv) {
  const ticket = await db(env).prepare(`SELECT t.id FROM support_tickets t
    LEFT JOIN booking_requests b ON b.id = t.booking_id
    LEFT JOIN coaches c ON c.id = b.coach_id
    WHERE t.id = ? AND (t.created_by_user_id = ? OR b.user_id = ? OR c.user_id = ?)`)
    .bind(ticketId, userId, userId, userId).first<Row>();
  if (!ticket) throw new ApiError(404, "support_ticket_not_found", "未找到该售后工单");
}

export async function uploadSupportEvidenceD1(identity: { userId?: string }, ticketId: string, request: Request, env: ApiEnv) {
  assertFeature(truthy(env.SUPPORT_EVIDENCE_ENABLED) && Boolean(env.EVIDENCE), "support_evidence_disabled", "售后证据附件尚未启用");
  if (!identity.userId) throw new ApiError(401, "authentication_required", "请先登录");
  await assertTicketAccess(identity.userId, ticketId, env);
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!evidenceTypes.has(contentType)) throw new ApiError(415, "unsupported_evidence_type", "仅支持 JPG、PNG、WebP 或 PDF");
  const bytes = await readBoundedBody(request, BODY_LIMITS.evidence);
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new ApiError(413, "evidence_size_invalid", "附件大小需在 10MB 以内");
  const rawName = decodeURIComponent(request.headers.get("x-file-name") || "evidence");
  const fileName = rawName.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_").slice(0, 120) || "evidence";
  const id = randomId("attachment"); const objectKey = `support-evidence/${ticketId}/${id}`; const hash = await hashBytes(bytes); const now = Date.now();
  await env.EVIDENCE!.put(objectKey, bytes, { httpMetadata: { contentType }, customMetadata: { sha256: hash } });
  try {
    await db(env).prepare("INSERT INTO support_ticket_attachments (id, ticket_id, uploaded_by_user_id, object_key, file_name, content_type, size_bytes, sha256, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)")
      .bind(id, ticketId, identity.userId, objectKey, fileName, contentType, bytes.byteLength, hash, now).run();
  } catch (error) {
    await env.EVIDENCE!.delete(objectKey);
    throw error;
  }
  return { contentType, fileName, id, sha256: hash, sizeBytes: bytes.byteLength };
}

export async function downloadSupportEvidenceD1(identity: { userId?: string }, ticketId: string, attachmentId: string, actor: string, requestId: string, env: ApiEnv) {
  assertFeature(truthy(env.SUPPORT_EVIDENCE_ENABLED) && Boolean(env.EVIDENCE), "support_evidence_disabled", "售后证据附件尚未启用");
  if (!identity.userId) throw new ApiError(401, "authentication_required", "请先登录");
  await assertTicketAccess(identity.userId, ticketId, env);
  const row = await db(env).prepare("SELECT object_key, file_name, content_type FROM support_ticket_attachments WHERE id = ? AND ticket_id = ? AND status = 'available'").bind(attachmentId, ticketId).first<Row>();
  if (!row) throw new ApiError(404, "support_attachment_not_found", "未找到该附件");
  const object = await env.EVIDENCE!.get(String(row.object_key));
  if (!object) throw new ApiError(404, "support_attachment_missing", "附件存储对象不存在");
  const now = Date.now();
  await db(env).prepare("INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, request_id, created_at) VALUES (?, ?, 'support.evidence.read', 'support_attachment', ?, '{}', ?, ?)")
    .bind(randomId("audit"), actor, attachmentId, requestId, now).run();
  return new Response(object.body, { headers: { "cache-control": "private, no-store", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(row.file_name))}`, "content-type": String(row.content_type), "x-content-type-options": "nosniff" } });
}

export async function createTestPaymentOrderD1(identity: StudentIdentity, bookingId: string, idempotencyKey: string, env: ApiEnv) {
  const mode = paymentMode(env);
  assertFeature(mode.enabled, "online_transaction_unavailable", "在线交易仅在隔离测试环境可用");
  const database = db(env);
  const existing = await database.prepare("SELECT * FROM payment_orders WHERE user_id = ? AND idempotency_key = ?").bind(identity.userId, idempotencyKey).first<Row>();
  if (existing) return existing;
  const booking = await database.prepare("SELECT id, fee_fen, contract_snapshot_id FROM booking_requests WHERE id = ? AND user_id = ? AND status = 'confirmed'").bind(bookingId, identity.userId).first<Row>();
  if (!booking?.contract_snapshot_id) throw new ApiError(409, "booking_contract_required", "该预约没有 V2 合同快照，不能进入测试交易");
  const id = randomId("payment"); const now = Date.now();
  await database.batch([
    database.prepare("INSERT INTO payment_orders (id, booking_id, user_id, provider, environment, idempotency_key, amount_fen, service_fee_fen, status, created_at, updated_at) VALUES (?, ?, ?, 'test', 'test', ?, ?, 0, 'created', ?, ?)").bind(id, bookingId, identity.userId, idempotencyKey, Number(booking.fee_fen), now, now),
    database.prepare("INSERT INTO payment_attempts (id, payment_order_id, action, outcome, detail_json, created_at) VALUES (?, ?, 'create', 'created', '{}', ?)").bind(randomId("payment_attempt"), id, now),
  ]);
  return { amountFen: Number(booking.fee_fen), environment: "test", id, status: "created" };
}

export async function confirmTestPaymentD1(identity: StudentIdentity, id: string, env: ApiEnv) {
  const mode = paymentMode(env);
  assertFeature(mode.enabled, "online_transaction_unavailable", "在线交易仅在隔离测试环境可用");
  const database = db(env); const now = Date.now(); const order = await database.prepare("SELECT id, booking_id, status FROM payment_orders WHERE id = ? AND user_id = ? AND provider = 'test' AND environment = 'test'").bind(id, identity.userId).first<Row>();
  if (!order) throw new ApiError(404, "payment_order_not_found", "未找到测试支付订单");
  if (order.status === "paid") return { id, status: "paid" as const };
  if (order.status !== "created" && order.status !== "pending") throw new ApiError(409, "payment_order_not_payable", "该订单当前不能支付");
  await database.batch([
    database.prepare("UPDATE payment_orders SET status = 'paid', provider_order_id = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status IN ('created','pending')").bind(`test_${id}`, now, now, id),
    database.prepare("INSERT INTO payment_attempts (id, payment_order_id, provider_event_id, action, outcome, detail_json, created_at) VALUES (?, ?, ?, 'confirm', 'paid', '{}', ?)").bind(randomId("payment_attempt"), id, `test_confirm_${id}`, now),
    database.prepare("UPDATE booking_requests SET payment_status = 'online_paid', updated_at = ? WHERE id = ?").bind(now, order.booking_id),
  ]);
  return { id, status: "paid" as const };
}

export async function createRefundRequestD1(identity: StudentIdentity, orderId: string, amountFen: number, reason: string, env: ApiEnv) {
  const mode = paymentMode(env);
  assertFeature(mode.enabled, "online_transaction_unavailable", "退款申请仅在隔离测试环境可用");
  if (!Number.isInteger(amountFen) || amountFen <= 0) throw new ApiError(422, "invalid_refund_amount", "退款金额必须为正整数分");
  const database = db(env); const order = await database.prepare(`SELECT o.amount_fen, o.status,
    coalesce((SELECT sum(r.amount_fen) FROM refund_requests r WHERE r.payment_order_id = o.id AND r.status IN ('approved','processing','succeeded')),0) AS reserved_refund
    FROM payment_orders o WHERE o.id = ? AND o.user_id = ? AND o.environment = 'test'`).bind(orderId, identity.userId).first<Row>();
  if (!order || !["paid", "partially_refunded"].includes(String(order.status))) throw new ApiError(409, "payment_not_refundable", "该测试订单当前不能申请退款");
  if (amountFen > Number(order.amount_fen) - Number(order.reserved_refund)) throw new ApiError(422, "refund_amount_exceeded", "退款金额超过可退余额");
  if (reason.trim().length < 4) throw new ApiError(422, "refund_reason_required", "请填写至少4字的退款原因");
  const id = randomId("refund"); const now = Date.now();
  await database.batch([
    database.prepare("INSERT INTO refund_requests (id, payment_order_id, requested_by_user_id, amount_fen, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending_review', ?, ?)").bind(id, orderId, identity.userId, amountFen, reason.trim().slice(0, 500), now, now),
    database.prepare("INSERT INTO refund_events (id, refund_request_id, from_status, to_status, actor, detail_json, created_at) VALUES (?, ?, NULL, 'pending_review', ?, '{}', ?)").bind(randomId("refund_event"), id, identity.userId, now),
  ]);
  return { id, status: "pending_review" as const };
}

export async function listOperatorTransactionsD1(env: ApiEnv) {
  const database = db(env);
  const [orders, refunds] = await Promise.all([
    database.prepare("SELECT id, booking_id, provider, environment, amount_fen, service_fee_fen, status, paid_at, created_at FROM payment_orders ORDER BY created_at DESC LIMIT 200").all<Row>(),
    database.prepare("SELECT id, payment_order_id, amount_fen, reason, status, reviewed_by, created_at FROM refund_requests ORDER BY created_at DESC LIMIT 200").all<Row>(),
  ]);
  return { orders: rows(orders), refunds: rows(refunds) };
}

export { classifyMetricEntityD1 } from './data-classification';

export async function getPublicTrustMetricsD1(env: ApiEnv) {
  assertFeature(truthy(env.PUBLIC_TRUST_METRICS_ENABLED), "public_trust_metrics_disabled", "公开信任指标尚未启用");
  const database = db(env);
  const [coaches, bookings, reviews] = await Promise.all([
    database.prepare(`SELECT count(*) AS count FROM coaches c JOIN entity_metric_classifications m ON m.entity_type='coach' AND m.entity_id=CAST(c.id AS TEXT)
      WHERE c.profile_kind='real' AND c.audit_status='approved' AND c.listing_status='online' AND m.classification='production_eligible'`).first<Row>(),
    database.prepare(`SELECT count(*) AS count FROM booking_requests b JOIN coaches c ON c.id=b.coach_id JOIN users u ON u.id=b.user_id
      JOIN entity_metric_classifications m ON m.entity_type='booking' AND m.entity_id=b.id AND m.classification='production_eligible'
      JOIN entity_metric_classifications a ON a.entity_type='user' AND a.entity_id=b.user_id AND a.classification='production_eligible'
      JOIN entity_metric_classifications cproof ON cproof.entity_type='coach' AND cproof.entity_id=CAST(c.id AS TEXT) AND cproof.classification='production_eligible'
      WHERE b.status='completed' AND c.profile_kind='real' AND u.status='active'`).first<Row>(),
    database.prepare(`SELECT count(*) AS count FROM coach_reviews r JOIN booking_requests b ON b.id=r.booking_id JOIN coaches c ON c.id=b.coach_id JOIN users u ON u.id=b.user_id
      JOIN entity_metric_classifications m ON m.entity_type='booking' AND m.entity_id=b.id AND m.classification='production_eligible'
      JOIN entity_metric_classifications a ON a.entity_type='user' AND a.entity_id=b.user_id AND a.classification='production_eligible'
      JOIN entity_metric_classifications v ON v.entity_type='review' AND v.entity_id=r.id AND v.classification='production_eligible'
      JOIN entity_metric_classifications cproof ON cproof.entity_type='coach' AND cproof.entity_id=CAST(c.id AS TEXT) AND cproof.classification='production_eligible'
      WHERE r.status='approved' AND b.status='completed' AND c.profile_kind='real' AND u.status='active'`).first<Row>(),
  ]);
  const metrics = [
    { key: "verifiedCoaches", label: "已核验公开教练", value: Number(coaches?.count || 0) },
    { key: "completedServices", label: "合格真实履约", value: Number(bookings?.count || 0) },
    { key: "verifiedReviews", label: "已审核真实评价", value: Number(reviews?.count || 0) },
  ].filter((metric) => metric.value > 0);
  return { city: "北京", metrics };
}

export function assertBeijingDistrict(value: string) {
  if (!BEIJING_DISTRICTS.includes(value as (typeof BEIJING_DISTRICTS)[number])) throw new ApiError(422, "invalid_beijing_district", "经营地点仅限北京 16 区");
  return value;
}
