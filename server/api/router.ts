import { canTransitionBooking } from "../../app/mobile/domain";
import type { BookingStatus, LearnerProfile } from "../../app/mobile/types";
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
  createCoachSlotD1,
  createConversationD1,
  deleteAccountD1,
  getCoachD1,
  getMobileIdentityD1,
  listCoachesD1,
  listNotificationsD1,
  listSlotsD1,
  logoutD1,
  markOfflinePaidD1,
  refreshSessionD1,
  requestOtpD1,
  sendCoachBookingStatusSms,
  sendCoachMessageD1,
  sendStudentBookingStatusSms,
  sendStudentMessageD1,
  setFavoriteD1,
  upsertLearnerD1,
  verifyOtpD1,
} from "./repository";
import {
  assertOperator,
  createDownloadTicketD1,
  createReleaseD1,
  downloadReleaseD1,
  latestReleaseD1,
  listReleasesD1,
  recordUpdateEventD1,
  registerInstallationD1,
  saveNotificationPreferencesD1,
  setReleaseStatusD1,
  updateReleasePolicyD1,
  uploadReleaseArtifactD1,
} from "./releases";
import { dispatchPushDeliveriesD1, queueVersionNotificationsD1 } from "./push";
import { assertPilotApp, normalizePhone, randomId } from "./security";

const bookingStatuses = new Set<BookingStatus>([
  "cancelled_by_coach",
  "cancelled_by_student",
  "completed",
  "confirmed",
  "pending_coach",
  "rejected",
  "reschedule_requested",
]);

export async function handleApiRequest(request: Request, env: ApiEnv, ctx: ApiExecutionContext): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/")) return null;
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || randomId("request");
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), request, env, requestId);

  try {
    const publicCoachMedia = /^\/api\/v1\/media\/coaches\/\d+\/(avatar|hero)$/u.test(url.pathname);
    if (url.pathname !== "/api/v1/health" && url.pathname !== "/api/v1/app/releases/download" && !publicCoachMedia) assertPilotApp(request, env);
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

  if (request.method === "GET" && path === "/api/v1/health") {
    return success({
      database: Boolean(env.DB),
      environment: env.APP_ENV ?? "local",
      media: Boolean(env.MEDIA),
      ok: true,
      releases: Boolean(env.RELEASES),
    }, requestId);
  }

  const publicCoachMediaMatch = path.match(/^\/api\/v1\/media\/coaches\/(\d+)\/(avatar|hero)$/u);
  if (request.method === "GET" && publicCoachMediaMatch) {
    if (!env.DB || !env.MEDIA) throw new ApiError(503, "media_unavailable", "教练图片服务暂时不可用");
    const coachId = Number(publicCoachMediaMatch[1]);
    const column = publicCoachMediaMatch[2] === "avatar" ? "avatar_object_key" : "hero_object_key";
    const coach = await env.DB.prepare(`SELECT ${column} AS object_key FROM coaches WHERE id = ? AND audit_status = 'approved'`).bind(coachId).first<{ object_key: string | null }>();
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
    const body = await readJson<{ installationId?: unknown; pushRegistrationId?: unknown; versionCode?: unknown; versionName?: unknown }>(request);
    const input = {
      installationId: requireString(body.installationId, "installationId", 180),
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

  if (request.method === "POST" && path === "/api/v1/operator/releases") {
    assertOperator(request, env);
    const body = await readJson<Parameters<typeof createReleaseD1>[0]>(request);
    return success(await createReleaseD1(body, env), requestId, undefined, 201);
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
    const body = await readJson<{ forced?: unknown; minimumSupportedVersionCode?: unknown; rolloutPercentage?: unknown }>(request);
    return success(await updateReleasePolicyD1(Number(operatorReleasePolicyMatch[1]), {
      forced: body.forced === true,
      minimumSupportedVersionCode: positiveInteger(body.minimumSupportedVersionCode, "minimumSupportedVersionCode"),
      rolloutPercentage: nonNegativeInteger(body.rolloutPercentage, "rolloutPercentage"),
    }, env), requestId);
  }

  const operatorReleaseStatusMatch = path.match(/^\/api\/v1\/operator\/releases\/(\d+)\/(publish|pause)$/u);
  if (request.method === "POST" && operatorReleaseStatusMatch) {
    assertOperator(request, env);
    return success(await setReleaseStatusD1(Number(operatorReleaseStatusMatch[1]), operatorReleaseStatusMatch[2] === "publish" ? "published" : "paused", env), requestId);
  }

  const operatorReleaseNotifyMatch = path.match(/^\/api\/v1\/operator\/releases\/(\d+)\/notify$/u);
  if (request.method === "POST" && operatorReleaseNotifyMatch) {
    assertOperator(request, env);
    if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
    const release = await env.DB.prepare("SELECT version_name FROM app_releases WHERE version_code = ? AND status = 'published'").bind(Number(operatorReleaseNotifyMatch[1])).first<{ version_name: string }>();
    if (!release) throw new ApiError(404, "release_not_found", "只能为已发布版本触发通知");
    const queued = await queueVersionNotificationsD1(release.version_name, env);
    ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(queued, requestId, undefined, 202);
  }

  if (request.method === "GET" && path === "/api/v1/bootstrap") {
    return success(local ? localBootstrap(request) : await bootstrapD1(request, env), requestId);
  }

  if (request.method === "GET" && path === "/api/v1/coaches") {
    const coaches = local ? filterLocalCoaches(url) : await listCoachesD1(env, url.searchParams);
    return success(coaches, requestId, { count: coaches.length });
  }

  const coachSlotsMatch = path.match(/^\/api\/v1\/coaches\/(\d+)\/slots$/u);
  if (request.method === "GET" && coachSlotsMatch) {
    const coachId = Number(coachSlotsMatch[1]);
    const slots = local ? getLocalCoachData().slots(coachId).filter((slot) => slot.available) : await listSlotsD1(coachId, env);
    return success(slots, requestId, { timezone: "Asia/Shanghai" });
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
    return success(local ? refreshLocalSession(refreshToken, deviceId) : await refreshSessionD1(refreshToken, deviceId, env), requestId);
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

  if (request.method === "GET" && path === "/api/v1/bookings") {
    if (local) authenticateLocal(request);
    else await authenticateStudent(request, env);
    const data = local ? localBootstrap(request).bookings : (await bootstrapD1(request, env)).bookings;
    return success(data, requestId);
  }

  if (request.method === "POST" && path === "/api/v1/bookings") {
    const body = await readJson<{ coachId?: unknown; learnerId?: unknown; note?: unknown; slotId?: unknown; venueId?: unknown }>(request);
    const input = {
      coachId: positiveInteger(body.coachId, "coachId"),
      learnerId: requireString(body.learnerId, "learnerId", 160),
      note: typeof body.note === "string" ? body.note.trim().slice(0, 500) : "",
      slotId: requireString(body.slotId, "slotId", 200),
      venueId: requireString(body.venueId, "venueId", 200),
    };
    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 160) || requestId;
    const booking = local
      ? (authenticateLocal(request), localCreateBooking(input))
      : await createBookingD1((await authenticateStudent(request, env))!, input, idempotencyKey, env);
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
    return success(await createConversationD1((await authenticateStudent(request, env))!, coachId, env), requestId, undefined, 201);
  }

  const messageMatch = path.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/u);
  if (request.method === "POST" && messageMatch) {
    const body = await readJson<{ body?: unknown }>(request);
    const message = requireString(body.body, "body", 1000);
    const conversationId = decodeURIComponent(messageMatch[1]);
    const conversation = local
      ? (authenticateLocal(request), localSendMessage(conversationId, message))
      : await sendStudentMessageD1((await authenticateStudent(request, env))!, conversationId, message, env);
    if (!local) ctx.waitUntil(dispatchPushDeliveriesD1(env));
    return success(conversation, requestId, undefined, 201);
  }

  if (request.method === "GET" && path === "/api/v1/notifications") {
    if (local) {
      authenticateLocal(request);
      return success([], requestId);
    }
    return success(await listNotificationsD1((await authenticateStudent(request, env))!, env), requestId);
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

  if (request.method === "GET" && path === "/api/v1/coach/overview") {
    const data = local ? localCoachOverview() : await coachOverviewD1(await authenticateCoach(request, env), env);
    return success(data, requestId);
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

  if (request.method === "POST" && path === "/api/v1/coach/slots") {
    const body = await readJson<{ endsAt?: unknown; startsAt?: unknown; venueId?: unknown }>(request);
    if (local) throw new ApiError(501, "local_write_not_supported", "本地预览暂不写入排期数据");
    return success(await createCoachSlotD1(await authenticateCoach(request, env), {
      endsAt: timestamp(body.endsAt, "endsAt"),
      startsAt: timestamp(body.startsAt, "startsAt"),
      venueId: requireString(body.venueId, "venueId", 200),
    }, env), requestId, undefined, 201);
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

function filterLocalCoaches(url: URL) {
  const { coaches } = getLocalCoachData();
  const sport = url.searchParams.get("sport");
  const district = url.searchParams.get("district");
  const maxPriceFen = Number(url.searchParams.get("maxPriceFen"));
  return coaches.filter((coach) => (!sport || coach.sport === sport)
    && (!district || coach.district === district)
    && (!Number.isFinite(maxPriceFen) || maxPriceFen <= 0 || coach.price * 100 <= maxPriceFen));
}

function positiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ApiError(422, "validation_failed", "请检查提交内容", { [field]: "必须为正整数" });
  return parsed;
}

function nonNegativeInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new ApiError(422, "validation_failed", "请检查提交内容", { [field]: "必须为非负整数" });
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

function withCors(response: Response, request: Request, env: ApiEnv, requestId: string) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set("access-control-allow-origin", origin);
    headers.append("vary", "origin");
  }
  headers.set("access-control-allow-headers", "authorization, content-type, idempotency-key, x-app-platform, x-app-version, x-app-version-code, x-device-id, x-operator-secret, x-release-version-name, x-request-id, x-zhuguang-app-key");
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
