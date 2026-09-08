import { ApiError, type ApiEnv } from "./contracts";
import { randomId, sha256Hex } from "./security";

type Row = Record<string, unknown>;
export type ReleaseCommand = {
  confirmed?: boolean; reason?: string; receiptId?: string; certificateSha256?: string;
  forced?: boolean; minimumSupportedVersionCode?: number; notes?: string[]; rolloutPercentage?: number;
};
type Action = "create" | "publish" | "pause" | "policy" | "notify";

export async function executeReleaseOperation(request: Request, action: Action, code: number, input: ReleaseCommand, requestId: string, env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  const db = env.DB;
  if (!input || typeof input !== "object" || Array.isArray(input) || !Number.isSafeInteger(code) || code < 0) throw new ApiError(422, "invalid_release", "版本参数无效");
  const actor = request.headers.get("x-operator-actor")!.trim().toLowerCase();
  const key = request.headers.get("idempotency-key") || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(key)) throw new ApiError(422, "idempotency_key_required", "请使用有效操作标识");
  if (input.confirmed !== true || typeof input.reason !== "string" || input.reason.trim().length < 4 || input.reason.length > 500) {
    throw new ApiError(422, "confirmation_required", "请确认操作并填写至少4字的原因");
  }
  const hash = await sha256Hex(JSON.stringify({ action, code, input }));
  async function replay() {
    const prior = await db.prepare("SELECT request_hash, result_json FROM release_operations WHERE actor=? AND idempotency_key=?").bind(actor, key).first<Row>();
    if (!prior) return null;
    if (prior.request_hash !== hash) throw new ApiError(409, "idempotency_conflict", "操作标识已用于其他内容");
    return JSON.parse(String(prior.result_json)) as Row;
  }
  const prior = await replay();
  if (prior) return prior;
  const now = Date.now(); const id = randomId("release_op");
  const statements: D1PreparedStatement[] = [];
  let result: Row;
  let condition: string;
  let bindings: unknown[];
  const guard = "EXISTS (SELECT 1 FROM release_operations WHERE id=?)";

  if (action === "create") {
    if (typeof input.receiptId !== "string" || !input.receiptId || ["sha256", "objectKey", "sizeBytes", "packageId"].some((name) => name in input)) throw new ApiError(422, "upload_receipt_required", "请使用上传回执创建清单，不可手填安装包信息");
    const receipt = await db.prepare("SELECT * FROM release_upload_receipts WHERE id=? AND actor=? AND consumed_at IS NULL AND expires_at>?").bind(input.receiptId, actor, now).first<Row>();
    if (!receipt) throw new ApiError(422, "upload_receipt_invalid", "上传回执已失效，请重新上传");
    code = Number(receipt.version_code);
    const certificate = typeof input.certificateSha256 === "string" ? input.certificateSha256.replace(/:/gu, "").toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/u.test(certificate) || !Array.isArray(input.notes) || !input.notes.length || input.notes.some((note) => typeof note !== "string" || note.length > 1000)) throw new ApiError(422, "invalid_release", "请填写有效的证书指纹和更新说明");
    const artifact = await env.RELEASES?.head(String(receipt.object_key));
    if (!artifact || artifact.size !== Number(receipt.size_bytes) || artifact.customMetadata?.sha256 !== receipt.sha256
      || artifact.customMetadata?.packageId !== "com.zhuguang.coachos" || artifact.customMetadata?.versionCode !== String(code) || artifact.customMetadata?.versionName !== receipt.version_name) throw new ApiError(422, "release_artifact_mismatch", "上传回执与存储对象不一致");
    validatePolicy(code, input);
    const latest = await db.prepare("SELECT max(version_code) AS code, certificate_sha256 FROM app_releases").first<Row>();
    if (code <= Number(latest?.code || 0)) throw new ApiError(409, "version_code_not_increasing", "versionCode 必须严格递增");
    if (latest?.certificate_sha256 && String(latest.certificate_sha256).replace(/:/gu, "").toLowerCase() !== certificate) throw new ApiError(422, "release_signature_mismatch", "证书必须与已发布版本一致");
    result = { status: "draft", versionCode: code };
    condition = "EXISTS (SELECT 1 FROM release_upload_receipts WHERE id=? AND consumed_at IS NULL AND expires_at>?) AND NOT EXISTS (SELECT 1 FROM app_releases WHERE version_code>=?)";
    bindings = [input.receiptId, now, code];
    statements.push(db.prepare(`INSERT INTO app_releases (version_code,version_name,minimum_supported_version_code,forced,rollout_percentage,notes_json,size_bytes,sha256,certificate_sha256,package_id,object_key,status,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,?,?, 'com.zhuguang.coachos',?,'draft',?,? WHERE ${guard}`).bind(code,receipt.version_name,input.minimumSupportedVersionCode,Number(input.forced === true),input.rolloutPercentage,JSON.stringify(input.notes),receipt.size_bytes,receipt.sha256,certificate,receipt.object_key,now,now,id));
    statements.push(db.prepare(`UPDATE release_upload_receipts SET consumed_at=? WHERE id=? AND ${guard}`).bind(now,input.receiptId,id));
  } else {
    const row = await db.prepare("SELECT * FROM app_releases WHERE version_code=?").bind(code).first<Row>();
    if (!row) throw new ApiError(404, "release_not_found", "版本不存在");
    condition = "EXISTS (SELECT 1 FROM app_releases WHERE version_code=? AND revision=? AND status=?)";
    bindings = [code, row.revision, row.status];
    if (action === "notify") {
      if (row.status !== "published") throw new ApiError(409, "release_not_published", "只有已发布版本可以通知");
      if (await db.prepare("SELECT id FROM release_operations WHERE version_code=? AND action='notify'").bind(code).first()) throw new ApiError(409, "release_already_notified", "该版本已有通知任务");
      const users = await db.prepare("SELECT count(*) AS count FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE u.status='active' AND u.deleted_at IS NULL AND coalesce(p.update_enabled,1)=1").first<Row>();
      result = { queuedUsers: Number(users?.count || 0), versionCode: code, versionName: row.version_name, jobId: id };
      statements.push(db.prepare(`INSERT OR IGNORE INTO notifications (id,user_id,type,title,body,entity_type,entity_id,target_mode,deep_link,created_at)
        SELECT 'release_' || ? || '_' || u.id,u.id,'version_update','逐光有新版本',?,'app_release',?,'student','zhuguang://updates/latest',?
        FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE u.status='active' AND u.deleted_at IS NULL AND coalesce(p.update_enabled,1)=1 AND ${guard}`).bind(code,`版本 ${row.version_name} 已发布，可前往版本中心安全更新。`,String(code),now,id));
    } else if (action === "policy") {
      validatePolicy(code, input);
      result = { versionCode: code, forced: input.forced === true, minimumSupportedVersionCode: input.minimumSupportedVersionCode, rolloutPercentage: input.rolloutPercentage };
      statements.push(db.prepare(`UPDATE app_releases SET forced=?,minimum_supported_version_code=?,rollout_percentage=?,updated_at=? WHERE version_code=? AND ${guard}`).bind(Number(input.forced === true),input.minimumSupportedVersionCode,input.rolloutPercentage,now,code,id));
    } else {
      const status = action === "publish" ? "published" : "paused";
      if (row.status === status) throw new ApiError(409, "release_state_conflict", "版本已经处于该状态");
      if (status === "published" && !await env.RELEASES?.head(String(row.object_key))) throw new ApiError(422, "release_artifact_missing", "安装包存储对象不存在");
      result = { versionCode: code, status };
      statements.push(db.prepare(`UPDATE app_releases SET status=?,published_at=CASE WHEN ?='published' THEN coalesce(published_at,?) ELSE published_at END,updated_at=? WHERE version_code=? AND ${guard}`).bind(status,status,now,now,code,id));
    }
  }
  if (action !== "create") statements.push(db.prepare(`UPDATE app_releases SET revision=revision+1 WHERE version_code=? AND ${guard}`).bind(code,id));
  statements.unshift(db.prepare(`INSERT INTO release_operations (id,actor,idempotency_key,request_hash,version_code,action,reason,result_json,request_id,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(id,actor,key,hash,code,action,input.reason.trim(),JSON.stringify(result),requestId,now,...bindings));
  statements.push(db.prepare(`INSERT INTO ops_audit_logs (id,actor,action,entity_type,entity_id,detail_json,request_id,created_at)
    SELECT ?,?,?,'app_release',?,?,?,? WHERE ${guard}`).bind(randomId("audit"),actor,`release.${action}`,String(code),JSON.stringify({ reason: input.reason.trim(), operationId: id, result }),requestId,now,id));
  try {
    const applied = await db.batch(statements);
    if (applied[0].meta.changes) return result;
  } catch (error) {
    const saved = await replay();
    if (saved) return saved;
    if (/UNIQUE constraint failed/u.test(String(error))) throw new ApiError(409, "release_operation_conflict", "版本操作冲突，请刷新查看");
    throw error;
  }
  const saved = await replay();
  if (saved) return saved;
  throw new ApiError(409, "release_operation_conflict", "版本状态已变化，请刷新后重新操作");
}

function validatePolicy(code: number, input: ReleaseCommand) {
  if (typeof input.forced !== "boolean" || !Number.isInteger(input.rolloutPercentage) || input.rolloutPercentage! < 0 || input.rolloutPercentage! > 100
    || !Number.isInteger(input.minimumSupportedVersionCode) || input.minimumSupportedVersionCode! < 1 || input.minimumSupportedVersionCode! > code) throw new ApiError(422, "invalid_release_policy", "灰度或最低支持版本无效");
}
