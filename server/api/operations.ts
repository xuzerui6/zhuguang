import { ApiError, type ApiEnv } from "./contracts";
import type { CoachIdentity, StudentIdentity } from "./repository";
import { decryptContact, encryptContact, normalizeEmail, randomId } from "./security";

type Row = Record<string, unknown>;

function db(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function rows(result: D1Result<Row>) {
  return result.results ?? [];
}

export async function getOpsOverviewD1(env: ApiEnv) {
  const database = db(env);
  const [leads, bookings, coaches, users, deliveries] = await Promise.all([
    database.prepare("SELECT status, count(*) AS count FROM service_leads GROUP BY status").all<Row>(),
    database.prepare("SELECT status, count(*) AS count FROM booking_requests GROUP BY status").all<Row>(),
    database.prepare("SELECT audit_status AS status, count(*) AS count FROM coaches GROUP BY audit_status").all<Row>(),
    database.prepare("SELECT status, count(*) AS count FROM users GROUP BY status").all<Row>(),
    database.prepare("SELECT status, count(*) AS count FROM push_deliveries GROUP BY status").all<Row>(),
  ]);
  return {
    bookings: rows(bookings),
    coaches: rows(coaches),
    leads: rows(leads),
    pushDeliveries: rows(deliveries),
    users: rows(users),
  };
}

export async function createServiceLeadD1(input: {
  coachId?: number;
  contactEmail: string;
  contactName: string;
  district: string;
  goal: string;
  source?: string;
  sport: string;
  userId?: string;
}, env: ApiEnv) {
  const database = db(env);
  const id = randomId("lead");
  const now = Date.now();
  const contactEmail = normalizeEmail(input.contactEmail);
  const contactEmailEncrypted = await encryptContact(contactEmail, env.PHONE_ENCRYPTION_KEY ?? "");
  if (input.coachId) {
    const coach = await database.prepare("SELECT id FROM coaches WHERE id = ? AND audit_status = 'approved'").bind(input.coachId).first<Row>();
    if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
  }
  await database.prepare(`
    INSERT INTO service_leads
      (id, user_id, coach_id, contact_name, contact_email_encrypted, sport, district, goal, source, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
  `).bind(id, input.userId ?? null, input.coachId ?? null, input.contactName, contactEmailEncrypted, input.sport, input.district, input.goal, input.source ?? "web", now, now).run();
  return { id, status: "new" as const };
}

export async function listOpsLeadsD1(env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT l.id, l.contact_name, l.contact_email_encrypted, l.sport, l.district, l.goal, l.source, l.status,
      l.assigned_to, l.note, l.created_at, l.updated_at, c.name AS coach_name
    FROM service_leads l LEFT JOIN coaches c ON c.id = l.coach_id
    ORDER BY CASE l.status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'qualified' THEN 2 ELSE 3 END,
      l.created_at DESC LIMIT 200
  `).all<Row>();
  return Promise.all(rows(result).map(async (row) => ({
    ...row,
    contact_email: row.contact_email_encrypted
      ? await decryptContact(String(row.contact_email_encrypted), env.PHONE_ENCRYPTION_KEY ?? "")
      : "",
    contact_email_encrypted: undefined,
  })));
}

export async function updateOpsLeadD1(id: string, input: { assignedTo?: string; note?: string; status?: string }, actor: string, env: ApiEnv) {
  const allowed = new Set(["new", "contacted", "qualified", "closed"]);
  if (input.status && !allowed.has(input.status)) throw new ApiError(422, "invalid_lead_status", "线索状态无效");
  const database = db(env);
  const existing = await database.prepare("SELECT id, status FROM service_leads WHERE id = ?").bind(id).first<Row>();
  if (!existing) throw new ApiError(404, "lead_not_found", "未找到该服务线索");
  const now = Date.now();
  await database.batch([
    database.prepare(`
      UPDATE service_leads SET status = coalesce(?, status), assigned_to = coalesce(?, assigned_to),
        note = coalesce(?, note), updated_at = ? WHERE id = ?
    `).bind(input.status ?? null, input.assignedTo ?? null, input.note ?? null, now, id),
    database.prepare(`
      INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'lead.update', 'service_lead', ?, ?, ?)
    `).bind(randomId("audit"), actor, id, JSON.stringify(input), now),
  ]);
  return { id, status: input.status ?? existing.status, updatedAt: now };
}

export async function listOpsBookingsD1(env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT b.id, b.status, b.fee_fen, b.payment_status, b.note, b.created_at, b.updated_at,
      l.name AS learner_name, c.name AS coach_name, c.sport, v.name AS venue_name,
      s.starts_at, s.ends_at
    FROM booking_requests b
    JOIN learner_profiles l ON l.id = b.learner_profile_id
    JOIN coaches c ON c.id = b.coach_id
    JOIN venues v ON v.id = b.venue_id
    JOIN availability_slots s ON s.id = b.slot_id
    ORDER BY b.created_at DESC LIMIT 200
  `).all<Row>();
  return rows(result);
}

export async function listOpsCoachesD1(env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT c.id, c.name, c.sport, c.city, c.district, c.title, c.audit_status, c.review_count,
      c.lessons, c.updated_at, c.user_id,
      (SELECT count(*) FROM coach_credentials cc WHERE cc.coach_id = c.id AND cc.status = 'pending') AS pending_credentials,
      (SELECT count(*) FROM availability_slots s WHERE s.coach_id = c.id AND s.status = 'open' AND s.starts_at > unixepoch() * 1000) AS open_slots
    FROM coaches c ORDER BY c.updated_at DESC
  `).all<Row>();
  return rows(result);
}

export async function updateOpsCoachStatusD1(id: number, status: string, actor: string, env: ApiEnv) {
  const allowed = new Set(["draft", "pending", "approved", "rejected", "suspended"]);
  if (!allowed.has(status)) throw new ApiError(422, "invalid_coach_status", "教练审核状态无效");
  const database = db(env);
  const now = Date.now();
  const result = await database.prepare("UPDATE coaches SET audit_status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
  if (!result.meta.changes) throw new ApiError(404, "coach_not_found", "未找到该教练");
  await database.prepare(`
    INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at)
    VALUES (?, ?, 'coach.status', 'coach', ?, ?, ?)
  `).bind(randomId("audit"), actor, String(id), JSON.stringify({ status }), now).run();
  return { id, status };
}

export async function listOpsUsersD1(env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT u.id, u.email_domain, u.phone_last4, u.status, u.created_at, u.updated_at,
      group_concat(r.role) AS roles,
      (SELECT count(*) FROM booking_requests b WHERE b.user_id = u.id) AS booking_count
    FROM users u LEFT JOIN user_roles r ON r.user_id = u.id AND r.status = 'active'
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200
  `).all<Row>();
  return rows(result);
}

export async function listContentDocumentsD1(env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT d.id, d.slug, d.title, d.audience, d.status, d.active_version_id, d.updated_at,
      coalesce(max(v.version), 0) AS latest_version
    FROM content_documents d LEFT JOIN content_versions v ON v.document_id = d.id
    GROUP BY d.id ORDER BY d.updated_at DESC
  `).all<Row>();
  return rows(result);
}

export async function saveContentDocumentD1(input: { audience: string; body: string; slug: string; title: string }, actor: string, env: ApiEnv) {
  const database = db(env);
  const allowedAudience = new Set(["public", "student", "coach"]);
  if (!allowedAudience.has(input.audience)) throw new ApiError(422, "invalid_content_audience", "内容受众无效");
  const now = Date.now();
  let document = await database.prepare("SELECT id FROM content_documents WHERE slug = ?").bind(input.slug).first<Row>();
  const documentId = document ? String(document.id) : randomId("content");
  if (!document) {
    await database.prepare(`
      INSERT INTO content_documents (id, slug, title, audience, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'draft', ?, ?)
    `).bind(documentId, input.slug, input.title, input.audience, now, now).run();
    document = { id: documentId };
  }
  const current = await database.prepare("SELECT coalesce(max(version), 0) AS version FROM content_versions WHERE document_id = ?").bind(documentId).first<Row>();
  const version = Number(current?.version ?? 0) + 1;
  const versionId = randomId("content_version");
  await database.batch([
    database.prepare(`
      INSERT INTO content_versions (id, document_id, version, body, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(versionId, documentId, version, input.body, actor, now),
    database.prepare("UPDATE content_documents SET title = ?, audience = ?, updated_at = ? WHERE id = ?").bind(input.title, input.audience, now, documentId),
  ]);
  return { documentId, version, versionId };
}

export async function publishContentDocumentD1(documentId: string, versionId: string, actor: string, env: ApiEnv) {
  const database = db(env);
  const version = await database.prepare("SELECT id FROM content_versions WHERE id = ? AND document_id = ?").bind(versionId, documentId).first<Row>();
  if (!version) throw new ApiError(404, "content_version_not_found", "未找到该内容版本");
  const now = Date.now();
  await database.batch([
    database.prepare("UPDATE content_versions SET published_at = ? WHERE id = ?").bind(now, versionId),
    database.prepare("UPDATE content_documents SET active_version_id = ?, status = 'published', updated_at = ? WHERE id = ?").bind(versionId, now, documentId),
    database.prepare(`
      INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'content.publish', 'content_document', ?, ?, ?)
    `).bind(randomId("audit"), actor, documentId, JSON.stringify({ versionId }), now),
  ]);
  return { documentId, publishedAt: now, versionId };
}

export async function listStudentTrainingRecordsD1(identity: StudentIdentity, env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT r.id, r.booking_id, r.summary, r.metrics_json, r.coach_notes, r.published_at, r.created_at,
      c.name AS coach_name, c.sport
    FROM training_records r JOIN coaches c ON c.id = r.coach_id
    WHERE r.user_id = ? AND r.published_at IS NOT NULL ORDER BY r.created_at DESC
  `).bind(identity.userId).all<Row>();
  return rows(result);
}

export async function createTrainingRecordD1(identity: CoachIdentity, input: { bookingId: string; coachNotes: string; metrics?: unknown; summary: string }, env: ApiEnv) {
  const database = db(env);
  const booking = await database.prepare("SELECT id, user_id, status FROM booking_requests WHERE id = ? AND coach_id = ?").bind(input.bookingId, identity.coachId).first<Row>();
  if (!booking) throw new ApiError(404, "booking_not_found", "未找到该预约");
  if (booking.status !== "completed") throw new ApiError(409, "booking_not_completed", "课程完成后才能发布训练记录");
  const now = Date.now();
  const id = randomId("training");
  await database.prepare(`
    INSERT INTO training_records
      (id, booking_id, user_id, coach_id, summary, metrics_json, coach_notes, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(booking_id) DO UPDATE SET summary = excluded.summary, metrics_json = excluded.metrics_json,
      coach_notes = excluded.coach_notes, published_at = excluded.published_at, updated_at = excluded.updated_at
  `).bind(id, input.bookingId, booking.user_id, identity.coachId, input.summary, JSON.stringify(input.metrics ?? {}), input.coachNotes, now, now, now).run();
  return { bookingId: input.bookingId, publishedAt: now };
}

export async function createCredentialChangeRequestD1(identity: CoachIdentity, input: { field: string; value: unknown }, env: ApiEnv) {
  const allowed = new Set(["bio", "title", "district", "venue", "price", "trialPrice", "audience", "goals", "strengths"]);
  if (!allowed.has(input.field)) throw new ApiError(422, "invalid_profile_field", "该资料字段不支持在线变更");
  const id = randomId("credential_change");
  const now = Date.now();
  await db(env).prepare(`
    INSERT INTO credential_change_requests (id, coach_id, field, proposed_value_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, identity.coachId, input.field, JSON.stringify(input.value), now, now).run();
  return { id, status: "pending" as const };
}

export async function markNotificationReadD1(identity: StudentIdentity, id: string, env: ApiEnv) {
  const result = await db(env).prepare("UPDATE notifications SET read_at = coalesce(read_at, ?) WHERE id = ? AND user_id = ?").bind(Date.now(), id, identity.userId).run();
  if (!result.meta.changes) throw new ApiError(404, "notification_not_found", "未找到该通知");
  return { id, read: true };
}
