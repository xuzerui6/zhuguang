import { ApiError, type ApiEnv } from './contracts';
import { randomId } from './security';

export type DataClassification = 'production_eligible' | 'qa' | 'unclassified' | 'excluded' | 'all';
const tables = { user: 'users', booking: 'booking_requests', coach: 'coaches', review: 'coach_reviews', support_ticket: 'support_tickets', service_lead: 'service_leads', product_event: 'product_events' } as const;
type EntityType = keyof typeof tables;
export function parseClassification(value?: string | null): DataClassification {
  const classification = value || 'production_eligible';
  if (!['production_eligible','qa','unclassified','excluded','all'].includes(classification)) throw new ApiError(422,'invalid_classification','数据分类无效');
  return classification as DataClassification;
}
export function classificationSql(type: EntityType, alias: string) {
  return `coalesce((SELECT m.classification FROM entity_metric_classifications m WHERE m.entity_type='${type}' AND m.entity_id=CAST(${alias}.id AS TEXT)),'unclassified')`;
}
export function classificationFilter(type: EntityType, alias: string) { return `(?='all' OR ${classificationSql(type,alias)}=?)`; }

export function leadQueueSelection(selected?: string | null, view?: string | null) {
  if (view && (view !== 'work_queue' || selected != null)) throw new ApiError(422, 'invalid_lead_view', '工作队列与精确分类不能同时选择');
  const classification = view ? null : parseClassification(selected);
  return { classification, sql: view ? `${classificationSql('service_lead','l')} IN ('production_eligible','unclassified')` : classificationFilter('service_lead','l'), bindings: classification ? [classification, classification] : [] };
}

export async function classificationCounts(env: ApiEnv) {
  if (!env.DB) throw new ApiError(503,'database_unavailable','业务数据库暂时不可用');
  const result = await Promise.all(Object.entries(tables).map(async ([type,table]) => {
    const counts = await env.DB!.prepare(`SELECT ${classificationSql(type as EntityType,'e')} AS classification,count(*) AS count FROM ${table} e GROUP BY classification`).all();
    return { entityType:type, counts:counts.results ?? [] };
  }));
  return result;
}

export async function classifyMetricEntityD1(entityType: string, entityId: string, classification: string, reason: string, actor: string, requestId: string, env: ApiEnv, expectedEventId?: string | null) {
  if (!Object.hasOwn(tables,entityType) || !['unclassified','qa','production_eligible','excluded'].includes(classification) || (entityType==='product_event' && classification==='excluded')) throw new ApiError(422,'invalid_metric_classification','指标分类参数无效');
  if (reason.trim().length<4 || reason.length>500) throw new ApiError(422,'reason_required','请填写4至500字的分类原因');
  const database=env.DB;
  if (!database) throw new ApiError(503,'database_unavailable','业务数据库暂时不可用');
  const table=tables[entityType as EntityType];
  const existing=await database.prepare(`SELECT e.id,m.last_event_id,m.classification FROM ${table} e LEFT JOIN entity_metric_classifications m ON m.entity_type=? AND m.entity_id=CAST(e.id AS TEXT) WHERE CAST(e.id AS TEXT)=?`).bind(entityType,entityId).first<{last_event_id:string|null;classification:string|null}>();
  if (!existing) throw new ApiError(404,'metric_entity_not_found','未找到要分类的记录');
  if (expectedEventId !== undefined && expectedEventId !== existing.last_event_id) throw new ApiError(409,'classification_conflict','记录分类已变化，请刷新后重试');
  const now=Date.now(); const eventId=randomId('metric_event');
  const guard='EXISTS (SELECT 1 FROM entity_metric_classifications WHERE last_event_id=?)';
  const statements=[database.prepare(`INSERT INTO entity_metric_classifications(entity_type,entity_id,classification,last_event_id,updated_at)
    SELECT ?,CAST(id AS TEXT),?,?,? FROM ${table} WHERE CAST(id AS TEXT)=? AND coalesce((SELECT last_event_id FROM entity_metric_classifications WHERE entity_type=? AND entity_id=?),'')=?
    ON CONFLICT(entity_type,entity_id) DO UPDATE SET classification=excluded.classification,last_event_id=excluded.last_event_id,updated_at=excluded.updated_at`).bind(entityType,classification,eventId,now,entityId,entityType,entityId,existing.last_event_id || '')];
  if (entityType==='user' || entityType==='product_event') statements.push(database.prepare(`UPDATE ${table} SET data_classification=? WHERE id=? AND ${guard}`).bind(classification,entityId,eventId));
  if (entityType==='booking') statements.push(database.prepare(`UPDATE booking_requests SET metric_eligible=? WHERE id=? AND ${guard}`).bind(classification==='production_eligible'?1:0,entityId,eventId));
  if (entityType==='coach') statements.push(database.prepare(`UPDATE coaches SET public_verified_at=? WHERE id=? AND ${guard}`).bind(classification==='production_eligible'?now:null,entityId,eventId));
  statements.push(database.prepare(`INSERT INTO metric_classification_events(id,entity_type,entity_id,classification,reason,actor,request_id,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(eventId,entityType,entityId,classification,reason.trim(),actor,requestId,now,eventId));
  statements.push(database.prepare(`INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,request_id,created_at) SELECT ?,?,'data.classify',?,?,?,?,? WHERE ${guard}`).bind(randomId('audit'),actor,entityType,entityId,JSON.stringify({before:existing.classification||'unclassified',after:classification,reason:reason.trim()}),requestId,now,eventId));
  const result=await database.batch(statements);
  if (!result[0].meta.changes) throw new ApiError(409,'classification_conflict','记录分类已变化，请刷新后重试');
  return {classification,entityId,entityType};
}
