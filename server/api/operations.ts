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
    database.prepare("SELECT listing_status AS status, count(*) AS count FROM coaches WHERE audit_status = 'approved' GROUP BY listing_status").all<Row>(),
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
    const coach = await database.prepare("SELECT id FROM coaches WHERE id = ? AND audit_status = 'approved' AND listing_status = 'online' AND profile_kind = 'real'").bind(input.coachId).first<Row>();
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
    SELECT c.id, c.name, c.sport, c.city, c.district, c.title, c.audit_status, c.listing_status,
      c.listing_reason, c.listing_changed_by, c.listing_changed_at, c.profile_kind, c.pricing_status, c.booking_enabled,
      c.price_fen, c.trial_price_fen,
      c.review_count, c.lessons, c.updated_at, c.user_id,
      (SELECT count(*) FROM coach_credentials cc WHERE cc.coach_id = c.id AND cc.status = 'pending') AS pending_credentials,
      (SELECT count(*) FROM availability_slots s WHERE s.coach_id = c.id AND s.status = 'open' AND s.starts_at > unixepoch() * 1000) AS open_slots
    FROM coaches c ORDER BY CASE c.profile_kind WHEN 'real' THEN 0 ELSE 1 END, c.id ASC
  `).all<Row>();
  return rows(result);
}

export async function getOpsCoachBusinessSettingsD1(id: number, env: ApiEnv) {
  const database = db(env);
  const coach = await database.prepare(`
    SELECT id, district, price_fen, trial_price_fen, pricing_status, booking_enabled
    FROM coaches WHERE id = ?
  `).bind(id).first<Row>();
  if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
  const venueRows = await database.prepare(`
    SELECT id, coach_id, name, address, district, active, created_at, updated_at
    FROM venues WHERE coach_id = ? ORDER BY active DESC, created_at ASC
  `).bind(id).all<Row>();
  return {
    bookingEnabled: coach.booking_enabled !== 0,
    coachId: id,
    district: String(coach.district ?? ""),
    priceFen: Number(coach.price_fen ?? 0),
    pricingStatus: coach.pricing_status === "unavailable" ? "unavailable" : "published",
    trialPriceFen: Number(coach.trial_price_fen ?? 0),
    venues: rows(venueRows).map((venue) => ({
      active: venue.active !== 0,
      address: String(venue.address ?? ""),
      coachId: Number(venue.coach_id),
      district: String(venue.district ?? ""),
      id: String(venue.id),
      name: String(venue.name ?? ""),
    })),
  };
}

export async function updateOpsCoachBusinessSettingsD1(
  id: number,
  input: { bookingEnabled?: boolean; district?: string; priceFen?: number; pricingStatus?: string; reason: string; trialPriceFen?: number },
  actor: string,
  requestId: string,
  env: ApiEnv,
) {
  const reason = input.reason.trim().slice(0, 300);
  if (!reason) throw new ApiError(422, "operation_reason_required", "请填写修改原因");
  if (input.pricingStatus != null && !["published", "unavailable"].includes(input.pricingStatus)) {
    throw new ApiError(422, "invalid_pricing_status", "价格发布状态无效");
  }
  for (const [field, value] of [["priceFen", input.priceFen], ["trialPriceFen", input.trialPriceFen]] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value > 10_000_000)) {
      throw new ApiError(422, "invalid_price", "价格必须使用有效的整数分", { [field]: "请输入0至100000元之间的金额" });
    }
  }
  const district = input.district?.trim().slice(0, 40);
  if (input.district != null && !district) throw new ApiError(422, "invalid_district", "请填写服务区域");
  const database = db(env);
  const previous = await database.prepare(`
    SELECT district, price_fen, trial_price_fen, pricing_status, booking_enabled FROM coaches WHERE id = ?
  `).bind(id).first<Row>();
  if (!previous) throw new ApiError(404, "coach_not_found", "未找到该教练");
  const next = {
    bookingEnabled: input.bookingEnabled ?? previous.booking_enabled !== 0,
    district: district ?? String(previous.district ?? ""),
    priceFen: input.priceFen ?? Number(previous.price_fen ?? 0),
    pricingStatus: input.pricingStatus ?? String(previous.pricing_status ?? "published"),
    trialPriceFen: input.trialPriceFen ?? Number(previous.trial_price_fen ?? 0),
  };
  const now = Date.now();
  await database.batch([
    database.prepare(`
      UPDATE coaches SET district = ?, price_fen = ?, trial_price_fen = ?, pricing_status = ?, booking_enabled = ?, updated_at = ?
      WHERE id = ?
    `).bind(next.district, next.priceFen, next.trialPriceFen, next.pricingStatus, next.bookingEnabled ? 1 : 0, now, id),
    database.prepare(`
      INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'coach.business.update', 'coach', ?, ?, ?)
    `).bind(randomId("audit"), actor, String(id), JSON.stringify({ next, previous, reason, requestId }), now),
  ]);
  return getOpsCoachBusinessSettingsD1(id, env);
}

export async function createOpsCoachVenueD1(
  coachId: number,
  input: { address: string; district: string; name: string; reason: string },
  actor: string,
  requestId: string,
  env: ApiEnv,
) {
  const name = input.name.trim().slice(0, 120);
  const address = input.address.trim().slice(0, 240);
  const district = input.district.trim().slice(0, 40);
  const reason = input.reason.trim().slice(0, 300);
  if (!name || !address || !district || !reason) throw new ApiError(422, "validation_failed", "请完整填写场馆和操作原因");
  const database = db(env);
  if (!await database.prepare("SELECT id FROM coaches WHERE id = ?").bind(coachId).first<Row>()) throw new ApiError(404, "coach_not_found", "未找到该教练");
  const id = randomId("venue"); const now = Date.now();
  await database.batch([
    database.prepare(`INSERT INTO venues (id, coach_id, name, address, city, district, active, created_at, updated_at) VALUES (?, ?, ?, ?, '北京', ?, 1, ?, ?)`).bind(id, coachId, name, address, district, now, now),
    database.prepare(`INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, 'coach.venue.create', 'venue', ?, ?, ?)`).bind(randomId("audit"), actor, id, JSON.stringify({ address, coachId, district, name, reason, requestId }), now),
  ]);
  return { active: true, address, coachId, district, id, name };
}

export async function updateOpsCoachVenueD1(
  coachId: number,
  venueId: string,
  input: { active?: boolean; address?: string; district?: string; name?: string; reason: string },
  actor: string,
  requestId: string,
  env: ApiEnv,
) {
  const reason = input.reason.trim().slice(0, 300);
  if (!reason) throw new ApiError(422, "operation_reason_required", "请填写修改原因");
  const database = db(env);
  const previous = await database.prepare("SELECT * FROM venues WHERE id = ? AND coach_id = ?").bind(venueId, coachId).first<Row>();
  if (!previous) throw new ApiError(404, "venue_not_found", "未找到该训练场馆");
  if (input.active === false && previous.active !== 0) {
    const linked = await database.prepare(`SELECT id FROM availability_slots WHERE venue_id = ? AND starts_at > ? AND status IN ('open', 'held', 'booked') LIMIT 1`).bind(venueId, Date.now()).first<Row>();
    if (linked) throw new ApiError(409, "venue_has_future_slots", "该场馆仍有未来排期，请先撤销或完成相关时段");
  }
  const next = {
    active: input.active ?? previous.active !== 0,
    address: input.address?.trim().slice(0, 240) || String(previous.address ?? ""),
    district: input.district?.trim().slice(0, 40) || String(previous.district ?? ""),
    name: input.name?.trim().slice(0, 120) || String(previous.name ?? ""),
  };
  const now = Date.now();
  await database.batch([
    database.prepare("UPDATE venues SET name = ?, address = ?, district = ?, active = ?, updated_at = ? WHERE id = ? AND coach_id = ?").bind(next.name, next.address, next.district, next.active ? 1 : 0, now, venueId, coachId),
    database.prepare(`INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, 'coach.venue.update', 'venue', ?, ?, ?)`).bind(randomId("audit"), actor, venueId, JSON.stringify({ coachId, next, previous, reason, requestId }), now),
  ]);
  return { ...next, coachId, id: venueId };
}

export async function updateOpsCoachStatusD1(id: number, status: string, actor: string, env: ApiEnv) {
  const allowed = new Set(["draft", "pending", "approved", "rejected", "suspended"]);
  if (!allowed.has(status)) throw new ApiError(422, "invalid_coach_status", "教练审核状态无效");
  const database = db(env);
  const now = Date.now();
  const coach = await database.prepare("SELECT audit_status FROM coaches WHERE id = ?").bind(id).first<Row>();
  if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
  const fromStatus = String(coach.audit_status ?? "draft");
  await database.batch([
    database.prepare("UPDATE coaches SET audit_status = ?, updated_at = ? WHERE id = ?").bind(status, now, id),
    database.prepare(`
      INSERT INTO coach_status_events (id, coach_id, event_type, from_status, to_status, reason, actor, created_at)
      VALUES (?, ?, 'audit', ?, ?, '', ?, ?)
    `).bind(randomId("coach_event"), id, fromStatus, status, actor, now),
    database.prepare(`
      INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'coach.audit', 'coach', ?, ?, ?)
    `).bind(randomId("audit"), actor, String(id), JSON.stringify({ fromStatus, status }), now),
  ]);
  return { id, status };
}

export async function updateOpsCoachListingD1(id: number, status: string, reason: string, actor: string, env: ApiEnv) {
  if (status !== "online" && status !== "offline") throw new ApiError(422, "invalid_listing_status", "教练展示状态无效");
  const normalizedReason = reason.trim().slice(0, 300);
  if (!normalizedReason) throw new ApiError(422, "listing_reason_required", "请填写上下线原因");
  const database = db(env);
  const coach = await database.prepare("SELECT listing_status, audit_status FROM coaches WHERE id = ?").bind(id).first<Row>();
  if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
  if (status === "online" && coach.audit_status !== "approved") {
    throw new ApiError(409, "coach_not_approved", "只有审核通过的教练才能上线");
  }
  const fromStatus = String(coach.listing_status ?? "offline");
  const now = Date.now();
  if (fromStatus === status) return { id, status, unchanged: true };
  await database.batch([
    database.prepare(`
      UPDATE coaches SET listing_status = ?, listing_reason = ?, listing_changed_by = ?, listing_changed_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, normalizedReason, actor, now, now, id),
    database.prepare(`
      INSERT INTO coach_status_events (id, coach_id, event_type, from_status, to_status, reason, actor, created_at)
      VALUES (?, ?, 'listing', ?, ?, ?, ?, ?)
    `).bind(randomId("coach_event"), id, fromStatus, status, normalizedReason, actor, now),
    database.prepare(`
      INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'coach.listing', 'coach', ?, ?, ?)
    `).bind(randomId("audit"), actor, String(id), JSON.stringify({ fromStatus, reason: normalizedReason, status }), now),
  ]);
  return { id, status };
}

export async function batchUpdateOpsCoachListingD1(ids: number[], status: string, reason: string, actor: string, env: ApiEnv) {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0).slice(0, 100);
  if (!uniqueIds.length) throw new ApiError(422, "coach_ids_required", "请选择至少一位教练");
  const results = [];
  for (const id of uniqueIds) results.push(await updateOpsCoachListingD1(id, status, reason, actor, env));
  return { count: results.length, results };
}

export async function listOpsCoachStatusEventsD1(id: number, env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT id, event_type, from_status, to_status, reason, actor, created_at
    FROM coach_status_events WHERE coach_id = ? ORDER BY created_at DESC LIMIT 100
  `).bind(id).all<Row>();
  return rows(result);
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
  const allowed = new Set(["bio", "title", "district", "venue", "price", "trialPrice", "audience", "goals", "strengths", "honors", "motto"]);
  if (!allowed.has(input.field)) throw new ApiError(422, "invalid_profile_field", "该资料字段不支持在线变更");
  const database = db(env);
  const conflict = await database.prepare("SELECT id FROM credential_change_requests WHERE coach_id = ? AND field = ? AND status = 'pending'").bind(identity.coachId, input.field).first<Row>();
  if (conflict) throw new ApiError(409, "profile_change_conflict", "该资料已有待审核申请，请先撤回或等待审核");
  const coach = await database.prepare("SELECT * FROM coaches WHERE id = ?").bind(identity.coachId).first<Row>();
  if (!coach) throw new ApiError(404, "coach_not_found", "未找到教练资料");
  const currentValue = await currentCoachFieldValue(database, coach, input.field);
  const id = randomId("credential_change");
  const now = Date.now();
  await database.prepare(`
    INSERT INTO credential_change_requests (id, coach_id, field, proposed_value_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).bind(id, identity.coachId, input.field, JSON.stringify(input.value), now, now).run();
  await database.prepare("UPDATE credential_change_requests SET current_value_json = ? WHERE id = ?").bind(JSON.stringify(currentValue), id).run();
  return { id, status: "pending" as const };
}

async function currentCoachFieldValue(database: D1Database, coach: Row, field: string) {
  const columns: Record<string, string> = {
    audience: "audience_json", bio: "bio", district: "district", goals: "goals_json", honors: "honors_json",
    motto: "motto", price: "price_fen", strengths: "strengths_json", title: "title", trialPrice: "trial_price_fen",
  };
  if (field === "venue") {
    const venue = await database.prepare("SELECT name, address, district FROM venues WHERE coach_id = ? AND active = 1 ORDER BY created_at LIMIT 1").bind(coach.id).first<Row>();
    return venue ?? null;
  }
  const raw = coach[columns[field]];
  if (["audience", "goals", "honors", "strengths"].includes(field)) {
    try { return JSON.parse(String(raw ?? "[]")); } catch { return []; }
  }
  if (field === "price" || field === "trialPrice") return Number(raw ?? 0) / 100;
  return raw ?? "";
}

export async function listCoachProfileChangesD1(identity: CoachIdentity, env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT id, field, current_value_json, proposed_value_json, status, review_note, reviewed_by, reviewed_at, created_at, updated_at
    FROM credential_change_requests WHERE coach_id = ? ORDER BY created_at DESC LIMIT 100
  `).bind(identity.coachId).all<Row>();
  return rows(result);
}

export async function withdrawCoachProfileChangeD1(identity: CoachIdentity, requestId: string, env: ApiEnv) {
  const result = await db(env).prepare(`
    UPDATE credential_change_requests SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND coach_id = ? AND status = 'pending'
  `).bind(Date.now(), requestId, identity.coachId).run();
  if (!result.meta.changes) throw new ApiError(409, "profile_change_not_withdrawable", "该申请当前不能撤回");
  return { id: requestId, status: "cancelled" as const };
}

export async function listOpsProfileChangesD1(env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT r.id, r.coach_id, c.name AS coach_name, r.field, r.current_value_json, r.proposed_value_json,
      r.status, r.review_note, r.reviewed_by, r.reviewed_at, r.created_at, r.updated_at
    FROM credential_change_requests r JOIN coaches c ON c.id = r.coach_id
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200
  `).all<Row>();
  return rows(result);
}

export async function reviewCoachProfileChangeD1(id: string, decision: "approved" | "rejected", note: string, actor: string, env: ApiEnv) {
  if (!note.trim()) throw new ApiError(422, "review_note_required", "请填写审核意见");
  const database = db(env);
  const request = await database.prepare("SELECT * FROM credential_change_requests WHERE id = ? AND status = 'pending'").bind(id).first<Row>();
  if (!request) throw new ApiError(409, "profile_change_not_pending", "该申请已处理或不存在");
  const now = Date.now();
  if (decision === "rejected") {
    await database.batch([
      database.prepare("UPDATE credential_change_requests SET status = 'rejected', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(note.trim(), actor, now, now, id),
      database.prepare("INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, 'coach.profile.reject', 'credential_change_request', ?, ?, ?)").bind(randomId("audit"), actor, id, JSON.stringify({ note: note.trim() }), now),
    ]);
    return { id, status: decision };
  }
  const field = String(request.field);
  const coachId = Number(request.coach_id);
  const next = JSON.parse(String(request.proposed_value_json));
  const statements = [];
  const scalarColumns: Record<string, string> = { bio: "bio", district: "district", motto: "motto", title: "title" };
  const jsonColumns: Record<string, string> = { audience: "audience_json", goals: "goals_json", honors: "honors_json", strengths: "strengths_json" };
  if (scalarColumns[field]) statements.push(database.prepare(`UPDATE coaches SET ${scalarColumns[field]} = ?, updated_at = ? WHERE id = ?`).bind(String(next).slice(0, 2000), now, coachId));
  else if (jsonColumns[field]) statements.push(database.prepare(`UPDATE coaches SET ${jsonColumns[field]} = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(Array.isArray(next) ? next.slice(0, 20) : []), now, coachId));
  else if (field === "price" || field === "trialPrice") statements.push(database.prepare(`UPDATE coaches SET ${field === "price" ? "price_fen" : "trial_price_fen"} = ?, updated_at = ? WHERE id = ?`).bind(Math.max(0, Math.round(Number(next) * 100)), now, coachId));
  else if (field === "venue") {
    const venue = typeof next === "object" && next ? next as Record<string, unknown> : { name: String(next) };
    const existingVenue = await database.prepare("SELECT id FROM venues WHERE coach_id = ? AND active = 1 ORDER BY created_at LIMIT 1").bind(coachId).first<Row>();
    const name = String(venue.name ?? "").trim().slice(0, 120);
    const address = String(venue.address ?? "").trim().slice(0, 240);
    const district = String(venue.district ?? "").trim().slice(0, 40);
    if (!name || !address || !district) throw new ApiError(422, "invalid_venue", "场馆名称、地址和区域不能为空");
    statements.push(existingVenue
      ? database.prepare("UPDATE venues SET name = ?, address = ?, district = ?, updated_at = ? WHERE id = ?").bind(name, address, district, now, existingVenue.id)
      : database.prepare("INSERT INTO venues (id, coach_id, name, address, city, district, active, created_at, updated_at) VALUES (?, ?, ?, ?, '北京', ?, 1, ?, ?)").bind(randomId("venue"), coachId, name, address, district, now, now));
  } else throw new ApiError(422, "invalid_profile_field", "该资料字段不支持审核应用");
  statements.push(
    database.prepare("UPDATE credential_change_requests SET status = 'approved', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(note.trim(), actor, now, now, id),
    database.prepare("INSERT INTO coach_profile_versions (id, coach_id, request_id, field, previous_value_json, next_value_json, approved_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(randomId("profile_version"), coachId, id, field, request.current_value_json, request.proposed_value_json, actor, now),
    database.prepare("INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, 'coach.profile.approve', 'credential_change_request', ?, ?, ?)").bind(randomId("audit"), actor, id, JSON.stringify({ coachId, field }), now),
  );
  await database.batch(statements);
  return { id, status: decision };
}

export async function createCoachReviewD1(identity: StudentIdentity, input: { bookingId: string; body: string; rating: number }, env: ApiEnv) {
  const database = db(env);
  const booking = await database.prepare("SELECT id, coach_id FROM booking_requests WHERE id = ? AND user_id = ? AND status = 'completed'").bind(input.bookingId, identity.userId).first<Row>();
  if (!booking) throw new ApiError(409, "review_booking_ineligible", "只有已完成的本人课程可以评价");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new ApiError(422, "invalid_rating", "评分必须为1到5分");
  const id = randomId("review"); const now = Date.now();
  try {
    await database.prepare("INSERT INTO coach_reviews (id, booking_id, user_id, coach_id, rating, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)").bind(id, input.bookingId, identity.userId, booking.coach_id, input.rating, input.body.trim().slice(0, 1000), now, now).run();
  } catch { throw new ApiError(409, "review_already_exists", "该课程已经提交过评价"); }
  return { id, status: "pending" as const };
}

export async function listPublicCoachReviewsD1(coachId: number, env: ApiEnv) {
  const result = await db(env).prepare("SELECT id, rating, body, created_at FROM coach_reviews WHERE coach_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 50").bind(coachId).all<Row>();
  return rows(result);
}

export async function listOpsReviewsD1(env: ApiEnv) {
  const result = await db(env).prepare(`SELECT r.*, c.name AS coach_name FROM coach_reviews r JOIN coaches c ON c.id = r.coach_id ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200`).all<Row>();
  return rows(result);
}

export async function moderateReviewD1(id: string, status: "approved" | "rejected", note: string, actor: string, env: ApiEnv) {
  const database = db(env); const now = Date.now();
  const review = await database.prepare("SELECT coach_id, status FROM coach_reviews WHERE id = ?").bind(id).first<Row>();
  if (!review || review.status !== "pending") throw new ApiError(409, "review_not_pending", "该评价已处理或不存在");
  await database.batch([
    database.prepare("UPDATE coach_reviews SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(status, note.trim(), actor, now, now, id),
    database.prepare(`UPDATE coaches SET review_count = (SELECT count(*) FROM coach_reviews WHERE coach_id = ? AND status = 'approved'), rating_basis_points = coalesce((SELECT round(avg(rating) * 100) FROM coach_reviews WHERE coach_id = ? AND status = 'approved'), 0), updated_at = ? WHERE id = ?`).bind(review.coach_id, review.coach_id, now, review.coach_id),
    database.prepare("INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, 'review.moderate', 'coach_review', ?, ?, ?)").bind(randomId("audit"), actor, id, JSON.stringify({ note, status }), now),
  ]);
  return { id, status };
}

export async function createSupportTicketD1(identity: { userId: string }, input: { bookingId?: string; body: string; category: string; subject: string }, role: "student" | "coach", env: ApiEnv) {
  const allowed = new Set(["service", "booking", "payment", "safety", "privacy", "other"]);
  if (!allowed.has(input.category)) throw new ApiError(422, "invalid_ticket_category", "工单分类无效");
  const database = db(env); const id = randomId("ticket"); const now = Date.now();
  await database.batch([
    database.prepare("INSERT INTO support_tickets (id, booking_id, created_by_user_id, created_by_role, category, priority, subject, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)").bind(id, input.bookingId ?? null, identity.userId, role, input.category, input.category === "safety" ? "urgent" : "normal", input.subject.trim().slice(0, 120), now, now),
    database.prepare("INSERT INTO support_ticket_messages (id, ticket_id, sender_type, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(randomId("ticket_message"), id, role, identity.userId, input.body.trim().slice(0, 3000), now),
  ]);
  return { id, status: "open" as const };
}

export async function listUserSupportTicketsD1(identity: { userId: string }, env: ApiEnv) {
  const result = await db(env).prepare(`SELECT t.*, (SELECT body FROM support_ticket_messages m WHERE m.ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS latest_message FROM support_tickets t WHERE created_by_user_id = ? ORDER BY updated_at DESC LIMIT 100`).bind(identity.userId).all<Row>();
  return rows(result);
}

export async function listOpsSupportTicketsD1(env: ApiEnv) {
  const result = await db(env).prepare(`SELECT t.*, (SELECT body FROM support_ticket_messages m WHERE m.ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS latest_message FROM support_tickets t ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, updated_at DESC LIMIT 200`).all<Row>();
  return rows(result);
}

export async function updateOpsSupportTicketD1(id: string, input: { body?: string; status?: string }, actor: string, env: ApiEnv) {
  const allowed = new Set(["open", "in_progress", "waiting_user", "resolved", "closed"]);
  if (input.status && !allowed.has(input.status)) throw new ApiError(422, "invalid_ticket_status", "工单状态无效");
  const database = db(env); const now = Date.now();
  const ticket = await database.prepare("SELECT id FROM support_tickets WHERE id = ?").bind(id).first<Row>();
  if (!ticket) throw new ApiError(404, "ticket_not_found", "未找到该工单");
  const statements = [database.prepare("UPDATE support_tickets SET status = coalesce(?, status), assigned_to = ?, updated_at = ?, closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END WHERE id = ?").bind(input.status ?? null, actor, now, input.status ?? null, now, id)];
  if (input.body?.trim()) statements.push(database.prepare("INSERT INTO support_ticket_messages (id, ticket_id, sender_type, sender_id, body, created_at) VALUES (?, ?, 'operator', ?, ?, ?)").bind(randomId("ticket_message"), id, actor, input.body.trim().slice(0, 3000), now));
  statements.push(database.prepare("INSERT INTO ops_audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, 'ticket.update', 'support_ticket', ?, ?, ?)").bind(randomId("audit"), actor, id, JSON.stringify(input), now));
  await database.batch(statements);
  return { id, status: input.status ?? "updated" };
}

export async function listOpsAuditLogsD1(env: ApiEnv) {
  const result = await db(env).prepare("SELECT id, actor, action, entity_type, entity_id, detail_json, request_id, created_at FROM ops_audit_logs ORDER BY created_at DESC LIMIT 300").all<Row>();
  return rows(result);
}

export async function createCoachRescheduleProposalD1(identity: CoachIdentity, input: { bookingId: string; customAddress?: string; customDistrict?: string; customLocationNote?: string; locationType?: "venue" | "custom"; note: string; slotId?: string; startsAt?: number; venueId?: string }, env: ApiEnv) {
  const database = db(env); const now = Date.now();
  const booking = await database.prepare(`SELECT b.id, b.user_id, b.slot_id, b.status, b.venue_id, s.starts_at, s.ends_at,
    coalesce(d.duration_minutes, round((s.ends_at - s.starts_at) / 60000)) AS duration_minutes
    FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id
    LEFT JOIN booking_request_details d ON d.booking_id = b.id WHERE b.id = ? AND b.coach_id = ?`
  ).bind(input.bookingId, identity.coachId).first<Row>();
  if (!booking || (booking.status !== "pending_coach" && booking.status !== "confirmed")) throw new ApiError(409, "booking_not_reschedulable", "该预约当前不能发起改期");
  const pending = await database.prepare("SELECT id FROM booking_reschedule_proposals WHERE booking_id = ? AND status = 'pending'").bind(input.bookingId).first<Row>();
  if (pending) throw new ApiError(409, "reschedule_already_pending", "该预约已有待确认的改期方案");
  let slotId = input.slotId || "";
  let locationType = input.locationType || "venue";
  let venueId = input.venueId || "";
  if (slotId) {
    const legacySlot = await database.prepare("SELECT id, venue_id, starts_at, status FROM availability_slots WHERE id = ? AND coach_id = ?").bind(slotId, identity.coachId).first<Row>();
    if (!legacySlot || legacySlot.status !== "open" || Number(legacySlot.starts_at) <= now) throw new ApiError(409, "reschedule_slot_unavailable", "改期时段已不可用");
    venueId = String(legacySlot.venue_id);
  } else {
    if (!input.startsAt || input.startsAt <= now) throw new ApiError(422, "invalid_proposal_time", "请选择未来的训练时间");
    if (locationType === "venue") {
      const venue = await database.prepare("SELECT id FROM venues WHERE id = ? AND coach_id = ? AND active = 1").bind(venueId, identity.coachId).first<Row>();
      if (!venue) throw new ApiError(422, "venue_not_found", "请选择有效的训练场馆");
    } else {
      if (!input.customDistrict?.trim() || !input.customAddress?.trim()) throw new ApiError(422, "custom_location_required", "请填写新的区域和详细地点");
      venueId = `venue_coordination_${identity.coachId}`;
      await database.prepare(`INSERT OR IGNORE INTO venues (id, coach_id, name, address, city, district, active, created_at, updated_at)
        VALUES (?, ?, '协商训练地点', '仅预约双方可见', '北京', ?, 0, ?, ?)`)
        .bind(venueId, identity.coachId, input.customDistrict.trim().slice(0, 40), now, now).run();
    }
    slotId = randomId("proposal_slot");
    const endsAt = input.startsAt + Number(booking.duration_minutes) * 60_000;
    await database.prepare(`INSERT INTO availability_slots (id, coach_id, venue_id, starts_at, ends_at, status, source, owner_booking_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'held', 'coach_proposal', ?, ?, ?)`
    ).bind(slotId, identity.coachId, venueId, input.startsAt, endsAt, input.bookingId, now, now).run();
  }
  const id = randomId("reschedule");
  const result = await database.batch([
    database.prepare("UPDATE booking_requests SET status = 'reschedule_requested', updated_at = ? WHERE id = ? AND status = ?").bind(now, input.bookingId, booking.status),
    database.prepare("UPDATE availability_slots SET status = 'held', updated_at = ? WHERE id = ? AND status IN ('open','held')").bind(now, slotId),
    database.prepare(`INSERT INTO booking_reschedule_proposals (id, booking_id, proposed_slot_id, proposed_by, previous_booking_status, status, note, location_type, custom_district, custom_address, custom_note, created_at, updated_at)
      VALUES (?, ?, ?, 'coach', ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, input.bookingId, slotId, booking.status, input.note.trim().slice(0, 500), locationType,
      locationType === "custom" ? input.customDistrict?.trim().slice(0, 40) : null,
      locationType === "custom" ? input.customAddress?.trim().slice(0, 240) : null,
      locationType === "custom" ? input.customLocationNote?.trim().slice(0, 300) || null : null, now, now),
    database.prepare("INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, target_mode, deep_link, created_at) VALUES (?, ?, 'booking_status', '教练提出改期方案', '请查看新时段并确认或拒绝', 'booking', ?, 'student', 'zhuguang://student/bookings', ?)").bind(randomId("notification"), booking.user_id, input.bookingId, now),
  ]);
  if (!result[0].meta.changes || !result[1].meta.changes) throw new ApiError(409, "reschedule_concurrent_change", "预约或时段已变化，请刷新后重试");
  return { id, status: "pending" as const };
}

export async function listStudentRescheduleProposalsD1(identity: StudentIdentity, env: ApiEnv) {
  const result = await db(env).prepare(`
    SELECT p.id, p.booking_id, p.proposed_slot_id, p.status, p.note, p.created_at,
      s.starts_at, s.ends_at, v.name AS venue_name, v.address AS venue_address,
      p.location_type, p.custom_district, p.custom_address, p.custom_note
    FROM booking_reschedule_proposals p
    JOIN booking_requests b ON b.id = p.booking_id
    JOIN availability_slots s ON s.id = p.proposed_slot_id
    JOIN venues v ON v.id = s.venue_id
    WHERE b.user_id = ? ORDER BY p.created_at DESC LIMIT 100
  `).bind(identity.userId).all<Row>();
  return rows(result);
}

export async function respondStudentRescheduleProposalD1(identity: StudentIdentity, id: string, decision: "accepted" | "rejected", env: ApiEnv) {
  const database = db(env); const now = Date.now();
  const proposal = await database.prepare(`
    SELECT p.*, b.user_id, b.slot_id AS original_slot_id FROM booking_reschedule_proposals p
    JOIN booking_requests b ON b.id = p.booking_id
    WHERE p.id = ? AND b.user_id = ? AND p.status = 'pending' AND b.status = 'reschedule_requested'
  `).bind(id, identity.userId).first<Row>();
  if (!proposal) throw new ApiError(409, "reschedule_not_pending", "该改期方案已处理或不存在");
  if (decision === "accepted") {
    const proposedSlot = await database.prepare("SELECT coach_id, starts_at, ends_at, venue_id FROM availability_slots WHERE id = ? AND status = 'held'").bind(proposal.proposed_slot_id).first<Row>();
    if (!proposedSlot || Number(proposedSlot.starts_at) <= now) throw new ApiError(409, "reschedule_slot_unavailable", "该方案时间已失效，请让教练重新提出方案");
    const conflict = await database.prepare(`SELECT b.id FROM booking_requests b JOIN availability_slots s ON s.id = b.slot_id
      WHERE b.coach_id = ? AND b.id <> ? AND b.status = 'confirmed' AND s.starts_at < ? AND s.ends_at > ? LIMIT 1`
    ).bind(proposedSlot.coach_id, proposal.booking_id, proposedSlot.ends_at, proposedSlot.starts_at).first<Row>();
    if (conflict) throw new ApiError(409, "coach_time_conflict", "教练在该时间已有确认课程，请重新协商");
  }
  const statements = [database.prepare("UPDATE booking_reschedule_proposals SET status = ?, responded_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(decision, now, now, id)];
  if (decision === "accepted") {
    statements.push(
      database.prepare("UPDATE availability_slots SET status = CASE WHEN source = 'coach_open' THEN 'open' ELSE 'expired' END, updated_at = ? WHERE id = ?").bind(now, proposal.original_slot_id),
      database.prepare("UPDATE availability_slots SET status = 'booked', updated_at = ? WHERE id = ? AND status = 'held'").bind(now, proposal.proposed_slot_id),
      database.prepare("UPDATE booking_requests SET slot_id = ?, venue_id = (SELECT venue_id FROM availability_slots WHERE id = ?), status = 'confirmed', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'reschedule_requested'").bind(proposal.proposed_slot_id, proposal.proposed_slot_id, now, proposal.booking_id, identity.userId),
      database.prepare(`UPDATE booking_request_details SET requested_starts_at = (SELECT starts_at FROM availability_slots WHERE id = ?),
        requested_ends_at = (SELECT ends_at FROM availability_slots WHERE id = ?), location_type = ?,
        requested_venue_id = CASE WHEN ? = 'venue' THEN (SELECT venue_id FROM availability_slots WHERE id = ?) ELSE NULL END,
        custom_district = ?, custom_address = ?, custom_note = ?, updated_at = ? WHERE booking_id = ?`
      ).bind(proposal.proposed_slot_id, proposal.proposed_slot_id, proposal.location_type, proposal.location_type,
        proposal.proposed_slot_id, proposal.custom_district, proposal.custom_address, proposal.custom_note, now, proposal.booking_id),
    );
  } else {
    statements.push(
      database.prepare("UPDATE availability_slots SET status = CASE WHEN source = 'coach_open' THEN 'open' ELSE 'expired' END, updated_at = ? WHERE id = ? AND status = 'held'").bind(now, proposal.proposed_slot_id),
      database.prepare("UPDATE booking_requests SET status = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'reschedule_requested'").bind(proposal.previous_booking_status, now, proposal.booking_id, identity.userId),
    );
  }
  statements.push(database.prepare("INSERT INTO booking_events (id, booking_id, actor_type, actor_id, from_status, to_status, detail_json, created_at) VALUES (?, ?, 'student', ?, 'reschedule_requested', ?, ?, ?)").bind(randomId("event"), proposal.booking_id, identity.userId, decision === "accepted" ? "confirmed" : proposal.previous_booking_status, JSON.stringify({ decision, proposalId: id }), now));
  await database.batch(statements);
  return { id, status: decision };
}

export async function markNotificationReadD1(identity: StudentIdentity, id: string, env: ApiEnv) {
  const result = await db(env).prepare("UPDATE notifications SET read_at = coalesce(read_at, ?) WHERE id = ? AND user_id = ?").bind(Date.now(), id, identity.userId).run();
  if (!result.meta.changes) throw new ApiError(404, "notification_not_found", "未找到该通知");
  return { id, read: true };
}
