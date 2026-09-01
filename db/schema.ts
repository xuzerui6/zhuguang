import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  phoneHash: text("phone_hash").unique(),
  phoneEncrypted: text("phone_encrypted"),
  phoneLast4: text("phone_last4"),
  emailHash: text("email_hash").unique(),
  emailEncrypted: text("email_encrypted"),
  emailDomain: text("email_domain"),
  role: text("role", { enum: ["student", "coach", "operator"] }).notNull().default("student"),
  status: text("status", { enum: ["active", "locked", "deleted"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
}, (table) => [index("users_status_idx").on(table.status)]);

export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["student", "coach", "operator"] }).notNull(),
  status: text("status", { enum: ["active", "suspended", "revoked"] }).notNull().default("active"),
  grantedAt: integer("granted_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  primaryKey({ columns: [table.userId, table.role] }),
  index("user_roles_authorization_idx").on(table.userId, table.status, table.role),
]);

export const learnerProfiles = sqliteTable("learner_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relation: text("relation", { enum: ["self", "child"] }).notNull(),
  gender: text("gender", { enum: ["male", "female", "unspecified"] }).notNull().default("unspecified"),
  birthYear: integer("birth_year"),
  sport: text("sport").notNull(),
  level: text("level").notNull(),
  goal: text("goal").notNull(),
  guardianName: text("guardian_name"),
  guardianPhoneEncrypted: text("guardian_phone_encrypted"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("learner_profiles_user_idx").on(table.userId)]);

export const coaches = sqliteTable("coaches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id),
  siwcEmail: text("siwc_email").unique(),
  name: text("name").notNull(),
  sport: text("sport").notNull(),
  city: text("city").notNull().default("北京"),
  district: text("district").notNull(),
  level: text("level").notNull(),
  title: text("title").notNull(),
  bio: text("bio").notNull(),
  priceFen: integer("price_fen").notNull(),
  trialPriceFen: integer("trial_price_fen").notNull().default(9900),
  ratingBasisPoints: integer("rating_basis_points").notNull().default(0),
  lessons: integer("lessons").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  experienceYears: integer("experience_years").notNull().default(0),
  responseMinutes: integer("response_minutes").notNull().default(0),
  audienceJson: text("audience_json").notNull().default("[]"),
  goalsJson: text("goals_json").notNull().default("[]"),
  honorsJson: text("honors_json").notNull().default("[]"),
  credentialsJson: text("credentials_json").notNull().default("[]"),
  strengthsJson: text("strengths_json").notNull().default("[]"),
  motto: text("motto").notNull().default(""),
  availabilitySummaryJson: text("availability_summary_json").notNull().default("[]"),
  profileKind: text("profile_kind", { enum: ["real", "demo"] }).notNull().default("real"),
  listingStatus: text("listing_status", { enum: ["online", "offline"] }).notNull().default("online"),
  listingReason: text("listing_reason").notNull().default(""),
  listingChangedBy: text("listing_changed_by"),
  listingChangedAt: integer("listing_changed_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  pricingStatus: text("pricing_status", { enum: ["published", "unavailable"] }).notNull().default("published"),
  bookingEnabled: integer("booking_enabled", { mode: "boolean" }).notNull().default(true),
  auditStatus: text("audit_status", { enum: ["draft", "pending", "approved", "rejected", "suspended"] }).notNull().default("draft"),
  avatarObjectKey: text("avatar_object_key"),
  cardObjectKey: text("card_object_key"),
  heroObjectKey: text("hero_object_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("coaches_discovery_idx").on(table.city, table.sport, table.auditStatus, table.listingStatus),
  index("coaches_district_idx").on(table.city, table.district),
  index("coaches_listing_idx").on(table.listingStatus, table.profileKind, table.updatedAt),
  uniqueIndex("coaches_user_unique").on(table.userId).where(sql`${table.userId} is not null`),
]);

export const coachStatusEvents = sqliteTable("coach_status_events", {
  id: text("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["audit", "listing"] }).notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull().default(""),
  actor: text("actor").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("coach_status_events_coach_idx").on(table.coachId, table.createdAt),
  index("coach_status_events_type_idx").on(table.eventType, table.createdAt),
]);

export const coachCredentials = sqliteTable("coach_credentials", {
  id: text("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  credentialType: text("credential_type").notNull(),
  label: text("label").notNull(),
  issuer: text("issuer"),
  objectKey: text("object_key").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "expired"] }).notNull().default("pending"),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  reviewedBy: text("reviewed_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("coach_credentials_coach_idx").on(table.coachId, table.status)]);

export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull().default("北京"),
  district: text("district").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("venues_coach_idx").on(table.coachId, table.active)]);

export const availabilitySlots = sqliteTable("availability_slots", {
  id: text("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  venueId: text("venue_id").notNull().references(() => venues.id),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["open", "held", "booked", "blocked", "expired"] }).notNull().default("open"),
  source: text("source", { enum: ["coach_open", "student_request", "coach_proposal", "legacy"] }).notNull().default("coach_open"),
  ownerBookingId: text("owner_booking_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("availability_slots_coach_time_idx").on(table.coachId, table.startsAt, table.endsAt),
  index("availability_slots_query_idx").on(table.coachId, table.status, table.startsAt),
  check("availability_slots_time_check", sql`${table.endsAt} > ${table.startsAt}`),
]);

export const favorites = sqliteTable("favorites", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [primaryKey({ columns: [table.userId, table.coachId] })]);

export const bookingRequests = sqliteTable("booking_requests", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
  learnerProfileId: text("learner_profile_id").notNull().references(() => learnerProfiles.id),
  coachId: integer("coach_id").notNull().references(() => coaches.id),
  venueId: text("venue_id").notNull().references(() => venues.id),
  slotId: text("slot_id").notNull().references(() => availabilitySlots.id),
  status: text("status", {
    enum: ["pending_coach", "confirmed", "reschedule_requested", "completed", "rejected", "expired", "cancelled_by_student", "cancelled_by_coach"],
  }).notNull().default("pending_coach"),
  feeFen: integer("fee_fen").notNull(),
  paymentStatus: text("payment_status", { enum: ["offline_unpaid", "offline_paid"] }).notNull().default("offline_unpaid"),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("booking_requests_user_idempotency_unique").on(table.userId, table.idempotencyKey),
  uniqueIndex("booking_requests_active_slot_unique").on(table.slotId).where(
    sql`${table.status} in ('pending_coach', 'confirmed', 'reschedule_requested')`,
  ),
  index("booking_requests_student_idx").on(table.userId, table.status, table.createdAt),
  index("booking_requests_coach_idx").on(table.coachId, table.status, table.createdAt),
]);

export const bookingEvents = sqliteTable("booking_events", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookingRequests.id, { onDelete: "cascade" }),
  actorType: text("actor_type", { enum: ["student", "coach", "operator", "system"] }).notNull(),
  actorId: text("actor_id"),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("booking_events_booking_idx").on(table.bookingId, table.createdAt)]);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  studentUserId: text("student_user_id").notNull().references(() => users.id),
  coachId: integer("coach_id").references(() => coaches.id),
  kind: text("kind", { enum: ["coach", "system", "venue"] }).notNull(),
  title: text("title").notNull(),
  lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  uniqueIndex("conversations_student_coach_unique").on(table.studentUserId, table.coachId),
  index("conversations_student_idx").on(table.studentUserId, table.lastMessageAt),
]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderType: text("sender_type", { enum: ["student", "coach", "system", "venue"] }).notNull(),
  senderId: text("sender_id"),
  body: text("body").notNull(),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("messages_conversation_idx").on(table.conversationId, table.createdAt),
  index("messages_unread_idx").on(table.conversationId, table.senderType, table.readAt, table.createdAt),
]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  targetMode: text("target_mode", { enum: ["student", "coach"] }).notNull().default("student"),
  deepLink: text("deep_link"),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("notifications_user_idx").on(table.userId, table.readAt, table.createdAt)]);

export const appInstallations = sqliteTable("app_installations", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  platform: text("platform", { enum: ["android", "ios"] }).notNull().default("android"),
  appVersionCode: integer("app_version_code").notNull(),
  appVersionName: text("app_version_name").notNull(),
  pushProvider: text("push_provider").notNull().default("jpush"),
  pushRegistrationId: text("push_registration_id"),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["active", "unbound", "revoked"] }).notNull().default("active"),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("app_installations_user_idx").on(table.userId, table.status),
  index("app_installations_push_idx").on(table.pushProvider, table.pushRegistrationId, table.pushEnabled),
]);

export const appReleases = sqliteTable("app_releases", {
  versionCode: integer("version_code").primaryKey(),
  versionName: text("version_name").notNull().unique(),
  minimumSupportedVersionCode: integer("minimum_supported_version_code").notNull(),
  forced: integer("forced", { mode: "boolean" }).notNull().default(false),
  rolloutPercentage: integer("rollout_percentage").notNull().default(100),
  notesJson: text("notes_json").notNull().default("[]"),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  certificateSha256: text("certificate_sha256").notNull(),
  packageId: text("package_id").notNull().default("com.zhuguang.coachos"),
  objectKey: text("object_key").notNull(),
  status: text("status", { enum: ["draft", "published", "paused"] }).notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("app_releases_latest_idx").on(table.status, table.versionCode),
  check("app_releases_rollout_check", sql`${table.rolloutPercentage} between 0 and 100`),
]);

export const appUpdateEvents = sqliteTable("app_update_events", {
  id: text("id").primaryKey(),
  installationId: text("installation_id").notNull().references(() => appInstallations.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  versionCode: integer("version_code").notNull(),
  eventType: text("event_type", { enum: ["discovered", "deferred", "download_started", "download_verified", "install_launched", "installed", "failed"] }).notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("app_update_events_installation_idx").on(table.installationId, table.createdAt)]);

export const publicDownloadEvents = sqliteTable("public_download_events", {
  id: text("id").primaryKey(),
  versionCode: integer("version_code").notNull(),
  ipHash: text("ip_hash").notNull(),
  deviceHash: text("device_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("public_download_events_ip_idx").on(table.ipHash, table.createdAt),
  index("public_download_events_device_idx").on(table.deviceHash, table.createdAt),
]);

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  bookingEnabled: integer("booking_enabled", { mode: "boolean" }).notNull().default(true),
  messageEnabled: integer("message_enabled", { mode: "boolean" }).notNull().default(true),
  updateEnabled: integer("update_enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
});

export const bookingRequestDetails = sqliteTable("booking_request_details", {
  bookingId: text("booking_id").primaryKey().references(() => bookingRequests.id, { onDelete: "cascade" }),
  requestedStartsAt: integer("requested_starts_at", { mode: "timestamp_ms" }).notNull(),
  requestedEndsAt: integer("requested_ends_at", { mode: "timestamp_ms" }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  locationType: text("location_type", { enum: ["venue", "custom"] }).notNull(),
  requestedVenueId: text("requested_venue_id").references(() => venues.id),
  customDistrict: text("custom_district"),
  customAddress: text("custom_address"),
  customNote: text("custom_note"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("booking_request_details_expiry_idx").on(table.expiresAt)]);

export const pushDeliveries = sqliteTable("push_deliveries", {
  id: text("id").primaryKey(),
  notificationId: text("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  installationId: text("installation_id").notNull().references(() => appInstallations.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("jpush"),
  status: text("status", { enum: ["pending", "sent", "failed", "dead"] }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  providerMessageId: text("provider_message_id"),
  lastError: text("last_error"),
  nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  uniqueIndex("push_deliveries_notification_installation_unique").on(table.notificationId, table.installationId),
  index("push_deliveries_retry_idx").on(table.status, table.nextAttemptAt),
]);

export const authChallenges = sqliteTable("auth_challenges", {
  id: text("id").primaryKey(),
  phoneHash: text("phone_hash").notNull(),
  phoneEncrypted: text("phone_encrypted").notNull(),
  phoneLast4: text("phone_last4").notNull(),
  codeHash: text("code_hash").notNull(),
  ipHash: text("ip_hash").notNull(),
  deviceHash: text("device_hash").notNull().default(""),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  resendAfter: integer("resend_after", { mode: "timestamp_ms" }).notNull(),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("auth_challenges_phone_idx").on(table.phoneHash, table.createdAt),
  index("auth_challenges_ip_idx").on(table.ipHash, table.createdAt),
  index("auth_challenges_device_idx").on(table.deviceHash, table.createdAt),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  authMethod: text("auth_method", { enum: ["phone_otp", "email_otp"] }).notNull().default("phone_otp"),
  accessTokenHash: text("access_token_hash").notNull().unique(),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  accessExpiresAt: integer("access_expires_at", { mode: "timestamp_ms" }).notNull(),
  refreshExpiresAt: integer("refresh_expires_at", { mode: "timestamp_ms" }).notNull(),
  rotatedFromId: text("rotated_from_id"),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("sessions_user_device_idx").on(table.userId, table.deviceId, table.revokedAt)]);

export const emailAuthChallenges = sqliteTable("email_auth_challenges", {
  id: text("id").primaryKey(),
  emailHash: text("email_hash").notNull(),
  emailEncrypted: text("email_encrypted").notNull(),
  emailDomain: text("email_domain").notNull(),
  codeHash: text("code_hash").notNull(),
  ipHash: text("ip_hash").notNull(),
  deviceHash: text("device_hash").notNull().default(""),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  resendAfter: integer("resend_after", { mode: "timestamp_ms" }).notNull(),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("email_auth_challenges_email_idx").on(table.emailHash, table.createdAt),
  index("email_auth_challenges_ip_idx").on(table.ipHash, table.createdAt),
  index("email_auth_challenges_device_idx").on(table.deviceHash, table.createdAt),
]);

export const serviceLeads = sqliteTable("service_leads", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  coachId: integer("coach_id").references(() => coaches.id, { onDelete: "set null" }),
  leadKind: text("lead_kind", { enum: ["student_inquiry", "coach_partnership"] }),
  contactName: text("contact_name").notNull(),
  contactEmailEncrypted: text("contact_email_encrypted"),
  contactPhoneEncrypted: text("contact_phone_encrypted"),
  contactWechatEncrypted: text("contact_wechat_encrypted"),
  learnerStage: text("learner_stage", { enum: ["幼儿", "小学低年级", "小学高年级", "初中", "高中", "成人"] }),
  desiredTime: text("desired_time"),
  sport: text("sport").notNull(),
  district: text("district").notNull(),
  goal: text("goal").notNull(),
  source: text("source").notNull().default("web"),
  status: text("status", { enum: ["new", "contacted", "qualified", "closed"] }).notNull().default("new"),
  assignedTo: text("assigned_to"),
  note: text("note").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("service_leads_queue_idx").on(table.status, table.createdAt),
  index("service_leads_coach_idx").on(table.coachId, table.status),
]);

export const trainingRecords = sqliteTable("training_records", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookingRequests.id, { onDelete: "cascade" }).unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").notNull().references(() => coaches.id),
  summary: text("summary").notNull(),
  metricsJson: text("metrics_json").notNull().default("{}"),
  coachNotes: text("coach_notes").notNull().default(""),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("training_records_student_idx").on(table.userId, table.createdAt),
  index("training_records_coach_idx").on(table.coachId, table.createdAt),
]);

export const credentialChangeRequests = sqliteTable("credential_change_requests", {
  id: text("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  currentValueJson: text("current_value_json").notNull().default("null"),
  proposedValueJson: text("proposed_value_json").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "cancelled"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("credential_change_requests_queue_idx").on(table.status, table.createdAt)]);

export const coachProfileVersions = sqliteTable("coach_profile_versions", {
  id: text("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  requestId: text("request_id").references(() => credentialChangeRequests.id, { onDelete: "set null" }),
  field: text("field").notNull(),
  previousValueJson: text("previous_value_json").notNull(),
  nextValueJson: text("next_value_json").notNull(),
  approvedBy: text("approved_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("coach_profile_versions_coach_idx").on(table.coachId, table.createdAt)]);

export const bookingRescheduleProposals = sqliteTable("booking_reschedule_proposals", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookingRequests.id, { onDelete: "cascade" }),
  proposedSlotId: text("proposed_slot_id").notNull().references(() => availabilitySlots.id),
  proposedBy: text("proposed_by", { enum: ["student", "coach"] }).notNull(),
  previousBookingStatus: text("previous_booking_status", { enum: ["pending_coach", "confirmed"] }).notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected", "cancelled"] }).notNull().default("pending"),
  note: text("note").notNull().default(""),
  locationType: text("location_type", { enum: ["venue", "custom"] }).notNull().default("venue"),
  customDistrict: text("custom_district"),
  customAddress: text("custom_address"),
  customNote: text("custom_note"),
  respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("booking_reschedule_queue_idx").on(table.bookingId, table.status, table.createdAt)]);

export const coachReviews = sqliteTable("coach_reviews", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookingRequests.id, { onDelete: "cascade" }).unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  helpfulCount: integer("helpful_count").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  resubmissionCount: integer("resubmission_count").notNull().default(0),
  status: text("status", { enum: ["pending", "approved", "rejected", "withdrawn"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("coach_reviews_public_idx").on(table.coachId, table.status, table.createdAt),
  check("coach_reviews_rating_check", sql`${table.rating} between 1 and 5`),
]);

export const coachReviewVersions = sqliteTable("coach_review_versions", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => coachReviews.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  submissionType: text("submission_type", { enum: ["initial", "resubmission"] }).notNull(),
  actorUserId: text("actor_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  uniqueIndex("coach_review_versions_revision_unique").on(table.reviewId, table.revision),
  index("coach_review_versions_review_idx").on(table.reviewId, table.revision),
  check("coach_review_versions_rating_check", sql`${table.rating} between 1 and 5`),
]);

export const coachReviewReplies = sqliteTable("coach_review_replies", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => coachReviews.id, { onDelete: "cascade" }).unique(),
  coachId: integer("coach_id").notNull().references(() => coaches.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "withdrawn"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("coach_review_replies_queue_idx").on(table.status, table.createdAt)]);

export const coachReviewReactions = sqliteTable("coach_review_reactions", {
  reviewId: text("review_id").notNull().references(() => coachReviews.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["helpful", "report"] }).notNull(),
  reason: text("reason").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  primaryKey({ columns: [table.reviewId, table.userId, table.kind] }),
  index("coach_review_reactions_review_idx").on(table.reviewId, table.kind, table.createdAt),
]);

export const productEvents = sqliteTable("product_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  surface: text("surface").notNull(),
  role: text("role").notNull(),
  flow: text("flow").notNull(),
  step: text("step").notNull(),
  outcome: text("outcome").notNull(),
  errorCode: text("error_code"),
  appVersion: text("app_version").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("product_events_funnel_idx").on(table.flow, table.step, table.outcome, table.createdAt),
  index("product_events_created_idx").on(table.createdAt),
]);

export const supportTickets = sqliteTable("support_tickets", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").references(() => bookingRequests.id, { onDelete: "set null" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  createdByRole: text("created_by_role", { enum: ["student", "coach"] }).notNull(),
  category: text("category", { enum: ["service", "booking", "payment", "safety", "privacy", "other"] }).notNull(),
  priority: text("priority", { enum: ["normal", "high", "urgent"] }).notNull().default("normal"),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["open", "in_progress", "waiting_user", "resolved", "closed"] }).notNull().default("open"),
  assignedTo: text("assigned_to"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
}, (table) => [index("support_tickets_queue_idx").on(table.status, table.priority, table.updatedAt)]);

export const supportTicketMessages = sqliteTable("support_ticket_messages", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderType: text("sender_type", { enum: ["student", "coach", "operator", "system"] }).notNull(),
  senderId: text("sender_id"),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("support_ticket_messages_ticket_idx").on(table.ticketId, table.createdAt)]);

export const contentDocuments = sqliteTable("content_documents", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  audience: text("audience", { enum: ["public", "student", "coach"] }).notNull().default("public"),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  activeVersionId: text("active_version_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("content_documents_status_idx").on(table.status, table.updatedAt)]);

export const contentVersions = sqliteTable("content_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => contentDocuments.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  createdBy: text("created_by"),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  uniqueIndex("content_versions_document_version_unique").on(table.documentId, table.version),
  index("content_versions_document_idx").on(table.documentId, table.createdAt),
]);

export const emailDeliveries = sqliteTable("email_deliveries", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").references(() => emailAuthChallenges.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  recipientHash: text("recipient_hash").notNull(),
  template: text("template").notNull(),
  status: text("status", { enum: ["pending", "sent", "failed", "dead"] }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  providerMessageId: text("provider_message_id"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [
  index("email_deliveries_status_idx").on(table.status, table.createdAt),
  index("email_deliveries_recipient_idx").on(table.recipientHash, table.createdAt),
]);

export const opsAuditLogs = sqliteTable("ops_audit_logs", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detailJson: text("detail_json").notNull().default("{}"),
  requestId: text("request_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
}, (table) => [index("ops_audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt)]);
