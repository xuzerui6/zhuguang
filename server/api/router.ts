import { canTransitionBooking } from "../../app/mobile/domain";
import { LEGAL_DOCUMENTS } from '../../shared/legal-documents';
import { readOperatorApplicationMediaD1 } from "./multicity";
import type { BookingStatus, LearnerProfile } from "../../app/mobile/types";
import {
  AUDIENCE_OPTIONS,
  BEIJING_DISTRICTS,
  matchesAudience,
  matchesTrainingGoal,
  normalizeAudience,
  normalizeDistrict,
  normalizeSport,
  normalizeTrainingGoal,
  SPORT_OPTIONS,
  TRAINING_GOAL_OPTIONS,
} from "../../shared/coach-catalog";
import { ApiError, failure, readJson, requireString, success, type ApiEnv, type ApiExecutionContext } from "./contracts";
import {
  authenticateLocal,
  getLocalCoachData,
  localBootstrap,
  localCancelBooking,
  localCoachOverview,
  localCoachTransition,
  localCreateBooking,
  localSendMessage,
  localSetFavorite,
  logoutLocal,
  refreshLocalSession,
  requestLocalOtp,
  verifyLocalOtp,
} from "./local-store";
import {
  authenticateCoach,
  authenticateStudent,
  bootstrapD1,
  cancelBookingD1,
  coachOverviewD1,
  coachTransitionBookingD1,
  createBookingD1,
  createTimeRequestBookingD1,
  createCoachSlotD1,
  createConversationD1,
  deleteAccountAvatarD1,
  deleteAccountD1,
  deleteCoachSlotD1,
  getCoachD1,
  getCoachBookingOptionsD1,
  getAccountProfileD1,
  getMobileIdentityD1,
  listCoachesD1,
  listNotificationsD1,
  listSlotsD1,
  logoutD1,
  markCoachConversationReadD1,
  markStudentConversationReadD1,
  markOfflinePaidD1,
  refreshSessionD1,
  logoutRefreshD1,
  requestOtpD1,
  requestAccountContactChallengeD1,
  readAccountAvatarD1,
  sendCoachBookingStatusSms,
  sendCoachMessageD1,
  sendStudentBookingStatusSms,
  sendStudentMessageD1,
  setFavoriteD1,
  assertAccountProfileCompleteD1,
  upsertLearnerD1,
  updateCoachBookingAvailabilityD1,
  updateAccountProfileD1,
  uploadAccountAvatarD1,
  verifyOtpD1,
  verifyAccountContactChallengeD1,
} from "./repository";
import {
  assertOperator,
  createDownloadTicketD1,
  createPublicDownloadTicketD1,
  downloadReleaseD1,
  latestReleaseD1,
  latestPublicReleaseD1,
  listReleasesD1,
  recordUpdateEventD1,
  registerInstallationD1,
  saveNotificationPreferencesD1,
  uploadReleaseArtifactD1,
} from "./releases";
import { dispatchPushDeliveriesD1, sendOperatorTestPushD1 } from "./push";
import { executeReleaseOperation, type ReleaseCommand } from "./release-operations";
import { assertPilotApp, normalizePhone, randomId, verifyTurnstile } from "./security";
import { requestEmailOtpD1, verifyEmailOtpD1 } from "./email-auth";
import { exchangeWechatCodeD1, requestWechatLinkEmailD1, verifyWechatLinkEmailD1 } from "./wechat-auth";
import {
  getCoachApplicationD1,
  getServicePreferenceD1,
  listMulticityCatalogD1,
  listMyCoachApplicationsD1,
  listOperatorCoachApplicationsD1,
  reviewCoachApplicationD1,
  saveCoachApplicationDraftD1,
  saveServicePreferenceD1,
  submitCoachApplicationD1,
  uploadCoachApplicationMediaD1,
  withdrawCoachApplicationD1,
  type CoachApplicationInput,
} from "./multicity";
import {
  classifyMetricEntityD1,
  confirmTestPaymentD1,
  createCompletionRequestD1,
  createRefundRequestD1,
  createTestPaymentOrderD1,
  downloadSupportEvidenceD1,
  getPlatformCapabilities,
  getPublicTrustMetricsD1,
  listOperatorCatalogD1,
  listOperatorTransactionsD1,
  respondCompletionRequestD1,
  updateOperatorCatalogItemD1,
  uploadSupportEvidenceD1,
} from "./expansion";
import {
  createCoachReviewD1,
  createCoachReviewReplyD1,
  createOpsCoachVenueD1,
  createCoachRescheduleProposalD1,
  createCredentialChangeRequestD1,
  createSupportTicketD1,
  createServiceLeadD1,
  createTrainingRecordD1,
  exportOpsLeadsMaskedD1,
  batchUpdateOpsCoachListingD1,
  getOpsOverviewD1,
  getOpsSystemHealthD1,
  getOpsProductFunnelD1,
  getOpsCoachBusinessSettingsD1,
  listCoachProfileChangesD1,
  listCoachReviewsD1,
  listContentDocumentsD1,
  listOpsAuditLogsD1,
  listOpsBookingsD1,
  listOpsCoachesD1,
  listOpsCoachStatusEventsD1,
  listOpsLeadsD1,
  listOpsProfileChangesD1,
  listOpsReviewsD1,
  listOpsSupportTicketsD1,
  listOpsUsersD1,
  listAccountMergeRequestsD1,
  listPublicCoachReviewsD1,
  listStudentTrainingRecordsD1,
  listStudentRescheduleProposalsD1,
  listUserSupportTicketsD1,
  markNotificationReadD1,
  moderateReviewD1,
  moderateReviewReplyD1,
  publishContentDocumentD1,
  reactToCoachReviewD1,
  revealOpsLeadContactD1,
  recordProductEventsD1,
  resubmitCoachReviewD1,
  resolveReviewReportD1,
  resetOpsUserProfileD1,
  reviewAccountMergeRequestD1,
  reviewCoachProfileChangeD1,
  respondStudentRescheduleProposalD1,
  saveContentDocumentD1,
  updateOpsCoachStatusD1,
  updateOpsCoachBusinessSettingsD1,
  updateOpsCoachListingD1,
  updateOpsCoachVenueD1,
  updateOpsLeadD1,
  updateOpsSupportTicketD1,
  withdrawCoachProfileChangeD1,
} from "./operations";

const bookingStatuses = new Set<BookingStatus>([
  "cancelled_by_coach",
  "cancelled_by_student",
  "completed",
  "confirmed",
  "pending_coach",
  "rejected",
  "expired",
  "reschedule_requested",
]);

export async function handleApiRequest(request: Request, env: ApiEnv, ctx: ApiExecutionContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/")) return null;
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || randomId("request");
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), request, env, requestId);

  try {
    const publicCoachMedia = /^\/api\/v1\/media\/coaches\/\d+\/(avatar|card|hero)$/u.test(url.pathname);
    const publicAccountAvatar = /^\/api\/v1\/account-avatar\/[^/]+$/u.test(url.pathname);
    const publicCoachReviews = request.method === "GET" && /^\/api\/v1\/coaches\/\d+\/reviews$/u.test(url.pathname);
    const publicRelease = (request.method === 'GET' && url.pathname === '/api/v1/public/legal-documents') || url.pathname === "/api/v1/public/app/releases/latest"
      || /^\/api\/v1\/public\/app\/releases\/\d+\/download-ticket$/u.test(url.pathname);
    if (url.pathname !== "/api/v1/health" && url.pathname !== "/api/v1/app/releases/download" && !publicCoachMedia && !publicAccountAvatar && !publicCoachReviews && !publicRelease) assertPilotApp(request, env);
    const response = await route(request, url, env, ctx, requestId);
    return withCors(response, request, env, requestId);
  } catch (error) {
    return withCors(failure(error, requestId), request, env, requestId);
  }
}

function matchesIfNoneMatch(headerValue: string | null, objectEtag: string) {
  if (!headerValue) return false;
  const expected = normalizeEtag(objectEtag);
  return headerValue.split(",").some((candidate) => {
    const value = candidate.trim();
    return value === "*" || normalizeEtag(value) === expected;
  });
}

function normalizeEtag(value: string) {
  return value.trim().replace(/^W\/\s*/iu, "").replace(/^"|"$/gu, "");
}

async function route(request: Request, url: URL, env: ApiEnv, ctx: ApiExecutionContext, requestId: string) {
  const path = url.pathname;
  const local = !env.DB && env.APP_ENV !== "production";
  const deviceId = request.headers.get("x-device-id")?.slice(0, 160) || "unknown-device";

  if (request.method === 'GET' && path === '/api/v1/public/legal-documents') {
    if (!env.DB) return success(LEGAL_DOCUMENTS, requestId);
    const published = await env.DB.prepare(`SELECT d.slug, d.title, v.id, v.body, v.published_at
      FROM content_documents d JOIN content_versions v ON v.id = d.active_version_id AND v.document_id = d.id
      WHERE d.slug IN ('privacy', 'terms') AND d.status = 'published' AND d.audience = 'public' AND v.published_at IS NOT NULL`).all<{ slug: string; title: string; id: string; body: string; published_at: number }>();
    return success(LEGAL_DOCUMENTS.map(baseline => {
      const current = published.results?.find(item => item.slug === baseline.slug);
      return current ? { slug: baseline.slug, title: current.title, body: current.body, version: current.id, updatedAt: current.published_at } : baseline;
    }), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/health") {
    return success({
      database: Boolean(env.DB),
      environment: env.APP_ENV ?? "local",
      media: Boolean(env.MEDIA),
      ok: true,
      releases: Boolean(env.RELEASES),
    }, requestId);
  }

  if (request.method === "GET" && path === "/api/v1/capabilities") {
    return success(getPlatformCapabilities(env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/catalog") {
    return success(await listMulticityCatalogD1(url.searchParams.get("city"), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/public/trust-metrics") {
    return success(await getPublicTrustMetricsD1(env), requestId);
  }

  const accountAvatarMatch = path.match(/^\/api\/v1\/account-avatar\/([^/]+)$/u);
  if (request.method === "GET" && accountAvatarMatch) {
    return readAccountAvatarD1(
      decodeURIComponent(accountAvatarMatch[1]),
      Number(url.searchParams.get("expires") ?? 0),
      url.searchParams.get("token") ?? "",
      env,
    );
  }

  if (request.method === "GET" && path === "/api/v1/public/app/releases/latest") {
    if (local) throw new ApiError(404, "public_release_not_available", "Android 安装包正在准备中");
    return success(await latestPublicReleaseD1(env), requestId);
  }

  const publicReleaseTicketMatch = path.match(/^\/api\/v1\/public\/app\/releases\/(\d+)\/download-ticket$/u);
  if (request.method === "POST" && publicReleaseTicketMatch) {
    if (local) throw new ApiError(404, "release_artifact_missing", "Android 安装包正在准备中");
    const body = await readJson<{ downloadId?: unknown }>(request);
    return success(await createPublicDownloadTicketD1(
      request,
      Number(publicReleaseTicketMatch[1]),
      requireString(body.downloadId, "downloadId", 160),
      env,
    ), requestId, undefined, 201);
  }

  const publicCoachMediaMatch = path.match(/^\/api\/v1\/media\/coaches\/(\d+)\/(avatar|card|hero)$/u);
  if (request.method === "GET" && publicCoachMediaMatch) {
    if (!env.DB || !env.MEDIA) throw new ApiError(503, "media_unavailable", "教练图片服务暂时不可用");
    const coachId = Number(publicCoachMediaMatch[1]);
    const column = publicCoachMediaMatch[2] === "avatar"
      ? "avatar_object_key"
      : publicCoachMediaMatch[2] === "card"
        ? "card_object_key"
        : "hero_object_key";
    const coach = await env.DB.prepare(`SELECT ${column} AS object_key FROM coaches WHERE id = ? AND profile_kind = 'real' AND audit_status = 'approved' AND listing_status = 'online'`).bind(coachId).first<{ object_key: string | null }>();
    if (!coach?.object_key) throw new ApiError(404, "coach_media_not_found", "未找到该教练图片");
    const object = await env.MEDIA.get(coach.object_key);
    if (!object) throw new ApiError(404, "coach_media_not_found", "未找到该教练图片");
    if (matchesIfNoneMatch(request.headers.get("if-none-match"), object.httpEtag)) {
      return new Response(null, { headers: { etag: object.httpEtag }, status: 304 });
    }
    const headers = new Headers({
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      etag: object.httpEtag,
      "x-content-type-options": "nosniff",
    });
    object.writeHttpMetadata(headers);
    if (!headers.get("content-type")?.startsWith("image/")) headers.set("content-type", "image/webp");
    return new Response(object.body, { headers });
  }

  if (request.method === "GET" && path === "/api/v1/app/releases/latest") {
    const currentVersionCode = Number(request.headers.get("x-app-version-code") ?? 0);
    if (local) {
      return success({
        certificateSha256: "E1:5C:DA:AB:AC:CF:B2:1E:52:1A:02:AD:14:70:AF:8D:07:9F:6D:81:6A:15:0F:11:33:92:C0:B3:C4:1E:57:9A",
        forced: false,
        minimumSupportedVersionCode: 3,
        notes: ["新增统一教练工作台", "预约提醒更及时", "优化启动速度与离线体验"],
        packageId: "com.zhuguang.coachos",
        publishedAt: Date.now(),
        sha256: "local-preview",
        sizeBytes: 4_420_000,
        versionCode: 4,
        versionName: "1.1.1",
      }, requestId);
    }
    return success(await latestReleaseD1(deviceId, currentVersionCode, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/app/releases/download") {
    return downloadReleaseD1(url, env);
  }

  const releaseTicketMatch = path.match(/^\/api\/v1\/app\/releases\/(\d+)\/download-ticket$/u);
  if (request.method === "POST" && releaseTicketMatch) {
    if (local) throw new ApiError(404, "release_artifact_missing", "本地设计验收未配置更新安装包");
    return success(await createDownloadTicketD1(request, Number(releaseTicketMatch[1]), deviceId, env), requestId, undefined, 201);
  }

  if (request.method === "PUT" && path === "/api/v1/app/installations") {
    const body = await readJson<{ installationId?: unknown; platform?: unknown; pushRegistrationId?: unknown; versionCode?: unknown; versionName?: unknown }>(request);
    const requestPlatform = request.headers.get("x-app-platform");
    const platform: "android" | "ios" = body.platform === "ios" || requestPlatform === "ios" ? "ios" : "android";
    const input = {
      installationId: requireString(body.installationId, "installationId", 180),
      platform,
      pushRegistrationId: typeof body.pushRegistrationId === "string" ? body.pushRegistrationId.slice(0, 300) : undefined,
      versionCode: positiveInteger(body.versionCode, "versionCode"),
      versionName: requireString(body.versionName, "versionName", 40),
    };
    if (local) return success({ installationId: input.installationId }, requestId);
    const identity = await authenticateStudent(request, env, false);
    return success(await registerInstallationD1(identity, input, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/app/update-events") {
    const body = await readJson<{ detail?: Record<string, unknown>; eventType?: unknown; installationId?: unknown; versionCode?: unknown }>(request);
    if (local) return success(undefined, requestId, undefined, 202);
    const identity = await authenticateStudent(request, env, false);
    await recordUpdateEventD1(identity, {
      detail: body.detail,
      eventType: requireString(body.eventType, "eventType", 40),
      installationId: requireString(body.installationId, "installationId", 180),
      versionCode: positiveInteger(body.versionCode, "versionCode"),
    }, env);
    return success(undefined, requestId, undefined, 202);
  }

  if (request.method === "PUT" && path === "/api/v1/notification-preferences") {
    const body = await readJson<{ booking?: unknown; message?: unknown; update?: unknown }>(request);
    const input = { booking: body.booking !== false, message: body.message !== false, update: body.update !== false };
    if (local) return success(input, requestId);
    return success(await saveNotificationPreferencesD1((await authenticateStudent(request, env))!, input, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/overview") {
    assertOperator(request, env);
    return success(await getOpsOverviewD1(env, url.searchParams.get('classification')), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/system-health") {
    assertOperator(request, env);
    return success(await getOpsSystemHealthD1(env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/catalog") {
    assertOperator(request, env);
    return success(await listOperatorCatalogD1(env), requestId);
  }

  const operatorCatalogMatch = path.match(/^\/api\/v1\/operator\/catalog\/(regions|sports)\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorCatalogMatch) {
    assertOperator(request, env);
    const body = await readJson<{ reason?: unknown; status?: unknown }>(request);
    return success(await updateOperatorCatalogItemD1(
      operatorCatalogMatch[1] === "regions" ? "region" : "sport",
      decodeURIComponent(operatorCatalogMatch[2]),
      requireString(body.status, "status", 30) as "configured" | "published" | "disabled",
      requireString(body.reason, "reason", 500), operatorActor(request), requestId, env,
    ), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/transactions") {
    assertOperator(request, env);
    return success(await listOperatorTransactionsD1(env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/operator/trust-metrics/classifications") {
    assertOperator(request, env);
    const body = await readJson<{ classification?: unknown; entityId?: unknown; entityType?: unknown; reason?: unknown; expectedEventId?: unknown }>(request);
    const expectedEventId = body.expectedEventId === undefined ? undefined : body.expectedEventId === null ? null : requireString(body.expectedEventId, 'expectedEventId', 180);
    return success(await classifyMetricEntityD1(
      requireString(body.entityType, "entityType", 30), requireString(body.entityId, "entityId", 180),
      requireString(body.classification, "classification", 30), requireString(body.reason, "reason", 500),
      operatorActor(request), requestId, env, expectedEventId,
    ), requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/operator/analytics/funnel") {
    await assertOperator(request, env);
    return success(await getOpsProductFunnelD1(env, url.searchParams.get('classification')), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/operator/push/test") {
    assertOperator(request, env);
    const body = await readJson<{ installationId?: unknown; type?: unknown }>(request);
    const type = requireString(body.type, "type", 20);
    if (type !== "booking" && type !== "message" && type !== "update") {
      throw new ApiError(422, "validation_failed", "推送类型必须为 booking、message 或 update");
    }
    return success(await sendOperatorTestPushD1(
      requireString(body.installationId, "installationId", 180),
      type,
      operatorActor(request),
      requestId,
      env,
    ), requestId, undefined, 202);
  }

  if (request.method === "GET" && path === "/api/v1/operator/leads") {
    assertOperator(request, env);
    return success(await listOpsLeadsD1(env, url.searchParams.get('classification'), url.searchParams.get('view')), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/leads/export") {
    assertOperator(request, env);
    return success(await exportOpsLeadsMaskedD1(operatorActor(request), requestId, env, url.searchParams.get('classification'), url.searchParams.get('view')), requestId);
  }

  const operatorLeadContactMatch = path.match(/^\/api\/v1\/operator\/service-leads\/([^/]+)\/contact-reveal$/u);
  if (request.method === "POST" && operatorLeadContactMatch) {
    assertOperator(request, env);
    return success(await revealOpsLeadContactD1(
      decodeURIComponent(operatorLeadContactMatch[1]), operatorActor(request), requestId, env,
    ), requestId);
  }

  const operatorLeadMatch = path.match(/^\/api\/v1\/operator\/leads\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorLeadMatch) {
    assertOperator(request, env);
    const body = await readJson<{ assignedTo?: unknown; followUpDueAt?: unknown; note?: unknown; status?: unknown }>(request);
    return success(await updateOpsLeadD1(decodeURIComponent(operatorLeadMatch[1]), {
      assignedTo: typeof body.assignedTo === "string" ? body.assignedTo.slice(0, 100) : undefined,
      followUpDueAt: body.followUpDueAt == null ? undefined : Number(body.followUpDueAt),
      note: typeof body.note === "string" ? body.note.slice(0, 1000) : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
    }, operatorActor(request), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/bookings") {
    assertOperator(request, env);
    return success(await listOpsBookingsD1(env, url.searchParams.get('classification')), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/coach-applications") {
    assertOperator(request, env);
    return success(await listOperatorCoachApplicationsD1(url.searchParams.get("status"), env), requestId);
  }

  const operatorCoachApplicationMatch = path.match(/^\/api\/v1\/operator\/coach-applications\/([^/]+)$/u);
  const operatorApplicationMediaMatch=path.match(/^\/api\/v1\/operator\/coach-applications\/([^/]+)\/media\/(avatar|hero|credential)$/u);
  if(request.method==="GET"&&operatorApplicationMediaMatch){assertOperator(request,env);const index=Number(url.searchParams.get("index")||0);if(!Number.isInteger(index)||index<0||index>11)throw new ApiError(422,"invalid_media_index","资料序号无效");return readOperatorApplicationMediaD1(decodeURIComponent(operatorApplicationMediaMatch[1]),operatorApplicationMediaMatch[2] as "avatar"|"hero"|"credential",index,operatorActor(request),requestId,env);}
  if (request.method === "PATCH" && operatorCoachApplicationMatch) {
    assertOperator(request, env);
    const body = await readJson<{ decision?: unknown; note?: unknown }>(request);
    const decision = requireString(body.decision, "decision", 20);
    if (decision !== "approved" && decision !== "rejected") throw new ApiError(422, "invalid_review_decision", "请选择通过或拒绝");
    return success(await reviewCoachApplicationD1(
      decodeURIComponent(operatorCoachApplicationMatch[1]),
      decision,
      requireString(body.note, "note", 500),
      operatorActor(request),
      requestId,
      env,
    ), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/coaches") {
    assertOperator(request, env);
    return success(await listOpsCoachesD1(env), requestId);
  }

  const operatorCoachStatusMatch = path.match(/^\/api\/v1\/operator\/coaches\/(\d+)\/status$/u);
  if (request.method === "PATCH" && operatorCoachStatusMatch) {
    assertOperator(request, env);
    const body = await readJson<{ status?: unknown }>(request);
    return success(await updateOpsCoachStatusD1(Number(operatorCoachStatusMatch[1]), requireString(body.status, "status", 30), operatorActor(request), env), requestId);
  }

  const operatorCoachListingMatch = path.match(/^\/api\/v1\/operator\/coaches\/(\d+)\/listing$/u);
  if (request.method === "PATCH" && operatorCoachListingMatch) {
    assertOperator(request, env);
    const body = await readJson<{ reason?: unknown; status?: unknown }>(request);
    return success(await updateOpsCoachListingD1(
      Number(operatorCoachListingMatch[1]),
      requireString(body.status, "status", 30),
      requireString(body.reason, "reason", 300),
      operatorActor(request),
      env,
    ), requestId);
  }

  if (request.method === "PATCH" && path === "/api/v1/operator/coaches/listing/batch") {
    assertOperator(request, env);
    const body = await readJson<{ ids?: unknown; reason?: unknown; status?: unknown }>(request);
    const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
    return success(await batchUpdateOpsCoachListingD1(
      ids,
      requireString(body.status, "status", 30),
      requireString(body.reason, "reason", 300),
      operatorActor(request),
      env,
    ), requestId);
  }

  const operatorCoachEventsMatch = path.match(/^\/api\/v1\/operator\/coaches\/(\d+)\/events$/u);
  if (request.method === "GET" && operatorCoachEventsMatch) {
    assertOperator(request, env);
    return success(await listOpsCoachStatusEventsD1(Number(operatorCoachEventsMatch[1]), env), requestId);
  }

  const operatorCoachBusinessMatch = path.match(/^\/api\/v1\/operator\/coaches\/(\d+)\/business-settings$/u);
  if (request.method === "GET" && operatorCoachBusinessMatch) {
    assertOperator(request, env);
    return success(await getOpsCoachBusinessSettingsD1(Number(operatorCoachBusinessMatch[1]), env), requestId);
  }
  if (request.method === "PATCH" && operatorCoachBusinessMatch) {
    assertOperator(request, env);
    const body = await readJson<{ bookingEnabled?: unknown; district?: unknown; priceFen?: unknown; pricingStatus?: unknown; reason?: unknown; trialPriceFen?: unknown }>(request);
    return success(await updateOpsCoachBusinessSettingsD1(Number(operatorCoachBusinessMatch[1]), {
      bookingEnabled: typeof body.bookingEnabled === "boolean" ? body.bookingEnabled : undefined,
      district: typeof body.district === "string" ? body.district : undefined,
      priceFen: body.priceFen == null ? undefined : Number(body.priceFen),
      pricingStatus: typeof body.pricingStatus === "string" ? body.pricingStatus : undefined,
      reason: requireString(body.reason, "reason", 300),
      trialPriceFen: body.trialPriceFen == null ? undefined : Number(body.trialPriceFen),
    }, operatorActor(request), requestId, env), requestId);
  }

  const operatorCoachVenuesMatch = path.match(/^\/api\/v1\/operator\/coaches\/(\d+)\/venues$/u);
  if (request.method === "POST" && operatorCoachVenuesMatch) {
    assertOperator(request, env);
    const body = await readJson<{ address?: unknown; cityId?: unknown; district?: unknown; name?: unknown; reason?: unknown }>(request);
    return success(await createOpsCoachVenueD1(Number(operatorCoachVenuesMatch[1]), {
      cityId: typeof body.cityId === "string" ? body.cityId : undefined,
      address: requireString(body.address, "address", 240),
      district: requireString(body.district, "district", 40),
      name: requireString(body.name, "name", 120),
      reason: requireString(body.reason, "reason", 300),
    }, operatorActor(request), requestId, env), requestId, undefined, 201);
  }

  const operatorCoachVenueMatch = path.match(/^\/api\/v1\/operator\/coaches\/(\d+)\/venues\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorCoachVenueMatch) {
    assertOperator(request, env);
    const body = await readJson<{ active?: unknown; address?: unknown; district?: unknown; name?: unknown; reason?: unknown }>(request);
    return success(await updateOpsCoachVenueD1(Number(operatorCoachVenueMatch[1]), decodeURIComponent(operatorCoachVenueMatch[2]), {
      active: typeof body.active === "boolean" ? body.active : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
      district: typeof body.district === "string" ? body.district : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      reason: requireString(body.reason, "reason", 300),
    }, operatorActor(request), requestId, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/users") {
    assertOperator(request, env);
    return success(await listOpsUsersD1(env, url.searchParams.get('classification')), requestId);
  }

  const operatorUserProfileMatch = path.match(/^\/api\/v1\/operator\/users\/([^/]+)\/profile$/u);
  if (request.method === "PATCH" && operatorUserProfileMatch) {
    assertOperator(request, env);
    const body = await readJson<{ action?: unknown; reason?: unknown }>(request);
    const action = requireString(body.action, "action", 30);
    if (action !== "reset_avatar" && action !== "reset_nickname") throw new ApiError(422, "invalid_profile_action", "资料处置操作无效");
    return success(await resetOpsUserProfileD1(decodeURIComponent(operatorUserProfileMatch[1]), action, requireString(body.reason, "reason", 300), operatorActor(request), requestId, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/account-merge-requests") {
    assertOperator(request, env);
    return success(await listAccountMergeRequestsD1(env), requestId);
  }

  const operatorMergeMatch = path.match(/^\/api\/v1\/operator\/account-merge-requests\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorMergeMatch) {
    assertOperator(request, env);
    const body = await readJson<{ decision?: unknown; note?: unknown; primaryUserId?: unknown }>(request);
    const decision = requireString(body.decision, "decision", 20);
    if (decision !== "approved" && decision !== "rejected") throw new ApiError(422, "invalid_merge_decision", "工单处理结果无效");
    return success(await reviewAccountMergeRequestD1(decodeURIComponent(operatorMergeMatch[1]), {
      decision,
      note: requireString(body.note, "note", 1000),
      primaryUserId: typeof body.primaryUserId === "string" ? body.primaryUserId : undefined,
    }, operatorActor(request), requestId, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/profile-change-requests") {
    assertOperator(request, env);
    return success(await listOpsProfileChangesD1(env), requestId);
  }

  const operatorProfileChangeMatch = path.match(/^\/api\/v1\/operator\/profile-change-requests\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorProfileChangeMatch) {
    assertOperator(request, env);
    const body = await readJson<{ decision?: unknown; note?: unknown }>(request);
    const decision = requireString(body.decision, "decision", 20);
    if (decision !== "approved" && decision !== "rejected") throw new ApiError(422, "invalid_review_decision", "审核结果无效");
    return success(await reviewCoachProfileChangeD1(
      decodeURIComponent(operatorProfileChangeMatch[1]),
      decision,
      requireString(body.note, "note", 1000),
      operatorActor(request),
      env,
    ), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/reviews") {
    assertOperator(request, env);
    return success(await listOpsReviewsD1(env), requestId);
  }

  const operatorReviewMatch = path.match(/^\/api\/v1\/operator\/reviews\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorReviewMatch) {
    assertOperator(request, env);
    const body = await readJson<{ note?: unknown; status?: unknown }>(request);
    const status = requireString(body.status, "status", 20);
    if (status !== "approved" && status !== "rejected") throw new ApiError(422, "invalid_review_status", "评价审核状态无效");
    return success(await moderateReviewD1(decodeURIComponent(operatorReviewMatch[1]), status, typeof body.note === "string" ? body.note : "", operatorActor(request), env), requestId);
  }

  const operatorReviewReplyMatch = path.match(/^\/api\/v1\/operator\/review-replies\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorReviewReplyMatch) {
    await assertOperator(request, env);
    const body = await readJson<{ note?: unknown; status?: unknown }>(request);
    const status = requireString(body.status, "status", 20);
    if (status !== "approved" && status !== "rejected") throw new ApiError(422, "invalid_review_status", "审核状态无效");
    return success(await moderateReviewReplyD1(decodeURIComponent(operatorReviewReplyMatch[1]), status, requireString(body.note, "note", 500), operatorActor(request), env), requestId);
  }

  const operatorReviewReportMatch = path.match(/^\/api\/v1\/operator\/reviews\/([^/]+)\/report$/u);
  if (request.method === "PATCH" && operatorReviewReportMatch) {
    assertOperator(request, env);
    const body = await readJson<{ decision?: unknown; note?: unknown }>(request);
    const decision = requireString(body.decision, "decision", 20);
    if (decision !== "keep" && decision !== "hide") throw new ApiError(422, "invalid_report_decision", "举报处理结果无效");
    return success(await resolveReviewReportD1(decodeURIComponent(operatorReviewReportMatch[1]), decision, requireString(body.note, "note", 500), operatorActor(request), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/support-tickets") {
    assertOperator(request, env);
    return success(await listOpsSupportTicketsD1(env), requestId);
  }

  const operatorTicketMatch = path.match(/^\/api\/v1\/operator\/support-tickets\/([^/]+)$/u);
  if (request.method === "PATCH" && operatorTicketMatch) {
    assertOperator(request, env);
    const body = await readJson<{ body?: unknown; status?: unknown }>(request);
    return success(await updateOpsSupportTicketD1(decodeURIComponent(operatorTicketMatch[1]), {
      body: typeof body.body === "string" ? body.body : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
    }, operatorActor(request), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/audit-logs") {
    assertOperator(request, env);
    return success(await listOpsAuditLogsD1(env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/operator/content") {
    assertOperator(request, env);
    return success(await listContentDocumentsD1(env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/operator/content") {
    assertOperator(request, env);
    const body = await readJson<{ audience?: unknown; body?: unknown; slug?: unknown; title?: unknown }>(request);
    return success(await saveContentDocumentD1({
      audience: requireString(body.audience, "audience", 30),
      body: requireString(body.body, "body", 20_000),
      slug: requireString(body.slug, "slug", 100),
      title: requireString(body.title, "title", 120),
    }, operatorActor(request), env), requestId, undefined, 201);
  }

  const operatorContentPublishMatch = path.match(/^\/api\/v1\/operator\/content\/([^/]+)\/publish$/u);
  if (request.method === "POST" && operatorContentPublishMatch) {
    assertOperator(request, env);
    const body = await readJson<{ versionId?: unknown }>(request);
    return success(await publishContentDocumentD1(
      decodeURIComponent(operatorContentPublishMatch[1]),
      requireString(body.versionId, "versionId", 180),
      operatorActor(request),
      env,
    ), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/operator/releases") {
    assertOperator(request, env);
    const body = await readJson<ReleaseCommand>(request);
    return success(await executeReleaseOperation(request, "create", 0, body, requestId, env), requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/operator/releases") {
    assertOperator(request, env);
    return success(await listReleasesD1(env), requestId);
  }

  const operatorReleaseArtifactMatch = path.match(/^\/api\/v1\/operator\/releases\/(\d+)\/artifact$/u);
  if (request.method === "PUT" && operatorReleaseArtifactMatch) {
    assertOperator(request, env);
    return success(await uploadReleaseArtifactD1(request, Number(operatorReleaseArtifactMatch[1]), env), requestId, undefined, 201);
  }

  const operatorReleasePolicyMatch = path.match(/^\/api\/v1\/operator\/releases\/(\d+)\/policy$/u);
  if (request.method === "PATCH" && operatorReleasePolicyMatch) {
    assertOperator(request, env);
    const body = await readJson<ReleaseCommand>(request);
    return success(await executeReleaseOperation(request, "policy", Number(operatorReleasePolicyMatch[1]), body, requestId, env), requestId);
  }

  const operatorReleaseStatusMatch = path.match(/^\/api\/v1\/operator\/releases\/(\d+)\/(publish|pause)$/u);
  if (request.method === "POST" && operatorReleaseStatusMatch) {
    assertOperator(request, env);
    const body = await readJson<ReleaseCommand>(request);
    return success(await executeReleaseOperation(request, operatorReleaseStatusMatch[2] as "publish" | "pause", Number(operatorReleaseStatusMatch[1]), body, requestId, env), requestId);
  }

  const operatorReleaseNotifyMatch = path.match(/^\/api\/v1\/operator\/releases\/(\d+)\/notify$/u);
  if (request.method === "POST" && operatorReleaseNotifyMatch) {
    assertOperator(request, env);
    const body = await readJson<ReleaseCommand>(request);
    const queued = await executeReleaseOperation(request, "notify", Number(operatorReleaseNotifyMatch[1]), body, requestId, env);
    ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(queued, requestId, undefined, 202);
  }

  if (request.method === "GET" && path === "/api/v1/bootstrap") {
    return success(local ? localBootstrap(request) : await bootstrapD1(request, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/coaches") {
    const filters = normalizeCoachSearchParams(url.searchParams);
    const coaches = local ? filterLocalCoaches(filters) : await listCoachesD1(env, filters);
    return success(coaches, requestId, {
      appliedFilters: Object.fromEntries(filters.entries()),
      availableOptions: {
        audiences: AUDIENCE_OPTIONS,
        districts: BEIJING_DISTRICTS,
        goals: TRAINING_GOAL_OPTIONS,
        sports: SPORT_OPTIONS,
      },
      count: coaches.length,
    });
  }

  if (request.method === "POST" && (path === "/api/v1/service-leads" || path === "/api/v1/partnership-leads" || path === "/api/v1/privacy-requests")) {
    const body = await readJson<{ coachId?: unknown; serviceCityId?: unknown; contactEmail?: unknown; contactName?: unknown; contactPhone?: unknown; contactWechat?: unknown; desiredTime?: unknown; district?: unknown; goal?: unknown; learnerStage?: unknown; request?: unknown; sport?: unknown; turnstileToken?: unknown }>(request);
    if (local) return success({ id: randomId("lead"), status: "new" }, requestId, undefined, 201);
    await verifyTurnstile(request, body.turnstileToken, env);
    const identity = local ? null : await authenticateStudent(request, env, false);
    return success(await createServiceLeadD1({
      coachId: body.coachId == null ? undefined : positiveInteger(body.coachId, "coachId"),
      serviceCityId: typeof body.serviceCityId === "string" ? body.serviceCityId : undefined,
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail.slice(0, 254) : undefined,
      contactName: requireString(body.contactName, "contactName", 40),
      contactPhone: typeof body.contactPhone === "string" ? body.contactPhone.slice(0, 30) : undefined,
      contactWechat: typeof body.contactWechat === "string" ? body.contactWechat.slice(0, 64) : undefined,
      desiredTime: typeof body.desiredTime === "string" ? body.desiredTime.slice(0, 160) : undefined,
      district: path === "/api/v1/privacy-requests" ? "北京" : requireString(body.district, "district", 40),
      goal: path === "/api/v1/privacy-requests" ? requireString(body.request, "request", 1000) : requireString(body.goal, "goal", 160),
      leadKind: path === "/api/v1/privacy-requests" ? "privacy_request" : path === "/api/v1/partnership-leads" ? "coach_partnership" : "student_inquiry",
      learnerStage: typeof body.learnerStage === "string" ? body.learnerStage : undefined,
      source: request.headers.get("x-app-platform") === "weapp"
        ? "weapp"
        : request.headers.get("x-app-platform") === "android"
          ? "android"
          : request.headers.get("x-app-platform") === "ios"
            ? "ios"
            : "web",
      sport: path === "/api/v1/privacy-requests" ? "隐私请求" : requireString(body.sport, "sport", 40),
      userId: identity?.userId,
    }, env), requestId, undefined, 201);
  }

  const coachSlotsMatch = path.match(/^\/api\/v1\/coaches\/(\d+)\/slots$/u);
  if (request.method === "GET" && coachSlotsMatch) {
    const coachId = Number(coachSlotsMatch[1]);
    const slots = local ? getLocalCoachData().slots(coachId).filter((slot) => slot.available) : await listSlotsD1(coachId, env);
    return success(slots, requestId, { timezone: "Asia/Shanghai" });
  }

  const coachReviewsMatch = path.match(/^\/api\/v1\/coaches\/(\d+)\/reviews$/u);
  if (request.method === "GET" && coachReviewsMatch) {
    const sort = url.searchParams.get("sort") === "helpful" ? "helpful" : "recent";
    return success(local ? { items: [], nextCursor: null, summary: { averageRating: null, ratingDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, tagCounts: [], total: 0 } } : await listPublicCoachReviewsD1(Number(coachReviewsMatch[1]), { cursor: url.searchParams.get("cursor") || undefined, sort }, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/telemetry/events") {
    const body = await readJson<{ events?: unknown }>(request);
    if (!Array.isArray(body.events)) throw new ApiError(422, "invalid_event_batch", "匿名事件格式无效");
    const events = body.events.map((event) => {
      const item = event && typeof event === "object" ? event as Record<string, unknown> : {};
      return {
        appVersion: typeof item.appVersion === "string" ? item.appVersion : "",
        errorCode: typeof item.errorCode === "string" ? item.errorCode : undefined,
        flow: requireString(item.flow, "flow", 60),
        outcome: requireString(item.outcome, "outcome", 30),
        role: requireString(item.role, "role", 30),
        sessionId: requireString(item.sessionId, "sessionId", 80),
        step: requireString(item.step, "step", 60),
        surface: requireString(item.surface, "surface", 30),
      };
    });
    if (local) return success({ accepted: events.length }, requestId, undefined, 202);
    return success(await recordProductEventsD1(events, env), requestId, undefined, 202);
  }

  const coachMatch = path.match(/^\/api\/v1\/coaches\/(\d+)$/u);
  if (request.method === "GET" && coachMatch) {
    const coachId = Number(coachMatch[1]);
    const coach = local ? getLocalCoachData().coaches.find((item) => item.id === coachId) : await getCoachD1(coachId, env);
    if (!coach) throw new ApiError(404, "coach_not_found", "未找到该教练");
    return success(coach, requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/otp/request") {
    const body = await readJson<{ phone?: unknown }>(request);
    const phone = normalizePhone(body.phone);
    return success(local ? requestLocalOtp(phone) : await requestOtpD1(request, phone, env), requestId, undefined, 201);
  }

  if (request.method === "POST" && path === "/api/v1/auth/wechat/exchange") {
    if (local) throw new ApiError(503, "wechat_not_configured", "本地预览未配置微信登录");
    const body = await readJson<{ code?: unknown }>(request);
    return success(await exchangeWechatCodeD1(request, { code: body.code }, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/wechat/link/email/send") {
    if (local) throw new ApiError(503, "wechat_not_configured", "本地预览未配置微信登录");
    const body = await readJson<{ email?: unknown; linkToken?: unknown }>(request);
    return success(await requestWechatLinkEmailD1(request, { email: body.email, linkToken: body.linkToken }, env), requestId, undefined, 201);
  }

  if (request.method === "POST" && path === "/api/v1/auth/wechat/link/email/verify") {
    if (local) throw new ApiError(503, "wechat_not_configured", "本地预览未配置微信登录");
    const body = await readJson<{ challengeId?: unknown; code?: unknown; favoriteCoachIds?: unknown; linkToken?: unknown }>(request);
    return success(await verifyWechatLinkEmailD1(request, {
      challengeId: body.challengeId,
      code: body.code,
      favoriteCoachIds: body.favoriteCoachIds,
      linkToken: body.linkToken,
    }, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/email/request") {
    const body = await readJson<{ email?: unknown; turnstileToken?: unknown }>(request);
    if (local) {
      return success(requestLocalOtp("13800138000"), requestId, undefined, 201);
    }
    return success(await requestEmailOtpD1(request, { email: body.email, turnstileToken: body.turnstileToken }, env), requestId, undefined, 201);
  }

  if (request.method === "POST" && path === "/api/v1/auth/email/verify") {
    const body = await readJson<{ challengeId?: unknown; code?: unknown; favoriteCoachIds?: unknown }>(request);
    const challengeId = requireString(body.challengeId, "challengeId", 180);
    const code = requireString(body.code, "code", 6);
    if (!/^\d{6}$/u.test(code)) throw new ApiError(422, "invalid_otp", "请输入 6 位验证码", { code: "验证码格式不正确" });
    const favoriteCoachIds = Array.isArray(body.favoriteCoachIds) ? body.favoriteCoachIds.filter((id): id is number => Number.isInteger(id)) : [];
    if (local) {
      if (code !== "888888") throw new ApiError(400, "invalid_otp", "验证码不正确");
      const localSession = verifyLocalOtp(challengeId, code, deviceId, favoriteCoachIds);
      return success({ ...localSession, authMethod: "email_otp", contactMasked: "lo***@example.com", phoneMasked: "lo***@example.com" }, requestId);
    }
    return success(await verifyEmailOtpD1(challengeId, code, deviceId, favoriteCoachIds, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/otp/verify") {
    const body = await readJson<{ challengeId?: unknown; code?: unknown; favoriteCoachIds?: unknown }>(request);
    const challengeId = requireString(body.challengeId, "challengeId", 160);
    const code = requireString(body.code, "code", 6);
    if (!/^\d{6}$/u.test(code)) throw new ApiError(422, "invalid_otp", "请输入 6 位验证码", { code: "验证码格式不正确" });
    const favoriteCoachIds = Array.isArray(body.favoriteCoachIds) ? body.favoriteCoachIds.filter((id): id is number => Number.isInteger(id)) : [];
    const session = local
      ? verifyLocalOtp(challengeId, code, deviceId, favoriteCoachIds)
      : await verifyOtpD1(challengeId, code, deviceId, favoriteCoachIds, env);
    return success(session, requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/refresh") {
    const body = await readJson<{ refreshToken?: unknown }>(request);
    const refreshToken = requireString(body.refreshToken, "refreshToken", 256);
    const proxySecret = request.headers.get("x-operator-secret");
    const trusted = Boolean(env.OPERATOR_API_SECRET && proxySecret === env.OPERATOR_API_SECRET);
    const key = request.headers.get("idempotency-key");
    const trustedKey = trusted && key && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(key) ? key : undefined;
    return success(local ? refreshLocalSession(refreshToken, deviceId) : await refreshSessionD1(refreshToken, deviceId, env, trustedKey), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/logout-refresh") {
    const body = await readJson<{ refreshToken?: unknown }>(request);
    if (!local) await logoutRefreshD1(requireString(body.refreshToken, "refreshToken", 256), deviceId, env);
    return success({ loggedOut: true }, requestId);
  }

  if (request.method === "POST" && path === "/api/v1/auth/logout") {
    if (local) logoutLocal(request);
    else {
      const identity = await authenticateStudent(request, env);
      await logoutD1(identity!, env);
    }
    return success({ loggedOut: true }, requestId);
  }

  if (request.method === "GET" && path === "/api/v1/me") {
    if (local) {
      const session = authenticateLocal(request);
      return success({
        availableModes: session.availableModes,
        coach: session.coach,
        phoneMasked: session.phoneMasked,
        userId: session.userId,
      }, requestId);
    }
    const identity = await authenticateStudent(request, env);
    return success(await getMobileIdentityD1(identity!, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/me/service-city") {
    if (local) return success({ cityId: "beijing", source: "manual" }, requestId);
    return success(await getServicePreferenceD1((await authenticateStudent(request, env))!, env), requestId);
  }

  if (request.method === "PATCH" && path === "/api/v1/me/service-city") {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入城市偏好");
    const body = await readJson<{ cityId?: unknown; source?: unknown }>(request);
    return success(await saveServicePreferenceD1(
      (await authenticateStudent(request, env))!,
      requireString(body.cityId, "cityId", 30),
      requireString(body.source, "source", 20),
      env,
    ), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/coach-applications/mine") {
    if (local) return success([], requestId);
    return success(await listMyCoachApplicationsD1((await authenticateStudent(request, env))!, env), requestId);
  }

  if ((request.method === "POST" || request.method === "PATCH") && path === "/api/v1/coach-applications") {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入教练申请");
    const body = await readJson<CoachApplicationInput>(request);
    return success(await saveCoachApplicationDraftD1((await authenticateStudent(request, env))!, body, env), requestId, undefined, request.method === "POST" ? 201 : 200);
  }

  const coachApplicationMatch = path.match(/^\/api\/v1\/coach-applications\/([^/]+)$/u);
  if (request.method === "GET" && coachApplicationMatch) {
    if (local) throw new ApiError(404, "coach_application_not_found", "未找到该教练申请");
    return success(await getCoachApplicationD1((await authenticateStudent(request, env))!, decodeURIComponent(coachApplicationMatch[1]), env), requestId);
  }

  const coachApplicationMediaMatch = path.match(/^\/api\/v1\/coach-applications\/([^/]+)\/media\/(avatar|hero|credential)$/u);
  if (request.method === "PUT" && coachApplicationMediaMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不上传申请资料");
    return success(await uploadCoachApplicationMediaD1(
      (await authenticateStudent(request, env))!,
      decodeURIComponent(coachApplicationMediaMatch[1]),
      coachApplicationMediaMatch[2] as "avatar" | "hero" | "credential",
      request,
      env,
    ), requestId);
  }

  const coachApplicationActionMatch = path.match(/^\/api\/v1\/coach-applications\/([^/]+)\/(submit|withdraw)$/u);
  if (request.method === "POST" && coachApplicationActionMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不修改教练申请");
    const identity = (await authenticateStudent(request, env))!;
    const applicationId = decodeURIComponent(coachApplicationActionMatch[1]);
    return success(coachApplicationActionMatch[2] === "submit"
      ? await submitCoachApplicationD1(identity, applicationId, env)
      : await withdrawCoachApplicationD1(identity, applicationId, env), requestId);
  }


  if (request.method === "GET" && path === "/api/v1/me/profile") {
    if (local) throw new ApiError(501, "local_profile_unavailable", "本地预览未连接账号资料服务");
    return success(await getAccountProfileD1((await authenticateStudent(request, env))!, env), requestId);
  }

  if (request.method === "PATCH" && path === "/api/v1/me/profile") {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入账号资料");
    const identity = (await authenticateStudent(request, env))!;
    const body = await readJson<{ bio?: unknown; district?: unknown; nickname?: unknown; serviceArea?: unknown; serviceCityId?: unknown }>(request);
    return success(await updateAccountProfileD1(identity, body, request, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/me/avatar") {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入头像");
    return success(await uploadAccountAvatarD1((await authenticateStudent(request, env))!, request, env), requestId, undefined, 201);
  }

  if (request.method === "DELETE" && path === "/api/v1/me/avatar") {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入头像");
    return success(await deleteAccountAvatarD1((await authenticateStudent(request, env))!, request, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/me/contact-challenges") {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入联系方式");
    const body = await readJson<{ kind?: unknown; value?: unknown }>(request);
    return success(await requestAccountContactChallengeD1((await authenticateStudent(request, env))!, { kind: body.kind, value: body.value }, request, env), requestId, undefined, 201);
  }

  const contactChallengeMatch = path.match(/^\/api\/v1\/me\/contact-challenges\/([^/]+)\/verify$/u);
  if (request.method === "POST" && contactChallengeMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入联系方式");
    const body = await readJson<{ code?: unknown }>(request);
    const code = requireString(body.code, "code", 6);
    if (!/^\d{6}$/u.test(code)) throw new ApiError(422, "invalid_otp", "请输入 6 位验证码");
    return success(await verifyAccountContactChallengeD1((await authenticateStudent(request, env))!, decodeURIComponent(contactChallengeMatch[1]), code, request, env), requestId);
  }

  if (request.method === "DELETE" && path === "/api/v1/users/me") {
    if (local) {
      logoutLocal(request);
      return success({ deletionEffectiveAt: Date.now(), retainedForDisputesDays: 90 }, requestId);
    }
    return success(await deleteAccountD1((await authenticateStudent(request, env))!, env), requestId, undefined, 202);
  }

  const favoriteMatch = path.match(/^\/api\/v1\/favorites\/(\d+)$/u);
  if (favoriteMatch && (request.method === "PUT" || request.method === "DELETE")) {
    const coachId = Number(favoriteMatch[1]);
    const favorite = request.method === "PUT";
    const data = local
      ? (authenticateLocal(request), localSetFavorite(coachId, favorite))
      : await setFavoriteD1((await authenticateStudent(request, env))!.userId, coachId, favorite, env);
    return success(data, requestId);
  }

  const bookingOptionsMatch = path.match(/^\/api\/v1\/coaches\/(\d+)\/booking-options$/u);
  if (request.method === "GET" && bookingOptionsMatch) {
    if (local) throw new ApiError(501, "local_booking_options_unavailable", "本地预览暂不提供真实预约配置");
    const student = await authenticateStudent(request, env, false);
    return success(await getCoachBookingOptionsD1(Number(bookingOptionsMatch[1]), env, url.searchParams.get("city") ?? "beijing", student?.userId), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/bookings") {
    if (local) authenticateLocal(request);
    else await authenticateStudent(request, env);
    const data = local ? localBootstrap(request).bookings : (await bootstrapD1(request, env)).bookings;
    return success(data, requestId);
  }

  if (request.method === "POST" && path === "/api/v1/bookings") {
    const body = await readJson<{ coachId?: unknown; customAddress?: unknown; customDistrict?: unknown; customLocationNote?: unknown; durationMinutes?: unknown; learnerId?: unknown; locationType?: unknown; note?: unknown; serviceCityId?: unknown; slotId?: unknown; startsAt?: unknown; venueId?: unknown }>(request);
    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 160) || requestId;
    const coachId = positiveInteger(body.coachId, "coachId");
    const learnerId = requireString(body.learnerId, "learnerId", 160);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    const bookingIdentity = local ? null : (await authenticateStudent(request, env))!;
    if (bookingIdentity) await assertAccountProfileCompleteD1(bookingIdentity.userId, env);
    let booking;
    if (body.startsAt !== undefined || body.durationMinutes !== undefined || body.locationType !== undefined) {
      if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入时间申请");
      const locationType = requireString(body.locationType, "locationType", 20);
      if (locationType !== "venue" && locationType !== "custom") throw new ApiError(422, "invalid_location_type", "请选择训练地点方式");
      booking = await createTimeRequestBookingD1(bookingIdentity!, {
        coachId,
        fulfillmentV2: request.headers.get("x-booking-flow") === "2",
        customAddress: typeof body.customAddress === "string" ? body.customAddress : undefined,
        customDistrict: typeof body.customDistrict === "string" ? body.customDistrict : undefined,
        customLocationNote: typeof body.customLocationNote === "string" ? body.customLocationNote : undefined,
        durationMinutes: positiveInteger(body.durationMinutes, "durationMinutes"),
        learnerId,
        locationType,
        note,
        serviceCityId: typeof body.serviceCityId === "string" ? body.serviceCityId : undefined,
        startsAt: timestamp(body.startsAt, "startsAt"),
        venueId: typeof body.venueId === "string" ? body.venueId : undefined,
      }, idempotencyKey, env);
    } else {
      const legacyInput = { coachId, learnerId, note, slotId: requireString(body.slotId, "slotId", 200), venueId: requireString(body.venueId, "venueId", 200) };
      booking = local
        ? (authenticateLocal(request), localCreateBooking(legacyInput))
        : await createBookingD1((await authenticateStudent(request, env))!, legacyInput, idempotencyKey, env);
    }
    if (!local) ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(booking, requestId, undefined, 201);
  }

  const cancelMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)\/cancel$/u);
  if (request.method === "POST" && cancelMatch) {
    const bookingId = decodeURIComponent(cancelMatch[1]);
    const booking = local
      ? (authenticateLocal(request), localCancelBooking(bookingId))
      : await cancelBookingD1((await authenticateStudent(request, env))!, bookingId, env);
    if (!local) {
      ctx.waitUntil(sendCoachBookingStatusSms(bookingId, "学员已取消预约，原时段已释放", env));
      ctx.waitUntil(dispatchPushDeliveriesD1(env));
    }
    return success(booking, requestId);
  }

  if (request.method === "GET" && path === "/api/v1/conversations") {
    if (local) authenticateLocal(request);
    else await authenticateStudent(request, env);
    const data = local ? localBootstrap(request).conversations : (await bootstrapD1(request, env)).conversations;
    return success(data, requestId);
  }

  if (request.method === "POST" && path === "/api/v1/conversations") {
    const body = await readJson<{ coachId?: unknown }>(request);
    const coachId = positiveInteger(body.coachId, "coachId");
    if (local) {
      authenticateLocal(request);
      const conversation = localBootstrap(request).conversations.find((item) => item.coachId === coachId);
      if (!conversation) throw new ApiError(404, "conversation_not_found", "本地试点数据中没有该会话");
      return success(conversation, requestId, undefined, 201);
    }
    const identity = (await authenticateStudent(request, env))!;
    await assertAccountProfileCompleteD1(identity.userId, env);
    return success(await createConversationD1(identity, coachId, env), requestId, undefined, 201);
  }

  const messageMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/u);
  if (request.method === "POST" && messageMatch) {
    const body = await readJson<{ body?: unknown }>(request);
    const message = requireString(body.body, "body", 1000);
    const conversationId = decodeURIComponent(messageMatch[1]);
    let conversation;
    if (local) conversation = (authenticateLocal(request), localSendMessage(conversationId, message));
    else {
      const identity = (await authenticateStudent(request, env))!;
      await assertAccountProfileCompleteD1(identity.userId, env);
      conversation = await sendStudentMessageD1(identity, conversationId, message, env);
    }
    if (!local) ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(conversation, requestId, undefined, 201);
  }

  const conversationReadMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)\/read$/u);
  if (request.method === "POST" && conversationReadMatch) {
    if (local) return success({ conversationId: decodeURIComponent(conversationReadMatch[1]), unreadCount: 0 }, requestId);
    return success(await markStudentConversationReadD1((await authenticateStudent(request, env))!, decodeURIComponent(conversationReadMatch[1]), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/notifications") {
    if (local) {
      authenticateLocal(request);
      return success([], requestId);
    }
    return success(await listNotificationsD1((await authenticateStudent(request, env))!, env), requestId);
  }

  const notificationReadMatch = path.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/u);
  if (request.method === "POST" && notificationReadMatch) {
    if (local) return success({ id: decodeURIComponent(notificationReadMatch[1]), read: true }, requestId);
    return success(await markNotificationReadD1((await authenticateStudent(request, env))!, decodeURIComponent(notificationReadMatch[1]), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/training-records") {
    if (local) return success([], requestId);
    return success(await listStudentTrainingRecordsD1((await authenticateStudent(request, env))!, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/reviews") {
    const body = await readJson<{ bookingId?: unknown; body?: unknown; rating?: unknown; tags?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入评价");
    return success(await createCoachReviewD1((await authenticateStudent(request, env))!, {
      bookingId: requireString(body.bookingId, "bookingId", 180),
      body: requireString(body.body, "body", 1000),
      rating: positiveInteger(body.rating, "rating"),
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [],
    }, env), requestId, undefined, 201);
  }

  const reviewResubmitMatch = path.match(/^\/api\/v1\/reviews\/([^/]+)\/resubmit$/u);
  if (request.method === "PATCH" && reviewResubmitMatch) {
    const body = await readJson<{ body?: unknown; rating?: unknown; tags?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入评价");
    return success(await resubmitCoachReviewD1((await authenticateStudent(request, env))!, decodeURIComponent(reviewResubmitMatch[1]), {
      body: requireString(body.body, "body", 1000),
      rating: positiveInteger(body.rating, "rating"),
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : [],
    }, env), requestId);
  }

  const reviewReactionMatch = path.match(/^\/api\/v1\/reviews\/([^/]+)\/(helpful|report)$/u);
  if (request.method === "POST" && reviewReactionMatch) {
    const identity = await authenticateStudent(request, env);
    const body = reviewReactionMatch[2] === "report" ? await readJson<{ reason?: unknown }>(request) : { reason: "" };
    return success(await reactToCoachReviewD1(identity!, decodeURIComponent(reviewReactionMatch[1]), reviewReactionMatch[2] as "helpful" | "report", typeof body.reason === "string" ? body.reason : "", env), requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/support-tickets") {
    if (local) return success([], requestId);
    return success(await listUserSupportTicketsD1((await authenticateStudent(request, env))!, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/reschedule-proposals") {
    if (local) return success([], requestId);
    return success(await listStudentRescheduleProposalsD1((await authenticateStudent(request, env))!, env), requestId);
  }

  const rescheduleResponseMatch = path.match(/^\/api\/v1\/reschedule-proposals\/([^/]+)\/respond$/u);
  if (request.method === "POST" && rescheduleResponseMatch) {
    const body = await readJson<{ decision?: unknown }>(request);
    const decision = requireString(body.decision, "decision", 20);
    if (decision !== "accepted" && decision !== "rejected") throw new ApiError(422, "invalid_reschedule_decision", "改期处理结果无效");
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入改期方案");
    return success(await respondStudentRescheduleProposalD1((await authenticateStudent(request, env))!, decodeURIComponent(rescheduleResponseMatch[1]), decision, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/support-tickets") {
    const body = await readJson<{ bookingId?: unknown; body?: unknown; category?: unknown; subject?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入售后工单");
    return success(await createSupportTicketD1((await authenticateStudent(request, env))!, {
      bookingId: typeof body.bookingId === "string" ? body.bookingId : undefined,
      body: requireString(body.body, "body", 3000),
      category: requireString(body.category, "category", 30),
      subject: requireString(body.subject, "subject", 120),
    }, "student", env), requestId, undefined, 201);
  }

  const completionResponseMatch = path.match(/^\/api\/v1\/booking-completion-requests\/([^/]+)\/respond$/u);
  if (request.method === "POST" && completionResponseMatch) {
    const body = await readJson<{ decision?: unknown; note?: unknown }>(request);
    const decision = requireString(body.decision, "decision", 20);
    if (decision !== "accepted" && decision !== "disputed") throw new ApiError(422, "invalid_completion_decision", "请选择确认完成或提出异议");
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不写入完成确认");
    const key = request.headers.get("idempotency-key") || undefined;
    if (key && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(key)) throw new ApiError(422, "invalid_idempotency_key", "请求标识无效");
    return success(await respondCompletionRequestD1((await authenticateStudent(request, env))!, decodeURIComponent(completionResponseMatch[1]), decision, typeof body.note === "string" ? body.note : "", env, key, requestId), requestId);
  }

  const supportAttachmentMatch = path.match(/^\/api\/v1\/support-tickets\/([^/]+)\/attachments(?:\/([^/]+))?$/u);
  if (request.method === "POST" && supportAttachmentMatch && !supportAttachmentMatch[2]) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不上传售后附件");
    return success(await uploadSupportEvidenceD1((await authenticateStudent(request, env))!, decodeURIComponent(supportAttachmentMatch[1]), request, env), requestId, undefined, 201);
  }
  if (request.method === "GET" && supportAttachmentMatch?.[2]) {
    if (local) throw new ApiError(404, "support_attachment_not_found", "本地演示数据没有售后附件");
    const identity = (await authenticateStudent(request, env))!;
    return downloadSupportEvidenceD1(identity, decodeURIComponent(supportAttachmentMatch[1]), decodeURIComponent(supportAttachmentMatch[2]), identity.userId, requestId, env);
  }

  const paymentOrderMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)\/payment-orders$/u);
  if (request.method === "POST" && paymentOrderMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不创建交易");
    const idempotencyKey = requireString(request.headers.get("idempotency-key"), "idempotency-key", 180);
    return success(await createTestPaymentOrderD1((await authenticateStudent(request, env))!, decodeURIComponent(paymentOrderMatch[1]), idempotencyKey, env), requestId, undefined, 201);
  }

  const paymentConfirmMatch = path.match(/^\/api\/v1\/payment-orders\/([^/]+)\/test-confirm$/u);
  if (request.method === "POST" && paymentConfirmMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不创建交易");
    return success(await confirmTestPaymentD1((await authenticateStudent(request, env))!, decodeURIComponent(paymentConfirmMatch[1]), env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/refund-requests") {
    const body = await readJson<{ amountFen?: unknown; paymentOrderId?: unknown; reason?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不创建退款");
    return success(await createRefundRequestD1((await authenticateStudent(request, env))!, requireString(body.paymentOrderId, "paymentOrderId", 180), Number(body.amountFen), requireString(body.reason, "reason", 500), env), requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/learner-profiles") {
    if (local) authenticateLocal(request);
    else await authenticateStudent(request, env);
    const learners = local ? localBootstrap(request).learnerProfiles : (await bootstrapD1(request, env)).learnerProfiles;
    return success(learners, requestId);
  }

  if ((request.method === "POST" || request.method === "PUT") && path === "/api/v1/learner-profiles") {
    const body = await readJson<Partial<LearnerProfile>>(request);
    const input = validateLearner(body);
    if (local) {
      authenticateLocal(request);
      return success({ ...input, id: input.id || randomId("learner") }, requestId, undefined, request.method === "POST" ? 201 : 200);
    }
    return success(await upsertLearnerD1((await authenticateStudent(request, env))!, input, env), requestId, undefined, request.method === "POST" ? 201 : 200);
  }

  const learnerProfileMatch = path.match(/^\/api\/v1\/learner-profiles\/([^/]+)$/u);
  if (learnerProfileMatch && (request.method === "GET" || request.method === "PATCH")) {
    const profileId = decodeURIComponent(learnerProfileMatch[1]);
    if (local) {
      authenticateLocal(request);
      const profile = localBootstrap(request).learnerProfiles.find((item) => item.id === profileId);
      if (!profile) throw new ApiError(404, "learner_profile_not_found", "未找到该学员档案");
      if (request.method === "GET") return success(profile, requestId);
      const input = validateLearner({ ...profile, ...(await readJson<Partial<LearnerProfile>>(request)), id: profileId });
      return success(input, requestId);
    }
    const identity = (await authenticateStudent(request, env))!;
    const profiles = (await bootstrapD1(request, env)).learnerProfiles;
    const existing = profiles.find((item) => item.id === profileId);
    if (!existing) throw new ApiError(404, "learner_profile_not_found", "未找到该学员档案");
    if (request.method === "GET") return success(existing, requestId);
    const input = validateLearner({ ...existing, ...(await readJson<Partial<LearnerProfile>>(request)), id: profileId });
    return success(await upsertLearnerD1(identity, input, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/coach/overview") {
    const data = local ? localCoachOverview() : await coachOverviewD1(await authenticateCoach(request, env), env);
    return success(data, requestId);
  }

  if (request.method === "PATCH" && path === "/api/v1/coach/availability") {
    const body = await readJson<{ online?: unknown }>(request);
    if (typeof body.online !== "boolean") throw new ApiError(422, "invalid_online_state", "请选择上线或下线状态");
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不修改接单状态");
    return success(await updateCoachBookingAvailabilityD1(await authenticateCoach(request, env), body.online, env), requestId);
  }

  const coachStatusMatch = path.match(/^\/api\/v1\/coach\/bookings\/([^/]+)\/status$/u);
  if (request.method === "POST" && coachStatusMatch) {
    const body = await readJson<{ status?: unknown }>(request);
    const status = requireString(body.status, "status", 40) as BookingStatus;
    if (!bookingStatuses.has(status)) throw new ApiError(422, "invalid_booking_status", "预约状态无效");
    const bookingId = decodeURIComponent(coachStatusMatch[1]);
    if (local) {
      const overview = localCoachOverview();
      const current = overview.bookings.find((booking) => booking.id === bookingId);
      if (!current) throw new ApiError(404, "booking_not_found", "未找到该预约");
      if (!canTransitionBooking(current.status, status)) throw new ApiError(409, "invalid_booking_transition", "不允许从当前状态执行该操作");
      return success(localCoachTransition(bookingId, status), requestId);
    }
    const booking = await coachTransitionBookingD1(await authenticateCoach(request, env), bookingId, status, env);
    ctx.waitUntil(sendStudentBookingStatusSms(bookingId, status, env));
    ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(booking, requestId);
  }

  const coachCompletionMatch = path.match(/^\/api\/v1\/coach\/bookings\/([^/]+)\/completion-request$/u);
  if (request.method === "POST" && coachCompletionMatch) {
    const body = await readJson<{ note?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不写入完成确认");
    return success(await createCompletionRequestD1(await authenticateCoach(request, env), decodeURIComponent(coachCompletionMatch[1]), typeof body.note === "string" ? body.note : "", env), requestId, undefined, 201);
  }

  if (request.method === "POST" && path === "/api/v1/coach/slots") {
    const body = await readJson<{ endsAt?: unknown; startsAt?: unknown; venueId?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览暂不写入排期数据");
    return success(await createCoachSlotD1(await authenticateCoach(request, env), {
      endsAt: timestamp(body.endsAt, "endsAt"),
      startsAt: timestamp(body.startsAt, "startsAt"),
      venueId: requireString(body.venueId, "venueId", 200),
    }, env), requestId, undefined, 201);
  }

  const coachSlotDeleteMatch = path.match(/^\/api\/v1\/coach\/slots\/([^/]+)$/u);
  if (request.method === "DELETE" && coachSlotDeleteMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入排期数据");
    return success(await deleteCoachSlotD1(await authenticateCoach(request, env), decodeURIComponent(coachSlotDeleteMatch[1]), env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/coach/reschedule-proposals") {
    const body = await readJson<{ bookingId?: unknown; customAddress?: unknown; customDistrict?: unknown; customLocationNote?: unknown; locationType?: unknown; note?: unknown; slotId?: unknown; startsAt?: unknown; venueId?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入改期方案");
    const locationType = body.locationType === undefined ? undefined : requireString(body.locationType, "locationType", 20);
    if (locationType !== undefined && locationType !== "venue" && locationType !== "custom") throw new ApiError(422, "invalid_location_type", "请选择训练地点方式");
    return success(await createCoachRescheduleProposalD1(await authenticateCoach(request, env), {
      bookingId: requireString(body.bookingId, "bookingId", 180),
      customAddress: typeof body.customAddress === "string" ? body.customAddress : undefined,
      customDistrict: typeof body.customDistrict === "string" ? body.customDistrict : undefined,
      customLocationNote: typeof body.customLocationNote === "string" ? body.customLocationNote : undefined,
      locationType,
      note: typeof body.note === "string" ? body.note : "",
      slotId: typeof body.slotId === "string" ? body.slotId : undefined,
      startsAt: body.startsAt === undefined ? undefined : timestamp(body.startsAt, "startsAt"),
      venueId: typeof body.venueId === "string" ? body.venueId : undefined,
    }, env), requestId, undefined, 201);
  }

  if (request.method === "POST" && path === "/api/v1/coach/training-records") {
    const body = await readJson<{ bookingId?: unknown; coachNotes?: unknown; metrics?: unknown; summary?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入训练记录");
    return success(await createTrainingRecordD1(await authenticateCoach(request, env), {
      bookingId: requireString(body.bookingId, "bookingId", 180),
      coachNotes: typeof body.coachNotes === "string" ? body.coachNotes.slice(0, 2000) : "",
      metrics: body.metrics,
      summary: requireString(body.summary, "summary", 2000),
    }, env), requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/coach/reviews") {
    if (local) return success([], requestId);
    return success(await listCoachReviewsD1(await authenticateCoach(request, env), env), requestId);
  }

  const coachReviewReplyMatch = path.match(/^\/api\/v1\/coach\/reviews\/([^/]+)\/reply$/u);
  if (request.method === "POST" && coachReviewReplyMatch) {
    const body = await readJson<{ body?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入评价回复");
    return success(await createCoachReviewReplyD1(await authenticateCoach(request, env), decodeURIComponent(coachReviewReplyMatch[1]), requireString(body.body, "body", 500), env), requestId, undefined, 201);
  }

  if (request.method === "POST" && path === "/api/v1/coach/profile-change-requests") {
    const body = await readJson<{ field?: unknown; value?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入资料变更申请");
    return success(await createCredentialChangeRequestD1(await authenticateCoach(request, env), {
      field: requireString(body.field, "field", 60),
      value: body.value,
    }, env), requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/coach/profile-change-requests") {
    if (local) return success([], requestId);
    return success(await listCoachProfileChangesD1(await authenticateCoach(request, env), env), requestId);
  }

  const coachProfileWithdrawMatch = path.match(/^\/api\/v1\/coach\/profile-change-requests\/([^/]+)\/withdraw$/u);
  if (request.method === "POST" && coachProfileWithdrawMatch) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入资料变更申请");
    return success(await withdrawCoachProfileChangeD1(await authenticateCoach(request, env), decodeURIComponent(coachProfileWithdrawMatch[1]), env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/coach/support-tickets") {
    if (local) return success([], requestId);
    const coach = await authenticateCoach(request, env);
    if (!coach.userId) throw new ApiError(401, "authentication_required", "请先登录教练账号");
    return success(await listUserSupportTicketsD1({ userId: coach.userId }, env), requestId);
  }

  if (request.method === "POST" && path === "/api/v1/coach/support-tickets") {
    const body = await readJson<{ bookingId?: unknown; body?: unknown; category?: unknown; subject?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览不写入售后工单");
    const coach = await authenticateCoach(request, env);
    if (!coach.userId) throw new ApiError(401, "authentication_required", "请先登录教练账号");
    return success(await createSupportTicketD1({ userId: coach.userId }, {
      bookingId: typeof body.bookingId === "string" ? body.bookingId : undefined,
      body: requireString(body.body, "body", 3000),
      category: requireString(body.category, "category", 30),
      subject: requireString(body.subject, "subject", 120),
    }, "coach", env), requestId, undefined, 201);
  }

  const coachSupportAttachmentMatch = path.match(/^\/api\/v1\/coach\/support-tickets\/([^/]+)\/attachments(?:\/([^/]+))?$/u);
  if (request.method === "POST" && coachSupportAttachmentMatch && !coachSupportAttachmentMatch[2]) {
    if (local) throw new ApiError(501, "local_write_not_supported", "本地演示数据不上传售后附件");
    const coach = await authenticateCoach(request, env);
    if (!coach.userId) throw new ApiError(401, "authentication_required", "请先登录教练账号");
    return success(await uploadSupportEvidenceD1(coach, decodeURIComponent(coachSupportAttachmentMatch[1]), request, env), requestId, undefined, 201);
  }
  if (request.method === "GET" && coachSupportAttachmentMatch?.[2]) {
    if (local) throw new ApiError(404, "support_attachment_not_found", "本地演示数据没有售后附件");
    const coach = await authenticateCoach(request, env);
    if (!coach.userId) throw new ApiError(401, "authentication_required", "请先登录教练账号");
    return downloadSupportEvidenceD1(coach, decodeURIComponent(coachSupportAttachmentMatch[1]), decodeURIComponent(coachSupportAttachmentMatch[2]), coach.userId, requestId, env);
  }

  const coachMessageMatch = path.match(/^\/api\/v1\/coach\/conversations\/([^/]+)\/messages$/u);
  if (request.method === "POST" && coachMessageMatch) {
    const body = await readJson<{ body?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览暂不写入教练消息");
    const message = await sendCoachMessageD1(
      await authenticateCoach(request, env),
      decodeURIComponent(coachMessageMatch[1]),
      requireString(body.body, "body", 1000),
      env,
    );
    ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(message, requestId, undefined, 201);
  }

  const coachConversationReadMatch = path.match(/^\/api\/v1\/coach\/conversations\/([^/]+)\/read$/u);
  if (request.method === "POST" && coachConversationReadMatch) {
    if (local) return success({ conversationId: decodeURIComponent(coachConversationReadMatch[1]), unreadCount: 0 }, requestId);
    return success(await markCoachConversationReadD1(await authenticateCoach(request, env), decodeURIComponent(coachConversationReadMatch[1]), env), requestId);
  }

  const coachPaymentMatch = path.match(/^\/api\/v1\/coach\/bookings\/([^/]+)\/offline-payment$/u);
  if (request.method === "POST" && coachPaymentMatch) {
    const body = await readJson<{ paid?: unknown }>(request);
    if (typeof body.paid !== "boolean") throw new ApiError(422, "validation_failed", "请确认线下收款状态", { paid: "必须为布尔值" });
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览暂不写入收款数据");
    return success(await markOfflinePaidD1(await authenticateCoach(request, env), decodeURIComponent(coachPaymentMatch[1]), body.paid, env), requestId);
  }

  const credentialMatch = path.match(/^\/api\/v1\/coach\/credentials\/([^/]+)\/file$/u);
  if (request.method === "GET" && credentialMatch) {
    if (local) throw new ApiError(404, "credential_not_found", "本地预览不提供资质原件");
    const coach = await authenticateCoach(request, env);
    const credential = await env.DB!.prepare("SELECT object_key FROM coach_credentials WHERE id = ? AND coach_id = ? AND status = 'approved'").bind(decodeURIComponent(credentialMatch[1]), coach.coachId).first<{ object_key: string }>();
    if (!credential) throw new ApiError(404, "credential_not_found", "未找到该资质文件");
    if (!env.MEDIA) throw new ApiError(503, "storage_unavailable", "资质文件存储暂时不可用");
    const object = await env.MEDIA.get(credential.object_key);
    if (!object) throw new ApiError(404, "credential_file_not_found", "资质文件不存在");
    const headers = new Headers({ "cache-control": "private, no-store", "content-disposition": "inline", "x-content-type-options": "nosniff" });
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
  }

  void ctx;
  throw new ApiError(404, "route_not_found", "接口不存在");
}

function normalizeCoachSearchParams(input: URLSearchParams) {
  const filters = new URLSearchParams();
  const sport = normalizeSport(input.get("sport") ?? "");
  const district = normalizeDistrict(input.get("district") ?? "");
  const goal = normalizeTrainingGoal(input.get("goal") ?? "");
  const audience = normalizeAudience(input.get("audience") ?? "");
  const city = input.get("city");
  if (city === "beijing" || city === "changchun") filters.set("city", city);
  if (sport) filters.set("sport", sport);
  if (district) filters.set("district", district);
  if (goal) filters.set("goal", goal);
  if (audience) filters.set("audience", audience);
  const maxPriceFen = Number(input.get("maxPriceFen"));
  if (Number.isFinite(maxPriceFen) && maxPriceFen > 0) filters.set("maxPriceFen", String(Math.floor(maxPriceFen)));
  return filters;
}

function filterLocalCoaches(filters: URLSearchParams) {
  const { coaches } = getLocalCoachData();
  const sport = filters.get("sport");
  const district = filters.get("district");
  const goal = filters.get("goal");
  const audience = filters.get("audience");
  const maxPriceFen = Number(filters.get("maxPriceFen"));
  return coaches.filter((coach) => coach.profileKind !== "demo" && (!sport || coach.sport === sport)
    && (!district || coach.district === district)
    && (!goal || matchesTrainingGoal([...coach.goals, ...coach.strengths], goal))
    && (!audience || matchesAudience(coach.audience, audience))
    && (!Number.isFinite(maxPriceFen) || maxPriceFen <= 0 || (coach.price != null && coach.price * 100 <= maxPriceFen)));
}

function positiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ApiError(422, "validation_failed", "请检查提交内容", { [field]: "必须为正整数" });
  return parsed;
}

function timestamp(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  if (!Number.isFinite(parsed)) throw new ApiError(422, "validation_failed", "请检查时间", { [field]: "时间格式无效" });
  return parsed;
}

function validateLearner(body: Partial<LearnerProfile>) {
  const relation = body.relation === "self" || body.relation === "child" ? body.relation : null;
  const gender = body.gender && ["male", "female", "unspecified"].includes(body.gender) ? body.gender : null;
  if (!relation || !gender) throw new ApiError(422, "validation_failed", "请完善学员信息");
  return {
    age: typeof body.age === "number" && body.age >= 0 && body.age <= 100 ? body.age : undefined,
    gender,
    goal: requireString(body.goal, "goal", 100),
    id: body.id ? requireString(body.id, "id", 160) : undefined,
    level: requireString(body.level, "level", 80),
    name: requireString(body.name, "name", 40),
    relation,
    sport: requireString(body.sport, "sport", 40),
  };
}

function operatorActor(request: Request) {
  return request.headers.get("x-operator-actor")?.trim().toLowerCase().slice(0, 160) || "operator";
}

function withCors(response: Response, request: Request, env: ApiEnv, requestId: string) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set("access-control-allow-origin", origin);
    headers.append("vary", "origin");
  }
  headers.set("access-control-allow-headers", "authorization, content-type, idempotency-key, x-app-platform, x-app-version, x-app-version-code, x-booking-flow, x-device-id, x-file-name, x-operator-actor, x-operator-secret, x-release-version-name, x-request-id, x-zhuguang-app-key");
  headers.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("access-control-expose-headers", "x-request-id");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-frame-options", "DENY");
  headers.set("x-request-id", requestId);
  return new Response(response.body, { headers, status: response.status, statusText: response.statusText });
}

function isAllowedOrigin(origin: string, env: ApiEnv) {
  const configured = (env.CORS_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (configured.includes(origin)) return true;
  if (env.APP_ENV === "production") return origin === "https://localhost";
  return origin === "https://localhost" || origin === "capacitor://localhost" || /^http:\/\/localhost(?::\d+)?$/u.test(origin);
}
