import type { AppRelease } from "../../app/mobile/types";
import { ApiError, type ApiEnv } from "./contracts";
import { PRIMARY_OPERATOR_EMAIL } from "./repository";
import type { StudentIdentity } from "./repository";
import { keyedHash, randomId, sha256Hex } from "./security";

type Row = Record<string, unknown>;

function database(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function notes(value: unknown) {
  try {
    const parsed = JSON.parse(asString(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function stableRolloutBucket(installationId: string) {
  const digest = await sha256Hex(installationId);
  return Number.parseInt(digest.slice(0, 8), 16) % 100;
}

function mapRelease(row: Row): AppRelease {
  return {
    certificateSha256: asString(row.certificate_sha256),
    forced: Boolean(row.forced),
    minimumSupportedVersionCode: asNumber(row.minimum_supported_version_code),
    notes: notes(row.notes_json),
    packageId: asString(row.package_id),
    publishedAt: asNumber(row.published_at),
    sha256: asString(row.sha256),
    sizeBytes: asNumber(row.size_bytes),
    versionCode: asNumber(row.version_code),
    versionName: asString(row.version_name),
  };
}

function mapOperatorRelease(row: Row, artifactPresent: boolean) {
  return {
    ...mapRelease(row),
    artifactPresent,
    createdAt: asNumber(row.created_at),
    objectKey: asString(row.object_key),
    rolloutPercentage: asNumber(row.rollout_percentage),
    status: asString(row.status),
    updatedAt: asNumber(row.updated_at),
  };
}

function mapPublicRelease(row: Row) {
  return {
    ...mapRelease(row),
    minAndroid: "7.0",
  };
}

export async function listReleasesD1(env: ApiEnv) {
  const rows = await database(env).prepare("SELECT * FROM app_releases ORDER BY version_code DESC LIMIT 100").all<Row>();
  return Promise.all((rows.results ?? []).map(async (row) => {
    const artifact = env.RELEASES ? await env.RELEASES.head(asString(row.object_key)) : null;
    return mapOperatorRelease(row, Boolean(artifact));
  }));
}

export async function uploadReleaseArtifactD1(request: Request, versionCode: number, env: ApiEnv) {
  if (!env.RELEASES) throw new ApiError(503, "release_storage_unavailable", "更新存储暂时不可用");
  const versionName = request.headers.get("x-release-version-name")?.trim() ?? "";
  if (!Number.isInteger(versionCode) || versionCode < 1 || !/^\d+\.\d+\.\d+$/u.test(versionName)) {
    throw new ApiError(422, "invalid_release_artifact", "版本号格式不正确");
  }
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 100 * 1024 * 1024) throw new ApiError(413, "release_artifact_too_large", "安装包不能超过 100 MB");
  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!new Set(["application/octet-stream", "application/vnd.android.package-archive"]).has(contentType)) {
    throw new ApiError(415, "invalid_release_artifact_type", "仅允许上传 Android APK");
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 100 * 1024 * 1024) {
    throw new ApiError(bytes.byteLength ? 413 : 422, "invalid_release_artifact", bytes.byteLength ? "安装包不能超过 100 MB" : "安装包不能为空");
  }
  const sha256 = bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
  const objectKey = `android/${versionName}/zhuguang-android-private-${versionName}.apk`;
  await env.RELEASES.put(objectKey, bytes, {
    customMetadata: { packageId: "com.zhuguang.coachos", sha256, versionCode: String(versionCode), versionName },
    httpMetadata: { contentType: "application/vnd.android.package-archive" },
  });
  return { objectKey, sha256, sizeBytes: bytes.byteLength, versionCode, versionName };
}

export async function latestReleaseD1(installationId: string, currentVersionCode: number, env: ApiEnv) {
  const rows = await database(env).prepare(`
    SELECT * FROM app_releases WHERE status = 'published'
    ORDER BY version_code DESC LIMIT 20
  `).all<Row>();
  const bucket = await stableRolloutBucket(installationId);
  const eligible = (rows.results ?? []).find((row) => asNumber(row.version_code) > currentVersionCode
    && (Boolean(row.forced)
      || currentVersionCode < asNumber(row.minimum_supported_version_code)
      || bucket < asNumber(row.rollout_percentage)));
  if (!eligible) throw new ApiError(404, "release_not_available", "当前已是最新版本");
  return mapRelease(eligible);
}

export async function latestPublicReleaseD1(env: ApiEnv) {
  if (!env.RELEASES) throw new ApiError(503, "release_storage_unavailable", "下载服务暂时不可用");
  const rows = await database(env).prepare(`
    SELECT * FROM app_releases
    WHERE status = 'published' AND rollout_percentage = 100
    ORDER BY version_code DESC LIMIT 20
  `).all<Row>();
  for (const row of rows.results ?? []) {
    if (await env.RELEASES.head(asString(row.object_key))) return mapPublicRelease(row);
  }
  throw new ApiError(404, "public_release_not_available", "Android 安装包正在准备中");
}

export async function createPublicDownloadTicketD1(
  request: Request,
  versionCode: number,
  downloadId: string,
  env: ApiEnv,
) {
  if (!/^[a-zA-Z0-9_-]{20,160}$/u.test(downloadId)) {
    throw new ApiError(422, "invalid_download_id", "下载设备标识无效");
  }
  if (!env.AUTH_HASH_SECRET) throw new ApiError(503, "download_service_unavailable", "下载服务暂时不可用");
  const release = await database(env).prepare(`
    SELECT object_key FROM app_releases
    WHERE version_code = ? AND status = 'published' AND rollout_percentage = 100
  `).bind(versionCode).first<Row>();
  if (!release) throw new ApiError(404, "release_not_found", "未找到可公开下载的版本");
  if (!env.RELEASES || !(await env.RELEASES.head(asString(release.object_key)))) {
    throw new ApiError(404, "release_artifact_missing", "Android 安装包正在准备中");
  }

  const now = Date.now();
  const since = now - 60 * 60_000;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [ipHash, deviceHash] = await Promise.all([
    keyedHash(`public-download-ip:${ip}`, env.AUTH_HASH_SECRET),
    keyedHash(`public-download-device:${downloadId}`, env.AUTH_HASH_SECRET),
  ]);
  const counts = await database(env).prepare(`
    SELECT
      sum(CASE WHEN ip_hash = ? THEN 1 ELSE 0 END) AS ip_count,
      sum(CASE WHEN device_hash = ? THEN 1 ELSE 0 END) AS device_count
    FROM public_download_events WHERE created_at >= ?
  `).bind(ipHash, deviceHash, since).first<Row>();
  if (asNumber(counts?.ip_count) >= 20 || asNumber(counts?.device_count) >= 10) {
    throw new ApiError(429, "download_rate_limited", "下载请求较频繁，请稍后再试");
  }
  await database(env).prepare(`
    INSERT INTO public_download_events (id, version_code, ip_hash, device_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(randomId("download"), versionCode, ipHash, deviceHash, now).run();
  return createDownloadTicketD1(request, versionCode, `web-${downloadId}`, env);
}

export async function registerInstallationD1(
  identity: StudentIdentity | null,
  input: { installationId: string; platform: "android" | "ios"; pushRegistrationId?: string; versionCode: number; versionName: string },
  env: ApiEnv,
) {
  const now = Date.now();
  const pushProvider = input.platform === "android" && input.pushRegistrationId ? "jpush" : null;
  const pushRegistrationId = pushProvider ? input.pushRegistrationId : null;
  await database(env).prepare(`
    INSERT INTO app_installations
      (id, user_id, platform, app_version_code, app_version_name, push_provider, push_registration_id, push_enabled, status, last_seen_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = coalesce(excluded.user_id, app_installations.user_id),
      platform = excluded.platform,
      app_version_code = excluded.app_version_code,
      app_version_name = excluded.app_version_name,
      push_provider = excluded.push_provider,
      push_registration_id = excluded.push_registration_id,
      push_enabled = excluded.push_enabled,
      status = 'active', last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at
  `).bind(
    input.installationId,
    identity?.userId ?? null,
    input.platform,
    input.versionCode,
    input.versionName,
    pushProvider,
    pushRegistrationId,
    Boolean(pushRegistrationId),
    now,
    now,
    now,
  ).run();
  return { installationId: input.installationId };
}

export async function createDownloadTicketD1(
  request: Request,
  versionCode: number,
  installationId: string,
  env: ApiEnv,
) {
  const release = await database(env).prepare("SELECT object_key FROM app_releases WHERE version_code = ? AND status = 'published'").bind(versionCode).first<Row>();
  if (!release) throw new ApiError(404, "release_not_found", "未找到可下载的版本");
  const expiresAt = Date.now() + 5 * 60_000;
  const objectKey = asString(release.object_key);
  const signature = await keyedHash(`${versionCode}:${installationId}:${expiresAt}:${objectKey}`, env.UPDATE_DOWNLOAD_SECRET ?? "");
  const url = new URL("/api/v1/app/releases/download", request.url);
  url.searchParams.set("versionCode", String(versionCode));
  url.searchParams.set("installationId", installationId);
  url.searchParams.set("expiresAt", String(expiresAt));
  url.searchParams.set("signature", signature);
  return { expiresAt, url: url.toString() };
}

export async function downloadReleaseD1(url: URL, env: ApiEnv) {
  if (!env.RELEASES) throw new ApiError(503, "release_storage_unavailable", "更新存储暂时不可用");
  const versionCode = Number(url.searchParams.get("versionCode"));
  const installationId = url.searchParams.get("installationId") ?? "";
  const expiresAt = Number(url.searchParams.get("expiresAt"));
  const signature = url.searchParams.get("signature") ?? "";
  if (!Number.isInteger(versionCode) || !installationId || !signature || expiresAt <= Date.now()) {
    throw new ApiError(401, "download_ticket_invalid", "下载凭证无效或已过期");
  }
  const release = await database(env).prepare("SELECT object_key, sha256, size_bytes, version_name FROM app_releases WHERE version_code = ? AND status = 'published'").bind(versionCode).first<Row>();
  if (!release) throw new ApiError(404, "release_not_found", "未找到可下载的版本");
  const objectKey = asString(release.object_key);
  const expected = await keyedHash(`${versionCode}:${installationId}:${expiresAt}:${objectKey}`, env.UPDATE_DOWNLOAD_SECRET ?? "");
  if (expected !== signature) throw new ApiError(401, "download_ticket_invalid", "下载凭证校验失败");
  const object = await env.RELEASES.get(objectKey);
  if (!object) throw new ApiError(404, "release_artifact_missing", "更新安装包尚未就绪");
  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="zhuguang-android-${asString(release.version_name)}.apk"`,
      "content-length": String(asNumber(release.size_bytes)),
      "content-type": "application/vnd.android.package-archive",
      "x-content-sha256": asString(release.sha256),
    },
  });
}

export async function recordUpdateEventD1(
  identity: StudentIdentity | null,
  input: { detail?: Record<string, unknown>; eventType: string; installationId: string; versionCode: number },
  env: ApiEnv,
) {
  const allowed = new Set(["discovered", "deferred", "download_started", "download_verified", "install_launched", "installed", "failed"]);
  if (!allowed.has(input.eventType)) throw new ApiError(422, "invalid_update_event", "更新事件类型无效");
  await database(env).prepare(`
    INSERT INTO app_update_events (id, installation_id, user_id, version_code, event_type, detail_json, created_at)
    SELECT ?, id, ?, ?, ?, ?, ? FROM app_installations WHERE id = ?
  `).bind(
    randomId("update"),
    identity?.userId ?? null,
    input.versionCode,
    input.eventType,
    JSON.stringify(input.detail ?? {}).slice(0, 4000),
    Date.now(),
    input.installationId,
  ).run();
}

export async function saveNotificationPreferencesD1(
  identity: StudentIdentity,
  input: { booking: boolean; message: boolean; update: boolean },
  env: ApiEnv,
) {
  await database(env).prepare(`
    INSERT INTO notification_preferences (user_id, booking_enabled, message_enabled, update_enabled, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET booking_enabled = excluded.booking_enabled,
      message_enabled = excluded.message_enabled, update_enabled = excluded.update_enabled, updated_at = excluded.updated_at
  `).bind(identity.userId, input.booking, input.message, input.update, Date.now()).run();
  return input;
}

export function assertOperator(request: Request, env: ApiEnv) {
  const actor = request.headers.get("x-operator-actor")?.trim().toLowerCase();
  if (!env.OPERATOR_API_SECRET || request.headers.get("x-operator-secret") !== env.OPERATOR_API_SECRET || actor !== PRIMARY_OPERATOR_EMAIL) {
    throw new ApiError(403, "operator_access_denied", "无权执行版本运营操作");
  }
}

export async function createReleaseD1(input: {
  certificateSha256: string;
  forced: boolean;
  minimumSupportedVersionCode: number;
  notes: string[];
  objectKey: string;
  packageId: string;
  rolloutPercentage: number;
  sha256: string;
  sizeBytes: number;
  versionCode: number;
  versionName: string;
}, env: ApiEnv) {
  if (input.rolloutPercentage < 0 || input.rolloutPercentage > 100 || input.minimumSupportedVersionCode > input.versionCode) {
    throw new ApiError(422, "invalid_release", "版本灰度或最低支持版本配置无效");
  }
  if (!env.RELEASES) throw new ApiError(503, "release_storage_unavailable", "更新存储暂时不可用");
  const artifact = await env.RELEASES.head(input.objectKey);
  if (!artifact) throw new ApiError(422, "release_artifact_missing", "请先上传对应安装包");
  if (artifact.size !== input.sizeBytes || artifact.customMetadata?.sha256 !== input.sha256) {
    throw new ApiError(422, "release_artifact_mismatch", "安装包大小或 SHA-256 与构建清单不一致");
  }
  const latest = await database(env).prepare("SELECT max(version_code) AS version_code FROM app_releases").first<Row>();
  if (input.versionCode <= asNumber(latest?.version_code)) throw new ApiError(409, "version_code_not_increasing", "versionCode 必须严格递增");
  const now = Date.now();
  await database(env).prepare(`
    INSERT INTO app_releases
      (version_code, version_name, minimum_supported_version_code, forced, rollout_percentage, notes_json, size_bytes, sha256, certificate_sha256, package_id, object_key, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).bind(
    input.versionCode, input.versionName, input.minimumSupportedVersionCode, Number(input.forced),
    input.rolloutPercentage, JSON.stringify(input.notes), input.sizeBytes, input.sha256,
    input.certificateSha256, input.packageId, input.objectKey, now, now,
  ).run();
  return { status: "draft", versionCode: input.versionCode };
}

export async function updateReleasePolicyD1(versionCode: number, input: {
  forced: boolean;
  minimumSupportedVersionCode: number;
  rolloutPercentage: number;
}, env: ApiEnv) {
  if (!Number.isInteger(versionCode) || input.rolloutPercentage < 0 || input.rolloutPercentage > 100
    || input.minimumSupportedVersionCode < 1 || input.minimumSupportedVersionCode > versionCode) {
    throw new ApiError(422, "invalid_release", "版本灰度或最低支持版本配置无效");
  }
  const result = await database(env).prepare(`
    UPDATE app_releases SET forced = ?, minimum_supported_version_code = ?, rollout_percentage = ?, updated_at = ?
    WHERE version_code = ?
  `).bind(Number(input.forced), input.minimumSupportedVersionCode, input.rolloutPercentage, Date.now(), versionCode).run();
  if (!result.meta.changes) throw new ApiError(404, "release_not_found", "版本不存在");
  return { forced: input.forced, minimumSupportedVersionCode: input.minimumSupportedVersionCode, rolloutPercentage: input.rolloutPercentage, versionCode };
}

export async function setReleaseStatusD1(versionCode: number, status: "published" | "paused", env: ApiEnv) {
  const now = Date.now();
  const result = await database(env).prepare(`
    UPDATE app_releases SET status = ?, published_at = CASE WHEN ? = 'published' THEN coalesce(published_at, ?) ELSE published_at END, updated_at = ?
    WHERE version_code = ? AND status != ?
  `).bind(status, status, now, now, versionCode, status).run();
  if (!result.meta.changes) throw new ApiError(404, "release_not_found", "版本不存在或已经处于该状态");
  return { status, versionCode };
}
