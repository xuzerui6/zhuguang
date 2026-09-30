import { SERVICE_AREAS, SUPPORTED_SPORTS, cityName, isServiceArea, isServiceCity, type ServiceCityId } from "../../shared/service-cities";
import { ApiError, type ApiEnv } from "./contracts";
import { BODY_LIMITS, readBoundedBody } from "./request-body";
import type { StudentIdentity } from "./repository";
import { randomId } from "./security";

type Row = Record<string, unknown>;
type ApplicationStatus = "draft" | "pending" | "approved" | "rejected" | "withdrawn";

export type CoachApplicationInput = {
  applicationId?: string;
  realName: string;
  title: string;
  bio: string;
  experienceYears: number;
  audiences: string[];
  goals: string[];
  strengths: string[];
  honors: string[];
  credentials: string[];
  priceFen: number;
  trialPriceFen: number;
  sportIds: string[];
  areaIds: string[];
  primarySportId: string;
  primaryAreaId: string;
  venue: { name: string; address: string; areaId: string };
};

function db(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503, "database_unavailable", "业务数据库暂时不可用");
  return env.DB;
}

function stringValue(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function jsonArray(value: unknown) { try { const parsed = JSON.parse(stringValue(value) || "[]"); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
function rows(result: D1Result<Row>) { return result.results ?? []; }

async function assertApplicationWriteRate(identity:StudentIdentity,env:ApiEnv){
  const recent=await db(env).prepare("SELECT count(*) AS count FROM coach_application_events e JOIN coach_applications a ON a.id=e.application_id WHERE a.user_id=? AND e.created_at>=?").bind(identity.userId,Date.now()-3600000).first<Row>();
  if(numberValue(recent?.count)>=60)throw new ApiError(429,"coach_application_rate_limited","申请操作过于频繁，请稍后重试");
}

export async function listMulticityCatalogD1(cityIdInput: string | null, env: ApiEnv) {
  if(cityIdInput && !isServiceCity(cityIdInput))throw new ApiError(422,"unsupported_service_city","当前仅支持北京和长春");
  const cityId: ServiceCityId = cityIdInput && isServiceCity(cityIdInput) ? cityIdInput : "beijing";
  const database = db(env);
  const [cityRows, areaRows, serviceAreaRows, sportRows] = await Promise.all([
    database.prepare("SELECT id,name,province FROM service_cities WHERE status='published' ORDER BY sort_order,name").all<Row>(),
    database.prepare(`SELECT a.id,a.name FROM service_areas a WHERE a.city_id=? AND a.status='published' AND EXISTS (
      SELECT 1 FROM coaches c WHERE c.profile_kind='real' AND c.audit_status='approved' AND c.listing_status='online' AND c.booking_enabled=1
      AND ((c.city=? AND c.district=a.name) OR EXISTS (SELECT 1 FROM coach_service_areas csa WHERE csa.coach_id=c.id AND csa.area_id=a.id))
    ) ORDER BY a.sort_order,a.name`).bind(cityId, cityName(cityId)).all<Row>(),
    database.prepare("SELECT id,name FROM service_areas WHERE city_id=? AND status='published' ORDER BY sort_order,name").bind(cityId).all<Row>(),
    database.prepare(`SELECT s.id,s.name,s.sort_order,
      count(DISTINCT CASE WHEN c.profile_kind='real' AND c.audit_status='approved' AND c.listing_status='online' AND c.booking_enabled=1 THEN c.id END) AS coach_count
      FROM service_sports s
      LEFT JOIN coach_sports cs ON cs.sport_id=s.id
      LEFT JOIN coaches c ON c.id=cs.coach_id
        AND (EXISTS (SELECT 1 FROM coach_service_areas ca JOIN service_areas a ON a.id=ca.area_id WHERE ca.coach_id=c.id AND a.city_id=?) OR c.city=?)
      WHERE s.name IN ('田径','羽毛球','游泳','网球','篮球','体能') AND s.status<>'disabled'
      GROUP BY s.id,s.name,s.sort_order ORDER BY s.sort_order,s.name`).bind(cityId, cityName(cityId)).all<Row>(),
  ]);
  return {
    city: cityName(cityId),
    cityId,
    cities: rows(cityRows),
    regions: rows(areaRows),
    serviceAreas: rows(serviceAreaRows),
    sports: rows(sportRows).map((row) => ({
      available: numberValue(row.coach_count) > 0,
      coachCount: numberValue(row.coach_count),
      id: stringValue(row.id),
      name: stringValue(row.name),
    })),
  };
}

export async function getServicePreferenceD1(identity: StudentIdentity, env: ApiEnv) {
  const row = await db(env).prepare("SELECT city_id,source,updated_at FROM user_service_preferences WHERE user_id=?").bind(identity.userId).first<Row>();
  return { cityId: row && isServiceCity(stringValue(row.city_id)) ? stringValue(row.city_id) as ServiceCityId : "beijing", source: row?.source === "location" ? "location" as const : "manual" as const };
}

export async function saveServicePreferenceD1(identity: StudentIdentity, cityId: string, source: string, env: ApiEnv) {
  if (!isServiceCity(cityId)) throw new ApiError(422, "unsupported_service_city", "当前仅支持北京和长春");
  if (source !== "manual" && source !== "location") throw new ApiError(422, "invalid_preference_source", "城市来源无效");
  await db(env).prepare(`INSERT INTO user_service_preferences(user_id,city_id,source,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET city_id=excluded.city_id,source=excluded.source,updated_at=excluded.updated_at`)
    .bind(identity.userId, cityId, source, Date.now()).run();
  return { cityId, source };
}

function normalizeList(value: string[], maxItems: number, maxLength = 80) {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].slice(0, maxItems).map((item) => item.slice(0, maxLength));
}

function normalizeApplicationInput(input: CoachApplicationInput): CoachApplicationInput {
  const venue = input.venue && typeof input.venue === "object" ? input.venue : { address: "", areaId: "", name: "" };
  const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return {
    applicationId: typeof input.applicationId === "string" ? input.applicationId : undefined,
    realName: stringValue(input.realName), title: stringValue(input.title), bio: stringValue(input.bio),
    experienceYears: numberValue(input.experienceYears), priceFen: numberValue(input.priceFen), trialPriceFen: numberValue(input.trialPriceFen),
    audiences: list(input.audiences), goals: list(input.goals), strengths: list(input.strengths), honors: list(input.honors), credentials: list(input.credentials),
    sportIds: list(input.sportIds), areaIds: list(input.areaIds), primarySportId: stringValue(input.primarySportId), primaryAreaId: stringValue(input.primaryAreaId),
    venue: { address: stringValue(venue.address), areaId: stringValue(venue.areaId), name: stringValue(venue.name) },
  };
}

async function validateApplicationInput(input: CoachApplicationInput, env: ApiEnv, complete = true) {
  const fieldErrors: Record<string, string> = {};
  if (input.realName.trim().length < 2 || input.realName.length > 40) fieldErrors.realName = "请填写真实姓名";
  if (input.title.trim().length < 2 || input.title.length > 80) fieldErrors.title = "请填写公开头衔";
  if (input.bio.trim().length < 20 || input.bio.length > 1000) fieldErrors.bio = "个人简介需为20至1000字";
  if (!Number.isInteger(input.experienceYears) || input.experienceYears < 0 || input.experienceYears > 80) fieldErrors.experienceYears = "执教年限无效";
  if (!Number.isInteger(input.priceFen) || input.priceFen <= 0) fieldErrors.priceFen = "请填写有效常规课价格";
  if (!Number.isInteger(input.trialPriceFen) || input.trialPriceFen <= 0) fieldErrors.trialPriceFen = "请填写有效试课价格";
  if(input.priceFen>10000000||input.trialPriceFen>10000000)fieldErrors.priceFen="价格不能超过100000元";
  if(input.sportIds.length>6||input.areaIds.length>23)fieldErrors.areaIds="申请项目或区域数量超过限制";
  if (!input.audiences.length) fieldErrors.audiences = "请选择服务对象";
  if (!input.goals.length || !input.strengths.length) fieldErrors.strengths = "请填写训练方向和擅长项目";
  if (!input.credentials.length) fieldErrors.credentials = "请填写并上传证明材料";
  if (!input.sportIds.length || !input.sportIds.includes(input.primarySportId)) fieldErrors.sportIds = "请选择主项目";
  if (!input.areaIds.length || !input.areaIds.includes(input.primaryAreaId)) fieldErrors.areaIds = "请选择主服务区域";
  if (!input.venue?.name.trim() || !input.venue.address.trim() || !input.areaIds.includes(input.venue.areaId)) fieldErrors.venue = "请填写服务区域内的真实场馆";
  if (!complete) {
    for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
    if(input.realName.length>40||input.title.length>80||input.bio.length>1000)fieldErrors.bio="资料内容超过长度限制";
    if(!Number.isInteger(input.experienceYears)||input.experienceYears<0||input.experienceYears>80)fieldErrors.experienceYears="执教年限无效";
    if(!Number.isInteger(input.priceFen)||input.priceFen<0||!Number.isInteger(input.trialPriceFen)||input.trialPriceFen<0)fieldErrors.priceFen="价格必须为非负整数分";
    if(input.priceFen>10000000||input.trialPriceFen>10000000)fieldErrors.priceFen="价格不能超过100000元";
    if(input.sportIds.length>6||input.areaIds.length>23)fieldErrors.areaIds="申请项目或区域数量超过限制";
    if(input.primarySportId&&!input.sportIds.includes(input.primarySportId))fieldErrors.sportIds="主项目不在申请项目中";
    if(input.primaryAreaId&&!input.areaIds.includes(input.primaryAreaId))fieldErrors.areaIds="主区域不在申请区域中";
    if(input.venue.areaId&&!input.areaIds.includes(input.venue.areaId))fieldErrors.venue="场馆区域不在申请范围内";
  }
  if (Object.keys(fieldErrors).length) throw new ApiError(422, "coach_application_incomplete", "请补全教练申请资料", fieldErrors);
  const database = db(env);
  const sportRows = await database.prepare(`SELECT id FROM service_sports WHERE id IN (${input.sportIds.map(() => "?").join(",")||"NULL"}) AND status<>'disabled' AND name IN ('田径','羽毛球','游泳','网球','篮球','体能')`).bind(...input.sportIds).all<Row>();
  if (rows(sportRows).length !== new Set(input.sportIds).size) throw new ApiError(422, "invalid_application_sport", "申请项目不在服务目录中");
  const areaRows = await database.prepare(`SELECT id,city_id,name FROM service_areas WHERE id IN (${input.areaIds.map(() => "?").join(",")||"NULL"}) AND status='published'`).bind(...input.areaIds).all<Row>();
  if (rows(areaRows).length !== new Set(input.areaIds).size) throw new ApiError(422, "invalid_application_area", "申请区域不在当前服务范围内");
  if(rows(areaRows).some(area=>!validateCityDistrict(stringValue(area.city_id),stringValue(area.name))))throw new ApiError(422,"invalid_application_area","申请区域不在当前服务范围内");
}

export async function saveCoachApplicationDraftD1(identity: StudentIdentity, input: CoachApplicationInput, env: ApiEnv) {
  await assertApplicationWriteRate(identity,env);
  input = normalizeApplicationInput(input);
  await validateApplicationInput(input, env, false);
  const database = db(env);
  const now = Date.now();
  const existingCoach = await database.prepare("SELECT id FROM coaches WHERE user_id=? LIMIT 1").bind(identity.userId).first<Row>();
  if (existingCoach) throw new ApiError(409, "coach_account_exists", "当前账号已经绑定教练档案");
  const activeApplication = await database.prepare("SELECT id,status FROM coach_applications WHERE user_id=? AND status IN ('draft','pending','approved') ORDER BY created_at DESC LIMIT 1").bind(identity.userId).first<Row>();
  if (activeApplication && stringValue(activeApplication.id) !== input.applicationId) throw new ApiError(409,"coach_application_exists","已有教练申请，请继续填写或查看审核进度");
  const id = input.applicationId || randomId("coach_application");
  const token=randomId("application_change");
  const current = input.applicationId ? await database.prepare("SELECT * FROM coach_applications WHERE id=? AND user_id=?").bind(id, identity.userId).first<Row>() : null;
  if (input.applicationId && !current) throw new ApiError(404, "coach_application_not_found", "未找到该教练申请");
  if (current && current.status !== "draft" && current.status !== "rejected") throw new ApiError(409, "coach_application_locked", "当前申请状态不能修改");
  const audiences = normalizeList(input.audiences, 10);
  const goals = normalizeList(input.goals, 12);
  const strengths = normalizeList(input.strengths, 12);
  const honors = normalizeList(input.honors, 12, 160);
  const credentials = normalizeList(input.credentials, 12, 160);
  const statements: D1PreparedStatement[] = [];
  if (current) {
    statements.push(database.prepare(`UPDATE coach_applications SET status='draft',real_name=?,title=?,bio=?,experience_years=?,audience_json=?,goals_json=?,strengths_json=?,honors_json=?,credentials_json=?,price_fen=?,trial_price_fen=?,review_note=NULL,review_token=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('draft','rejected')`)
      .bind(input.realName.trim(), input.title.trim(), input.bio.trim(), input.experienceYears, JSON.stringify(audiences), JSON.stringify(goals), JSON.stringify(strengths), JSON.stringify(honors), JSON.stringify(credentials), input.priceFen||null, input.trialPriceFen||null,token, now, id, identity.userId));
  } else {
    statements.push(database.prepare(`INSERT INTO coach_applications(id,user_id,status,real_name,title,bio,experience_years,audience_json,goals_json,strengths_json,honors_json,credentials_json,price_fen,trial_price_fen,review_token,created_at,updated_at)
      VALUES(?,?,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, identity.userId, input.realName.trim(), input.title.trim(), input.bio.trim(), input.experienceYears, JSON.stringify(audiences), JSON.stringify(goals), JSON.stringify(strengths), JSON.stringify(honors), JSON.stringify(credentials), input.priceFen||null, input.trialPriceFen||null,token, now, now));
  }
  statements.push(
    database.prepare("DELETE FROM coach_application_sports WHERE application_id=? AND EXISTS(SELECT 1 FROM coach_applications WHERE id=? AND review_token=? AND status='draft')").bind(id,id,token),
    database.prepare("DELETE FROM coach_application_areas WHERE application_id=? AND EXISTS(SELECT 1 FROM coach_applications WHERE id=? AND review_token=? AND status='draft')").bind(id,id,token),
    database.prepare("DELETE FROM coach_application_venues WHERE application_id=? AND EXISTS(SELECT 1 FROM coach_applications WHERE id=? AND review_token=? AND status='draft')").bind(id,id,token),
  );
  for (const sportId of [...new Set(input.sportIds)]) statements.push(database.prepare("INSERT INTO coach_application_sports(application_id,sport_id,is_primary) SELECT id,?,? FROM coach_applications WHERE id=? AND review_token=? AND status='draft'").bind(sportId, sportId === input.primarySportId ? 1 : 0,id,token));
  for (const areaId of [...new Set(input.areaIds)]) statements.push(database.prepare("INSERT INTO coach_application_areas(application_id,area_id,is_primary) SELECT id,?,? FROM coach_applications WHERE id=? AND review_token=? AND status='draft'").bind(areaId, areaId === input.primaryAreaId ? 1 : 0,id,token));
  if(input.venue.areaId)statements.push(database.prepare("INSERT INTO coach_application_venues(id,application_id,area_id,name,address,created_at) SELECT ?,id,?,?,?,? FROM coach_applications WHERE id=? AND review_token=? AND status='draft'").bind(randomId("application_venue"),input.venue.areaId,input.venue.name.trim(),input.venue.address.trim(),now,id,token));
  statements.push(
    database.prepare("INSERT INTO coach_application_events(id,application_id,actor,event_type,detail_json,created_at) SELECT ?,id,?,'draft_saved','{}',? FROM coach_applications WHERE id=? AND review_token=? AND status='draft'").bind(randomId("application_event"), `user:${identity.userId}`, now,id,token),
  );
  let result: D1Result[];
  try { result=await database.batch(statements); }
  catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: coach_applications.user_id/u.test(error.message)) throw new ApiError(409,"coach_application_exists","已有教练申请，请刷新后继续处理");
    throw error;
  }
  if(!result[0].meta.changes)throw new ApiError(409,"coach_application_conflict","申请已提交或已处理，请刷新后重试");
  return getCoachApplicationD1(identity, id, env);
}

type CoachApplicationRow = Row & {
  user_id: string;
  status: ApplicationStatus;
  avatar_temp_key: string;
  hero_temp_key: string;
  credential_temp_keys_json: string;
  real_name: string;
  title: string;
  bio: string;
  experience_years: number;
  price_fen: number;
  trial_price_fen: number;
  audience_json: string;
  goals_json: string;
  strengths_json: string;
  honors_json: string;
  credentials_json: string;
};

type CoachApplicationDetail = CoachApplicationRow & {
  audiences: string[];
  goals: string[];
  strengths: string[];
  honors: string[];
  credentials: string[];
  credentialTempKeys: string[];
  sports: Array<{ id: string; name: string; primary: number }>;
  areas: Array<{ id: string; cityId: ServiceCityId; name: string; primary: number }>;
  venues: Array<{ id: string; areaId: string; name: string; address: string }>;
};

async function applicationDetail(id: string, env: ApiEnv): Promise<CoachApplicationDetail> {
  const database = db(env);
  const row = await database.prepare(`SELECT a.*,
    (SELECT json_group_array(json_object('id',s.id,'name',s.name,'primary',cas.is_primary)) FROM coach_application_sports cas JOIN service_sports s ON s.id=cas.sport_id WHERE cas.application_id=a.id) AS sports_json,
    (SELECT json_group_array(json_object('id',ar.id,'cityId',ar.city_id,'name',ar.name,'primary',caa.is_primary)) FROM coach_application_areas caa JOIN service_areas ar ON ar.id=caa.area_id WHERE caa.application_id=a.id) AS areas_json,
    (SELECT json_group_array(json_object('id',v.id,'areaId',v.area_id,'name',v.name,'address',v.address)) FROM coach_application_venues v WHERE v.application_id=a.id) AS venues_json
    FROM coach_applications a WHERE a.id=?`).bind(id).first<Row>();
  if (!row) throw new ApiError(404, "coach_application_not_found", "未找到该教练申请");
  return {
    ...row,
    audiences: jsonArray(row.audience_json), goals: jsonArray(row.goals_json), strengths: jsonArray(row.strengths_json),
    honors: jsonArray(row.honors_json), credentials: jsonArray(row.credentials_json), credentialTempKeys: jsonArray(row.credential_temp_keys_json),
    sports: JSON.parse(stringValue(row.sports_json) || "[]"), areas: JSON.parse(stringValue(row.areas_json) || "[]"), venues: JSON.parse(stringValue(row.venues_json) || "[]"),
  } as CoachApplicationDetail;
}

export async function listMyCoachApplicationsD1(identity: StudentIdentity, env: ApiEnv) {
  const result = await db(env).prepare("SELECT id FROM coach_applications WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(identity.userId).all<Row>();
  return Promise.all(rows(result).map((row) => applicationDetail(stringValue(row.id), env)));
}

export async function getCoachApplicationD1(identity: StudentIdentity, id: string, env: ApiEnv) {
  const item = await applicationDetail(id, env);
  if (item.user_id !== identity.userId) throw new ApiError(404, "coach_application_not_found", "未找到该教练申请");
  return item;
}

const applicationImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const applicationCredentialTypes = new Set([...applicationImageTypes, "application/pdf"]);

export async function uploadCoachApplicationMediaD1(identity: StudentIdentity, id: string, kind: "avatar" | "hero" | "credential", request: Request, env: ApiEnv) {
  if (!env.MEDIA) throw new ApiError(503, "media_unavailable", "资料存储暂时不可用");
  const item = await getCoachApplicationD1(identity, id, env);
  if (item.status !== "draft" && item.status !== "rejected") throw new ApiError(409, "coach_application_locked", "当前申请状态不能上传资料");
  const contentType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const allowed = kind === "credential" ? applicationCredentialTypes : applicationImageTypes;
  if (!allowed.has(contentType)) throw new ApiError(415, "unsupported_application_media", kind === "credential" ? "证明材料仅支持 JPG、PNG、WebP 或 PDF" : "照片仅支持 JPG、PNG 或 WebP");
  const bytes = await readBoundedBody(request, kind === "credential" ? BODY_LIMITS.evidence : 4 * BODY_LIMITS.avatar);
  if (!bytes.byteLength) throw new ApiError(422, "empty_application_media", "上传文件不能为空");
  const prefix=new Uint8Array(bytes,0,Math.min(12,bytes.byteLength));
  const text=String.fromCharCode(...prefix);
  const valid=contentType==="image/jpeg"?prefix[0]===0xff&&prefix[1]===0xd8&&prefix[2]===0xff:contentType==="image/png"?prefix[0]===0x89&&text.slice(1,8)==="PNG\r\n\x1a\n":contentType==="image/webp"?text.startsWith("RIFF")&&text.slice(8,12)==="WEBP":text.startsWith("%PDF-");
  if(!valid)throw new ApiError(415,"application_media_signature_invalid","文件内容与声明格式不一致，请重新选择");
  await assertApplicationWriteRate(identity,env);
  const objectKey = `coach-applications/${identity.userId}/${id}/${kind}-${randomId("media")}`;
  await env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType } });
  const database = db(env); const now = Date.now();
  const token=randomId("application_upload");
  try {
    const update=kind==="credential"
      ?database.prepare("UPDATE coach_applications SET credential_temp_keys_json=json_insert(credential_temp_keys_json,'$[#]',?),review_token=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('draft','rejected') AND json_array_length(credential_temp_keys_json)<12").bind(objectKey,token,now,id,identity.userId)
      :database.prepare(`UPDATE coach_applications SET ${kind === "avatar" ? "avatar_temp_key" : "hero_temp_key"}=?,review_token=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('draft','rejected')`).bind(objectKey,token,now,id,identity.userId);
    const result=await database.batch([update,
      database.prepare("INSERT INTO coach_application_events(id,application_id,actor,event_type,detail_json,created_at) SELECT ?,id,?,'media_uploaded',?,? FROM coach_applications WHERE id=? AND review_token=?").bind(randomId("application_event"),`user:${identity.userId}`,JSON.stringify({kind}),now,id,token),
    ]);
    if(!result[0].meta.changes)throw new ApiError(409,"coach_application_locked","申请状态已变化或证明材料已达上限");
  } catch(error){await env.MEDIA.delete(objectKey).catch(()=>undefined);throw error;}
  if(kind!=="credential"){
    const previous = stringValue(item[`${kind}_temp_key`]);
    if (previous) await env.MEDIA.delete(previous).catch(() => undefined);
  }
  return { kind, uploaded: true };
}

export async function readOperatorApplicationMediaD1(id:string,kind:"avatar"|"hero"|"credential",index:number,actor:string,requestId:string,env:ApiEnv){
  if(!env.MEDIA)throw new ApiError(503,"media_unavailable","资料存储暂不可用");
  const item=await applicationDetail(id,env);
  const key=kind==="credential"?item.credentialTempKeys[index]:stringValue(item[`${kind}_temp_key`]);
  if(!key)throw new ApiError(404,"application_media_not_found","未找到该资料");
  const object=await env.MEDIA.get(key);
  if(!object)throw new ApiError(404,"application_media_not_found","资料文件不可用");
  const metadata=new Headers();object.writeHttpMetadata(metadata);
  const contentType=metadata.get("content-type")||"application/octet-stream";
  if(!applicationCredentialTypes.has(contentType))throw new ApiError(415,"unsupported_application_media","资料格式不支持预览");
  await db(env).prepare("INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,request_id,created_at) VALUES(?,?,'coach.application.media.view','coach_application',?,?,?,?)").bind(randomId("audit"),actor,id,JSON.stringify({kind,index}),requestId,Date.now()).run();
  return new Response(object.body,{headers:{"content-type":contentType,"cache-control":"private, no-store","content-disposition":contentType==="application/pdf"?"attachment; filename=credential.pdf":"inline","x-content-type-options":"nosniff"}});
}

export async function submitCoachApplicationD1(identity: StudentIdentity, id: string, env: ApiEnv) {
  await assertApplicationWriteRate(identity,env);
  const item = await getCoachApplicationD1(identity, id, env);
  if (item.status !== "draft" && item.status !== "rejected") throw new ApiError(409, "coach_application_not_submittable", "当前申请不能提交");
  if (!stringValue(item.avatar_temp_key) || !stringValue(item.hero_temp_key) || !jsonArray(item.credential_temp_keys_json).length) {
    throw new ApiError(422, "coach_application_media_incomplete", "请上传头像、详情图片和证明材料");
  }
  await validateApplicationInput({realName:item.real_name,title:item.title,bio:item.bio,experienceYears:item.experience_years,audiences:item.audiences,goals:item.goals,strengths:item.strengths,honors:item.honors,credentials:item.credentials,priceFen:numberValue(item.price_fen),trialPriceFen:numberValue(item.trial_price_fen),sportIds:item.sports.map(s=>s.id),areaIds:item.areas.map(a=>a.id),primarySportId:item.sports.find(s=>s.primary)?.id||"",primaryAreaId:item.areas.find(a=>a.primary)?.id||"",venue:item.venues[0]||{name:"",address:"",areaId:""}},env);
  const token=randomId("application_submit");
  const now = Date.now();
  const result = await db(env).batch([
    db(env).prepare("UPDATE coach_applications SET status='pending',submitted_at=?,review_note=NULL,review_token=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('draft','rejected') AND review_token IS ?").bind(now,token, now, id, identity.userId,item.review_token??null),
    db(env).prepare("INSERT INTO coach_application_events(id,application_id,actor,event_type,detail_json,created_at) SELECT ?,id,?,'submitted','{}',? FROM coach_applications WHERE id=? AND status='pending' AND review_token=?").bind(randomId("application_event"), `user:${identity.userId}`, now, id,token),
  ]);
  if (!result[0].meta.changes) throw new ApiError(409, "coach_application_conflict", "申请状态已变化，请刷新后重试");
  return { id, status: "pending" as const };
}

export async function withdrawCoachApplicationD1(identity: StudentIdentity, id: string, env: ApiEnv) {
  const now = Date.now(); const database = db(env);
  const token=randomId("application_withdraw");
  const result = await database.batch([
    database.prepare("UPDATE coach_applications SET status='withdrawn',review_token=?,updated_at=? WHERE id=? AND user_id=? AND status='pending'").bind(token,now, id, identity.userId),
    database.prepare("INSERT INTO coach_application_events(id,application_id,actor,event_type,detail_json,created_at) SELECT ?,id,?,'withdrawn','{}',? FROM coach_applications WHERE id=? AND status='withdrawn' AND review_token=?").bind(randomId("application_event"), `user:${identity.userId}`, now, id,token),
  ]);
  if (!result[0].meta.changes) throw new ApiError(409, "coach_application_not_withdrawable", "该申请当前不能撤回");
  return { id, status: "withdrawn" as const };
}

export async function listOperatorCoachApplicationsD1(status: string | null, env: ApiEnv) {
  const allowed = new Set<ApplicationStatus>(["draft", "pending", "approved", "rejected", "withdrawn"]);
  if (status && !allowed.has(status as ApplicationStatus)) throw new ApiError(422, "invalid_application_status", "申请状态无效");
  const result = status
    ? await db(env).prepare("SELECT id FROM coach_applications WHERE status=? ORDER BY submitted_at DESC,created_at DESC LIMIT 200").bind(status).all<Row>()
    : await db(env).prepare("SELECT id FROM coach_applications ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,submitted_at DESC,created_at DESC LIMIT 200").all<Row>();
  return Promise.all(rows(result).map((row) => applicationDetail(stringValue(row.id), env)));
}

async function copyApplicationObject(env: ApiEnv, source: string, destination: string) {
  const object = await env.MEDIA!.get(source);
  if (!object) throw new ApiError(409, "application_media_missing", "申请资料文件缺失，请申请人重新上传");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const contentType = headers.get("content-type") || undefined;
  await env.MEDIA!.put(destination, object.body, {
    customMetadata: object.customMetadata,
    httpMetadata: contentType ? { contentType } : undefined,
  });
}

export async function reviewCoachApplicationD1(id: string, decision: "approved" | "rejected", note: string, actor: string, requestId: string, env: ApiEnv) {
  if (!note.trim()) throw new ApiError(422, "review_note_required", "请填写审核意见");
  const item = await applicationDetail(id, env);
  if (item.status !== "pending") throw new ApiError(409, "coach_application_not_pending", "该申请已处理或不存在");
  const database = db(env); const now = Date.now();
  if (decision === "rejected") {
    const result = await database.batch([
      database.prepare("UPDATE coach_applications SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=?,review_token=?,updated_at=? WHERE id=? AND status='pending' AND review_token IS ?").bind(note.trim(), actor, now, requestId, now, id,item.review_token??null),
      database.prepare("INSERT INTO coach_application_events(id,application_id,actor,event_type,detail_json,created_at) SELECT ?,id,?,'rejected',?,? FROM coach_applications WHERE id=? AND review_token=? AND status='rejected'").bind(randomId("application_event"), actor, JSON.stringify({ note: note.trim() }), now, id, requestId),
      database.prepare("INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,request_id,created_at) SELECT ?,?,'coach.application.reject','coach_application',id,?,?,? FROM coach_applications WHERE id=? AND review_token=? AND status='rejected'").bind(randomId("audit"), actor, JSON.stringify({ note: note.trim() }), requestId, now, id, requestId),
    ]);
    if (!result[0].meta.changes) throw new ApiError(409, "coach_application_conflict", "申请状态已变化，请刷新后重试");
    return { id, status: decision };
  }
  if (!env.MEDIA) throw new ApiError(503, "media_unavailable", "资料存储暂时不可用");
  const sports = item.sports as Array<{ id: string; name: string; primary: number }>;
  const areas = item.areas as Array<{ id: string; cityId: ServiceCityId; name: string; primary: number }>;
  const venues = item.venues as Array<{ areaId: string; name: string; address: string }>;
  const primarySport = sports.find((entry) => entry.primary) ?? sports[0];
  const primaryArea = areas.find((entry) => entry.primary) ?? areas[0];
  if (!primarySport || !primaryArea || !venues[0]) throw new ApiError(422, "coach_application_incomplete", "申请项目、区域或场馆不完整");
  const mediaVersion = requestId.replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 80) || randomId("review");
  const avatarKey = `coaches/application-${id}/public/${mediaVersion}/avatar-v1`;
  const heroKey = `coaches/application-${id}/public/${mediaVersion}/hero-v1`;
  const cardKey = `coaches/application-${id}/public/${mediaVersion}/card-v1`;
  const credentialKeys = jsonArray(item.credential_temp_keys_json);
  const promotedKeys = [avatarKey, heroKey, cardKey, ...credentialKeys.map((_, index) => `coaches/application-${id}/credentials/${mediaVersion}/${index + 1}`)];
  try {
    await copyApplicationObject(env, stringValue(item.avatar_temp_key), avatarKey);
    await copyApplicationObject(env, stringValue(item.hero_temp_key), heroKey);
    await copyApplicationObject(env, stringValue(item.hero_temp_key), cardKey);
    for (let index = 0; index < credentialKeys.length; index += 1) await copyApplicationObject(env, credentialKeys[index], promotedKeys[index + 3]);
    const statements: D1PreparedStatement[] = [
      database.prepare("UPDATE coach_applications SET status='approved',review_note=?,reviewed_by=?,reviewed_at=?,review_token=?,updated_at=? WHERE id=? AND status='pending' AND review_token IS ? AND NOT EXISTS(SELECT 1 FROM coaches WHERE user_id=coach_applications.user_id)").bind(note.trim(), actor, now, requestId, now, id,item.review_token??null),
      database.prepare(`INSERT INTO coaches(user_id,name,sport,city,district,level,title,bio,price_fen,trial_price_fen,rating_basis_points,lessons,review_count,experience_years,response_minutes,audience_json,goals_json,strengths_json,availability_summary_json,audit_status,avatar_object_key,hero_object_key,created_at,updated_at,profile_kind,listing_status,listing_reason,listing_changed_by,listing_changed_at,pricing_status,card_object_key,honors_json,credentials_json,motto,booking_enabled,public_verified_at)
        SELECT user_id,?, ?, ?, ?, '已审核教练', ?, ?, ?, ?,0,0,0,?,0,?,?,?,'[]','approved',?,?,?,?,'real','online','教练入驻审核通过',?,?, 'published',?,?,?,'',1,?
        FROM coach_applications WHERE id=? AND status='approved' AND review_token=? AND NOT EXISTS(SELECT 1 FROM coaches WHERE user_id=coach_applications.user_id)`)
        .bind(item.real_name, primarySport.name, cityName(primaryArea.cityId), primaryArea.name, item.title, item.bio, item.price_fen, item.trial_price_fen, item.experience_years, item.audience_json, item.goals_json, item.strengths_json, avatarKey, heroKey, now, now, actor, now, cardKey, item.honors_json, item.credentials_json, now, id, requestId),
      database.prepare("INSERT OR REPLACE INTO user_roles(user_id,role,status,granted_at,updated_at) SELECT a.user_id,'coach','active',?,? FROM coach_applications a JOIN coaches c ON c.user_id=a.user_id WHERE a.id=? AND a.review_token=?").bind(now, now, id, requestId),
    ];
    for (const sport of sports) statements.push(database.prepare("INSERT INTO coach_sports(coach_id,sport_id,is_primary,created_at) SELECT c.id,?,?,? FROM coaches c JOIN coach_applications a ON a.user_id=c.user_id WHERE a.id=? AND a.review_token=?").bind(sport.id, sport.primary ? 1 : 0, now, id, requestId));
    for (const area of areas) statements.push(database.prepare("INSERT INTO coach_service_areas(coach_id,area_id,is_primary,created_at) SELECT c.id,?,?,? FROM coaches c JOIN coach_applications a ON a.user_id=c.user_id WHERE a.id=? AND a.review_token=?").bind(area.id, area.primary ? 1 : 0, now, id, requestId));
    for (const venue of venues) {
      const area = areas.find((entry) => entry.id === venue.areaId)!;
      statements.push(database.prepare("INSERT INTO venues(id,coach_id,name,address,city,district,active,created_at,updated_at) SELECT ?,c.id,?,?,?,?,1,?,? FROM coaches c JOIN coach_applications a ON a.user_id=c.user_id WHERE a.id=? AND a.review_token=?").bind(randomId("venue"), venue.name, venue.address, cityName(area.cityId), area.name, now, now, id, requestId));
    }
    const credentialLabels = jsonArray(item.credentials_json);
    for (let index = 0; index < credentialKeys.length; index += 1) statements.push(database.prepare("INSERT INTO coach_credentials(id,coach_id,credential_type,label,object_key,status,verified_at,reviewed_by,created_at) SELECT ?,c.id,'application',?,?,'approved',?,?,? FROM coaches c JOIN coach_applications a ON a.user_id=c.user_id WHERE a.id=? AND a.review_token=?").bind(randomId("credential"), credentialLabels[index] || `证明材料 ${index + 1}`, promotedKeys[index + 3], now, actor, now, id, requestId));
    statements.push(
      database.prepare("UPDATE coach_applications SET created_coach_id=(SELECT c.id FROM coaches c WHERE c.user_id=coach_applications.user_id),updated_at=? WHERE id=? AND review_token=? AND status='approved'").bind(now, id, requestId),
      database.prepare("INSERT INTO coach_status_events(id,coach_id,event_type,from_status,to_status,reason,actor,created_at) SELECT ?,c.id,'application','pending','approved',?,?,? FROM coaches c JOIN coach_applications a ON a.user_id=c.user_id WHERE a.id=? AND a.review_token=?").bind(randomId("coach_event"), note.trim(), actor, now, id, requestId),
      database.prepare("INSERT INTO coach_application_events(id,application_id,actor,event_type,detail_json,created_at) SELECT ?,id,?,'approved',?,? FROM coach_applications WHERE id=? AND review_token=?").bind(randomId("application_event"), actor, JSON.stringify({ note: note.trim() }), now, id, requestId),
      database.prepare("INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,request_id,created_at) SELECT ?,?,'coach.application.approve','coach_application',id,?,?,? FROM coach_applications WHERE id=? AND review_token=?").bind(randomId("audit"), actor, JSON.stringify({ autoPublished: true }), requestId, now, id, requestId),
    );
    const result = await database.batch(statements);
    if (!result[0].meta.changes) throw new ApiError(409, "coach_application_conflict", "账号已绑定教练或申请状态已变化");
  } catch (error) {
    await Promise.all(promotedKeys.map((key) => env.MEDIA!.delete(key).catch(() => undefined)));
    throw error;
  }
  return { coachId: numberValue((await database.prepare("SELECT created_coach_id FROM coach_applications WHERE id=?").bind(id).first<Row>())?.created_coach_id), id, status: decision, autoPublished: true };
}

export function supportedSports() { return [...SUPPORTED_SPORTS]; }
export function supportedAreas(cityId: ServiceCityId) { return [...SERVICE_AREAS[cityId]]; }
export function validateCityDistrict(cityId: string, district: string) { return isServiceCity(cityId) && isServiceArea(cityId, district); }
