"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  HardDriveDownload,
  LoaderCircle,
  PauseCircle,
  RefreshCw,
  Send,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatBeijingDate, formatFen, platformRequest } from "./platform-client";
import styles from "./platform-pages.module.css";

export type OpsSection = "home" | "matching" | "coaches" | "bookings" | "users" | "content" | "releases";
type Row = Record<string, unknown>;
type Overview = { bookings: Row[]; coaches: Row[]; leads: Row[]; pushDeliveries: Row[]; users: Row[] };

function count(rows: Row[], status?: string) {
  return rows.filter((row) => !status || row.status === status).reduce((sum, row) => sum + Number(row.count || 0), 0);
}

function useOpsData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await platformRequest<T>(path)); setError(""); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "运营数据暂时不可用"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => {
    let active = true;
    void platformRequest<T>(path)
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "运营数据暂时不可用"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);
  return { data, error, load, loading };
}

export function OpsPage({ section }: { section: OpsSection }) {
  if (section === "matching") return <LeadCenter />;
  if (section === "coaches") return <CoachOperations />;
  if (section === "bookings") return <BookingOperations />;
  if (section === "users") return <UserOperations />;
  if (section === "content") return <ContentOperations />;
  if (section === "releases") return <ReleaseCenter />;
  return <OpsHome />;
}

function Heading({ action, copy, title }: { action?: React.ReactNode; copy: string; title: string }) {
  return <header className={styles.heading}><div><p className={styles.eyebrow}>运营模式</p><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function OpsHome() {
  const state = useOpsData<Overview>("/api/v1/operator/overview");
  if (state.loading) return <Loading label="正在汇总运营数据" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const failedPush = count(state.data.pushDeliveries, "failed");
  return <div className={styles.page}>
    <Heading action={<Link className={styles.primary} href="/ops/matching">处理服务线索 <ArrowRight aria-hidden size={16} /></Link>} copy="这里仅汇总真实业务数据。试点初期数字为零是正常状态，不使用虚构规模填充。" title="北京试点运营概览" />
    <section className={styles.metrics}>
      <article><span>新服务线索</span><strong>{count(state.data.leads, "new")}</strong><small>等待首次联系</small></article>
      <article><span>待确认预约</span><strong>{count(state.data.bookings, "pending_coach")}</strong><small>等待教练处理</small></article>
      <article><span>已上线教练</span><strong>{count(state.data.coaches, "approved")}</strong><small>通过人工审核</small></article>
      <article><span>推送失败</span><strong>{failedPush}</strong><small>需要检查或重试</small></article>
    </section>
    <div className={styles.split}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>服务流转</h2><p>从咨询到完成课程的实时状态</p></div></header><div className={styles.list}>
        <Link className={styles.listItem} href="/ops/matching"><span className={styles.listIcon}><UsersRound aria-hidden size={19} /></span><div><h3>服务线索</h3><p>{count(state.data.leads)} 条累计线索，{count(state.data.leads, "qualified")} 条已确认有效</p></div><ArrowRight aria-hidden size={16} /></Link>
        <Link className={styles.listItem} href="/ops/bookings"><span className={styles.listIcon}><CalendarCheck2 aria-hidden size={19} /></span><div><h3>预约履约</h3><p>{count(state.data.bookings)} 条预约，{count(state.data.bookings, "completed")} 条已完成</p></div><ArrowRight aria-hidden size={16} /></Link>
        <Link className={styles.listItem} href="/ops/users"><span className={styles.listIcon}><UserRoundCheck aria-hidden size={19} /></span><div><h3>注册用户</h3><p>{count(state.data.users)} 个有效账号</p></div><ArrowRight aria-hidden size={16} /></Link>
      </div></section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>服务健康</h2><p>需要人工关注的事项</p></div></header><div className={styles.list}>
        <div className={styles.listItem}><span className={styles.listIcon}><Send aria-hidden size={19} /></span><div><h3>原生推送</h3><p>{failedPush ? `${failedPush} 条推送失败，建议查看投递日志` : "当前没有失败记录"}</p></div><em className={styles.status} data-tone={failedPush ? "coral" : "green"}>{failedPush ? "需处理" : "正常"}</em></div>
        <Link className={styles.listItem} href="/ops/releases"><span className={styles.listIcon}><HardDriveDownload aria-hidden size={19} /></span><div><h3>Android 版本</h3><p>查看灰度、暂停和通知状态</p></div><ArrowRight aria-hidden size={16} /></Link>
      </div></aside>
    </div>
  </div>;
}

type Lead = { id: string; contact_email?: string; contact_name?: string; sport?: string; district?: string; goal?: string; source?: string; status?: string; assigned_to?: string; note?: string; coach_name?: string; created_at?: number };
const leadStatus: Record<string, string> = { closed: "已关闭", contacted: "已联系", new: "新线索", qualified: "有效需求" };

function LeadCenter() {
  const state = useOpsData<Lead[]>("/api/v1/operator/leads");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  if (state.loading) return <Loading label="正在读取服务线索" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const rows = state.data.filter((lead) => `${lead.contact_name}${lead.contact_email}${lead.sport}${lead.district}${lead.goal}${lead.coach_name}`.includes(query.trim()));
  async function update(id: string, status: string) { setBusy(id); try { await platformRequest(`/api/v1/operator/leads/${encodeURIComponent(id)}`, { body: { status }, method: "PATCH" }); setNotice("线索状态已更新"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); } finally { setBusy(""); } }
  return <div className={styles.page}><Heading action={<div className={styles.toolbar}><input aria-label="搜索线索" onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、邮箱、项目或区域" value={query} /></div>} copy="官网提交的咨询会进入这里，由运营人员联系、确认需求并完成分流。" title="服务线索" /><section className={styles.panel}>{rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>联系人</span><span>训练需求</span><span>区域与来源</span><span>状态</span><span>操作</span></div>{rows.map((lead) => <article className={styles.tableRow} key={lead.id}><span><strong>{lead.contact_name || "未填写称呼"}</strong><small>{lead.contact_email || "未提供邮箱"}</small></span><span><strong>{lead.sport || "项目待确认"}{lead.coach_name ? ` · ${lead.coach_name}教练` : ""}</strong><small>{lead.goal || "目标待补充"}</small></span><span><strong>{lead.district || "北京"}</strong><small>{lead.source || "web"} · {formatBeijingDate(lead.created_at)}</small></span><span><em className={styles.status} data-tone={lead.status === "new" ? "amber" : lead.status === "closed" ? "gray" : "green"}>{leadStatus[lead.status || "new"] || lead.status}</em></span><span className={styles.rowActions}><button className={styles.secondary} disabled={busy === lead.id} onClick={() => void update(lead.id, "contacted")} type="button">标记已联系</button><button className={styles.primary} disabled={busy === lead.id} onClick={() => void update(lead.id, "qualified")} type="button">确认需求</button><button className={styles.danger} disabled={busy === lead.id} onClick={() => void update(lead.id, "closed")} type="button">关闭</button></span></article>)}</div> : <Empty copy="官网访客提交训练咨询后，会以真实线索进入这里。" title="暂无服务线索" />}</section>{notice ? <Toast copy={notice} /> : null}</div>;
}

type OpsCoach = { id: number; name?: string; sport?: string; district?: string; title?: string; audit_status?: string; review_count?: number; lessons?: number; pending_credentials?: number; open_slots?: number; user_id?: string; updated_at?: number };
function CoachOperations() {
  const state = useOpsData<OpsCoach[]>("/api/v1/operator/coaches");
  const [busy, setBusy] = useState(0);
  const [notice, setNotice] = useState("");
  if (state.loading) return <Loading label="正在读取教练档案" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  async function setStatus(id: number, status: string) { setBusy(id); try { await platformRequest(`/api/v1/operator/coaches/${id}/status`, { body: { status }, method: "PATCH" }); setNotice("教练审核状态已更新"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); } finally { setBusy(0); } }
  return <div className={styles.page}><Heading copy="审核状态决定公开展示与教练权限；评价、课量和资质不会在运营端伪造。" title="教练管理" /><section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>教练</span><span>服务区域</span><span>业务状态</span><span>审核状态</span><span>操作</span></div>{state.data.map((coach) => <article className={styles.tableRow} key={coach.id}><span><strong>{coach.name || `教练 #${coach.id}`}</strong><small>{coach.sport} · {coach.title}</small></span><span><strong>{coach.district || "未设置"}</strong><small>{coach.open_slots || 0} 个开放时段</small></span><span><strong>{coach.review_count || 0} 条评价</strong><small>{coach.lessons || 0} 节已完成课程</small></span><span><em className={styles.status} data-tone={coach.audit_status === "approved" ? "green" : coach.audit_status === "suspended" ? "coral" : "amber"}>{coach.audit_status === "approved" ? "已上线" : coach.audit_status === "suspended" ? "已暂停" : coach.audit_status || "待审核"}</em><small>{coach.user_id ? "已绑定账号" : "未绑定账号"}</small></span><span className={styles.rowActions}>{coach.audit_status === "approved" ? <button className={styles.danger} disabled={busy === coach.id} onClick={() => void setStatus(coach.id, "suspended")} type="button">暂停服务</button> : <button className={styles.primary} disabled={busy === coach.id} onClick={() => void setStatus(coach.id, "approved")} type="button">批准上线</button>}</span></article>)}</div> : <Empty copy="导入并审核教练档案后，数据会出现在这里。" title="暂无教练档案" />}</section>{notice ? <Toast copy={notice} /> : null}</div>;
}

type OpsBooking = { id: string; status?: string; fee_fen?: number; payment_status?: string; note?: string; learner_name?: string; coach_name?: string; sport?: string; venue_name?: string; starts_at?: number; ends_at?: number; created_at?: number };
function BookingOperations() {
  const state = useOpsData<OpsBooking[]>("/api/v1/operator/bookings");
  if (state.loading) return <Loading label="正在读取预约履约数据" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  return <div className={styles.page}><Heading copy="集中查看预约状态、时间、场馆与线下收款结果。业务状态只能由对应角色按规则流转。" title="预约履约" /><section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>预约</span><span>服务双方</span><span>时间与场馆</span><span>费用</span><span>状态</span></div>{state.data.map((booking) => <article className={styles.tableRow} key={booking.id}><span><strong>#{booking.id.slice(-8)}</strong><small>{booking.sport || "专项训练"}</small></span><span><strong>{booking.learner_name || "学员"}</strong><small>{booking.coach_name || "教练"}</small></span><span><strong>{formatBeijingDate(booking.starts_at)}</strong><small>{booking.venue_name || "场馆待确认"}</small></span><span><strong>{formatFen(booking.fee_fen)}</strong><small>{booking.payment_status === "offline_paid" ? "线下已收款" : "线下待支付"}</small></span><span><em className={styles.status} data-tone={booking.status === "completed" || booking.status === "confirmed" ? "green" : booking.status === "pending_coach" ? "amber" : "gray"}>{booking.status || "未知"}</em></span></article>)}</div> : <Empty copy="真实预约提交后会进入履约视图。" title="暂无预约记录" />}</section></div>;
}

type OpsUser = { id: string; email_domain?: string; phone_last4?: string; status?: string; roles?: string; booking_count?: number; created_at?: number };
function UserOperations() {
  const state = useOpsData<OpsUser[]>("/api/v1/operator/users");
  const [query, setQuery] = useState("");
  if (state.loading) return <Loading label="正在读取用户服务数据" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const rows = state.data.filter((user) => `${user.id}${user.email_domain}${user.phone_last4}${user.roles}`.includes(query.trim()));
  return <div className={styles.page}><Heading action={<div className={styles.toolbar}><input aria-label="搜索用户" onChange={(event) => setQuery(event.target.value)} placeholder="搜索账号或角色" value={query} /></div>} copy="按最小展示原则仅提供脱敏联系方式、角色和服务计数。" title="用户服务" /><section className={styles.panel}>{rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>账号</span><span>联系方式</span><span>角色</span><span>预约</span><span>状态</span></div>{rows.map((user) => <article className={styles.tableRow} key={user.id}><span><strong>#{user.id.slice(-8)}</strong><small>{formatBeijingDate(user.created_at)}</small></span><span><strong>{user.email_domain ? `***@${user.email_domain}` : user.phone_last4 ? `*** ${user.phone_last4}` : "未提供"}</strong><small>已脱敏</small></span><span><strong>{user.roles || "student"}</strong><small>服务端授权</small></span><span><strong>{user.booking_count || 0} 条</strong><small>累计预约</small></span><span><em className={styles.status} data-tone={user.status === "active" ? "green" : "gray"}>{user.status === "active" ? "正常" : user.status || "未知"}</em></span></article>)}</div> : <Empty copy="完成邮箱验证或 Sites 身份登录后，账号会进入这里。" title="暂无注册用户" />}</section></div>;
}

type ContentDocument = { id: string; slug?: string; title?: string; audience?: string; status?: string; active_version_id?: string; latest_version?: number; updated_at?: number };
function ContentOperations() {
  const state = useOpsData<ContentDocument[]>("/api/v1/operator/content");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  if (state.loading) return <Loading label="正在读取内容版本" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { const result = await platformRequest<{ documentId: string; versionId: string }>("/api/v1/operator/content", { body: { audience: form.get("audience"), body: form.get("body"), slug: form.get("slug"), title: form.get("title") }, method: "POST" }); await platformRequest(`/api/v1/operator/content/${encodeURIComponent(result.documentId)}/publish`, { body: { versionId: result.versionId }, method: "POST" }); setNotice("新版本已保存并发布"); event.currentTarget.reset(); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "发布失败"); } finally { setBusy(false); } }
  return <div className={styles.page}><Heading copy="协议与规则使用不可变版本记录；每次发布都保留操作人和时间。" title="内容与协议" /><div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>已管理内容</h2><p>{state.data.length} 份文档</p></div></header>{state.data.length ? <div className={styles.list}>{state.data.map((doc) => <article className={styles.listItem} key={doc.id}><span className={styles.listIcon}><FileCheck2 aria-hidden size={19} /></span><div><h3>{doc.title || doc.slug}</h3><p>v{doc.latest_version || 0} · {doc.audience || "public"} · {formatBeijingDate(doc.updated_at)}</p></div><em className={styles.status} data-tone={doc.status === "published" ? "green" : "gray"}>{doc.status === "published" ? "已发布" : "草稿"}</em></article>)}</div> : <Empty copy="创建服务协议、隐私说明或取消规则的第一个版本。" title="暂无内容文档" />}</section><aside className={styles.panel}><header className={styles.panelHeader}><div><h2>发布新版本</h2><p>发布后立即成为当前有效版本</p></div></header><form className={styles.form} onSubmit={save}><label className={styles.field}><span>标题</span><input maxLength={120} name="title" required /></label><label className={styles.field}><span>固定标识</span><input maxLength={80} name="slug" pattern="[a-z0-9-]+" placeholder="privacy-policy" required /></label><label className={styles.field}><span>适用对象</span><select name="audience"><option value="public">公开</option><option value="student">学员</option><option value="coach">教练</option></select></label><label className={styles.field}><span>正文</span><textarea maxLength={50000} name="body" required /></label><button className={styles.primary} disabled={busy} type="submit">保存并发布</button></form></aside></div>{notice ? <Toast copy={notice} /> : null}</div>;
}

type Release = { artifactPresent: boolean; certificateSha256: string; forced: boolean; minimumSupportedVersionCode: number; notes: string[]; publishedAt: number; rolloutPercentage: number; sha256: string; sizeBytes: number; status: "draft" | "paused" | "published"; updatedAt: number; versionCode: number; versionName: string };
async function releaseRequest<T>(method: "GET" | "POST" | "PUT", body?: BodyInit) {
  const response = await fetch("/api/ops/releases", { body, cache: "no-store", method });
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message || "版本服务暂时不可用");
  return payload.data;
}

function ReleaseCenter() {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [artifact, setArtifact] = useState<File | null>(null);
  const load = useCallback(async () => { try { setReleases(await releaseRequest<Release[]>("GET")); setError(""); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "版本中心暂时不可用"); setReleases([]); } }, []);
  useEffect(() => {
    let active = true;
    void releaseRequest<Release[]>("GET")
      .then((result) => { if (active) { setReleases(result); setError(""); } })
      .catch((loadError: unknown) => { if (active) { setError(loadError instanceof Error ? loadError.message : "版本中心暂时不可用"); setReleases([]); } });
    return () => { active = false; };
  }, []);
  const nextCode = useMemo(() => Math.max(0, ...(releases || []).map((release) => release.versionCode)) + 1, [releases]);
  async function act(release: Release, action: "notify" | "pause" | "publish") { setBusy(`${release.versionCode}-${action}`); try { await releaseRequest("POST", JSON.stringify({ action, versionCode: release.versionCode })); setNotice(action === "notify" ? "版本通知任务已创建" : action === "pause" ? "版本已暂停" : "版本已发布"); await load(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "操作失败"); } finally { setBusy(""); } }
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!artifact) { setError("请选择正式签名 APK"); return; } const form = new FormData(event.currentTarget); const versionCode = Number(form.get("versionCode")); const versionName = String(form.get("versionName")); setBusy("create"); try { await releaseRequest("POST", JSON.stringify({ action: "create", release: { certificateSha256: form.get("certificateSha256"), forced: false, minimumSupportedVersionCode: Number(form.get("minimumSupportedVersionCode")), notes: String(form.get("notes") || "").split("\n").filter(Boolean), rolloutPercentage: Number(form.get("rolloutPercentage")), sha256: form.get("sha256"), sizeBytes: artifact.size, versionCode, versionName } })); const upload = new FormData(); upload.set("artifact", artifact); upload.set("versionCode", String(versionCode)); upload.set("versionName", versionName); await releaseRequest("PUT", upload); setNotice("版本清单和 APK 已写入私有存储"); setArtifact(null); event.currentTarget.reset(); await load(); } catch (createError) { setError(createError instanceof Error ? createError.message : "版本创建失败"); } finally { setBusy(""); } }
  return <div className={styles.page}><Heading copy="APK 保存在私有 R2，下载需要短时票据；发布、暂停和通知均写入真实版本数据。" title="Android 版本发布" />{error ? <div className={styles.error} role="alert"><AlertTriangle aria-hidden size={25} /><strong>版本操作未完成</strong><p>{error}</p></div> : null}<div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>版本记录</h2><p>{releases ? `${releases.length} 个构建` : "正在读取"}</p></div></header>{releases === null ? <Loading label="读取版本记录" /> : releases.length ? <div className={styles.list}>{releases.map((release) => <article className={styles.listItem} key={release.versionCode}><span className={styles.listIcon}><HardDriveDownload aria-hidden size={19} /></span><div><h3>{release.versionName} · code {release.versionCode}</h3><p>{release.status === "published" ? `已发布 ${release.rolloutPercentage}%` : release.status === "paused" ? "已暂停分发" : "草稿"} · {(release.sizeBytes / 1024 / 1024).toFixed(1)} MB · {release.artifactPresent ? "APK 已存储" : "缺少 APK"}</p></div><span className={styles.rowActions}>{release.status !== "published" ? <button className={styles.primary} disabled={Boolean(busy) || !release.artifactPresent} onClick={() => void act(release, "publish")} type="button">发布</button> : <><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => void act(release, "notify")} type="button"><Send aria-hidden size={15} />通知</button><button className={styles.danger} disabled={Boolean(busy)} onClick={() => void act(release, "pause")} type="button"><PauseCircle aria-hidden size={15} />暂停</button></>}</span></article>)}</div> : <Empty copy="上传第一个使用长期证书签名的 APK。" title="暂无版本记录" />}</section><aside className={styles.panel}><header className={styles.panelHeader}><div><h2>创建发布</h2><p>清单校验后写入私有 R2</p></div></header><form className={styles.form} onSubmit={create}><div className={styles.formGrid}><label className={styles.field}><span>版本号</span><input defaultValue="1.2.7" name="versionName" pattern="\d+\.\d+\.\d+" required /></label><label className={styles.field}><span>versionCode</span><input defaultValue={nextCode} min={1} name="versionCode" type="number" required /></label><label className={styles.field}><span>最低支持 code</span><input defaultValue={5} min={1} name="minimumSupportedVersionCode" type="number" required /></label><label className={styles.field}><span>灰度比例</span><select defaultValue="100" name="rolloutPercentage"><option value="10">10%</option><option value="50">50%</option><option value="100">100%</option></select></label></div><label className={styles.field}><span>APK SHA-256</span><input minLength={64} name="sha256" required /></label><label className={styles.field}><span>证书 SHA-256</span><input name="certificateSha256" required /></label><label className={styles.field}><span>更新说明</span><textarea name="notes" required /></label><label className={styles.field}><span>正式签名 APK</span><input accept=".apk,application/vnd.android.package-archive" onChange={(event) => setArtifact(event.target.files?.[0] || null)} required type="file" /></label><button className={styles.primary} disabled={busy === "create"} type="submit"><UploadCloud aria-hidden size={16} />{busy === "create" ? "写入中" : "创建并上传"}</button></form></aside></div>{notice ? <Toast copy={notice} /> : null}</div>;
}

function Toast({ copy }: { copy: string }) { return <div className={styles.notice} role="status"><CheckCircle2 aria-hidden size={17} />{copy}</div>; }
function Empty({ copy, title }: { copy: string; title: string }) { return <div className={styles.empty}><Sparkles aria-hidden size={28} /><strong>{title}</strong><p>{copy}</p></div>; }
function Loading({ label }: { label: string }) { return <div className={styles.loading}><LoaderCircle aria-hidden size={27} /><span>{label}</span></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>运营数据暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>; }
