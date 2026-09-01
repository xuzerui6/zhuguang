"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Eye,
  EyeOff,
  HardDriveDownload,
  History,
  LockKeyhole,
  MapPin,
  PauseCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BEIJING_DISTRICTS, SPORT_OPTIONS } from "../../shared/coach-catalog";
import type { CoachVenue, OperatorCoachBusinessSettings } from "../mobile/types";
import { formatBeijingDate, formatFen, platformRequest } from "./platform-client";
import styles from "./platform-pages.module.css";
import { LoadingState } from "./async-states";

export type OpsSection = "home" | "matching" | "coaches" | "profile-reviews" | "bookings" | "users" | "reviews" | "support" | "content" | "audit" | "releases";
type Row = Record<string, unknown>;
type Overview = { bookings: Row[]; coaches: Row[]; leads: Row[]; pushDeliveries: Row[]; users: Row[] };

function count(rows: Row[], status?: string) {
  return rows.filter((row) => !status || row.status === status).reduce((sum, row) => sum + Number(row.count || 0), 0);
}

function useOpsData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const hasData = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    try { setData(await platformRequest<T>(path)); hasData.current = true; setError(""); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "运营数据暂时不可用"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => {
    let active = true;
    void platformRequest<T>(path)
      .then((result) => { if (active) { setData(result); hasData.current = true; setError(""); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "运营数据暂时不可用"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);
  return { data, error, load, loading };
}

export function OpsPage({ section }: { section: OpsSection }) {
  if (section === "matching") return <LeadCenter />;
  if (section === "coaches") return <CoachOperations />;
  if (section === "profile-reviews") return <ProfileReviewCenter />;
  if (section === "bookings") return <BookingOperations />;
  if (section === "users") return <UserOperations />;
  if (section === "reviews") return <ReviewModeration />;
  if (section === "support") return <SupportCenter />;
  if (section === "content") return <ContentOperations />;
  if (section === "audit") return <AuditLogPage />;
  if (section === "releases") return <ReleaseCenter />;
  return <OpsHome />;
}

function Heading({ action, copy, title }: { action?: React.ReactNode; copy: string; title: string }) {
  return <header className={styles.heading}><div><p className={styles.eyebrow}>运营模式</p><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function OpsHome() {
  const state = useOpsData<Overview>("/api/v1/operator/overview");
  const funnel = useOpsData<Row[]>("/api/v1/operator/analytics/funnel");
  if (state.loading) return <Loading label="正在汇总运营数据" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const failedPush = count(state.data.pushDeliveries, "failed");
  return <div className={styles.page}>
    <Heading action={<Link className={styles.primary} href="/ops/matching">处理服务线索 <ArrowRight aria-hidden size={16} /></Link>} copy="这里仅汇总真实业务数据。试点初期数字为零是正常状态，不使用虚构规模填充。" title="北京试点运营概览" />
    <section className={styles.metrics}>
      <article><span>新服务线索</span><strong>{count(state.data.leads, "new")}</strong><small>等待首次联系</small></article>
      <article><span>待确认预约</span><strong>{count(state.data.bookings, "pending_coach")}</strong><small>等待教练处理</small></article>
      <article><span>已上线教练</span><strong>{count(state.data.coaches, "online")}</strong><small>当前公开展示</small></article>
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
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>近30天业务漏斗</h2><p>只统计匿名流程阶段，不采集姓名、联系方式或输入内容</p></div></header>{funnel.loading ? <Loading label="正在汇总匿名业务漏斗" /> : funnel.data?.length ? <div className={styles.table}><div className={styles.tableHead}><span>流程</span><span>阶段</span><span>结果</span><span>端与角色</span><span>次数</span></div>{funnel.data.map((item, index) => <article className={styles.tableRow} key={`${item.flow}-${item.step}-${item.outcome}-${index}`}><span><strong>{String(item.flow || "业务流程")}</strong><small>近30天</small></span><span><strong>{String(item.step || "阶段")}</strong><small>匿名事件</small></span><span><em className={styles.status} data-tone={item.outcome === "success" ? "green" : item.outcome === "error" ? "coral" : "gray"}>{String(item.outcome || "view")}</em></span><span><strong>{String(item.surface || "web")}</strong><small>{String(item.role || "anonymous")}</small></span><span><strong>{Number(item.count || 0)}</strong><small>次</small></span></article>)}</div> : <Empty copy="用户开始使用新版找教练和预约流程后，匿名阶段数据会出现在这里。" title="暂无漏斗数据" />}</section>
  </div>;
}

type Lead = {
  assigned_to?: string;
  coach_name?: string;
  contact_name?: string;
  created_at?: number;
  desired_time?: string;
  district?: string;
  goal?: string;
  has_email?: number;
  has_phone?: number;
  has_wechat?: number;
  id: string;
  lead_kind?: "student_inquiry" | "coach_partnership";
  learner_stage?: string;
  note?: string;
  source?: string;
  sport?: string;
  status?: string;
};
type LeadContact = { email?: string; phone?: string; wechat?: string };
const leadStatus: Record<string, string> = { closed: "已关闭", contacted: "已联系", new: "新线索", qualified: "有效需求" };
const leadKindLabel: Record<string, string> = { coach_partnership: "教练合作", student_inquiry: "学员咨询" };

function leadContactSummary(lead: Lead) {
  const channels = [lead.has_phone ? "手机号" : "", lead.has_wechat ? "微信" : "", lead.has_email ? "邮箱" : ""].filter(Boolean);
  return channels.length ? `已留${channels.join("、")}` : "未留联系方式";
}

function LeadCenter() {
  const state = useOpsData<Lead[]>("/api/v1/operator/leads");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [contact, setContact] = useState<LeadContact | null>(null);
  if (state.loading) return <Loading label="正在读取服务线索" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const rows = state.data.filter((lead) => (
    (kind === "all" || lead.lead_kind === kind)
    && (status === "all" || lead.status === status)
    && `${lead.contact_name}${lead.sport}${lead.district}${lead.goal}${lead.coach_name}${lead.learner_stage}`.includes(query.trim())
  ));
  async function update(id: string, status: string) { setBusy(id); try { await platformRequest(`/api/v1/operator/leads/${encodeURIComponent(id)}`, { body: { status }, method: "PATCH" }); setNotice("线索状态已更新"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); } finally { setBusy(""); } }
  async function reveal(lead: Lead) {
    setContactLead(lead);
    setContact(null);
    setBusy(`contact:${lead.id}`);
    try {
      setContact(await platformRequest<LeadContact>(`/api/v1/operator/service-leads/${encodeURIComponent(lead.id)}/contact-reveal`, { method: "POST" }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "联系方式读取失败");
      setContactLead(null);
    } finally { setBusy(""); }
  }
  function closeContact() { setContact(null); setContactLead(null); }
  return <div className={styles.page}>
    <Heading action={<div className={styles.toolbar}><input aria-label="搜索线索" onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、项目、区域或教练" value={query} /><select aria-label="线索类型" onChange={(event) => setKind(event.target.value)} value={kind}><option value="all">全部类型</option><option value="student_inquiry">学员咨询</option><option value="coach_partnership">教练合作</option></select><select aria-label="处理状态" onChange={(event) => setStatus(event.target.value)} value={status}><option value="all">全部状态</option>{Object.entries(leadStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>} copy="联系方式默认脱敏。每次查看都会重新校验最高权限并写入审计记录。" title="服务线索" />
    <section className={styles.panel}>{rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>联系人</span><span>需求与类型</span><span>区域与来源</span><span>状态</span><span>操作</span></div>{rows.map((lead) => <article className={styles.tableRow} key={lead.id}>
      <span><strong>{lead.contact_name || "未填写称呼"}</strong><small>{leadContactSummary(lead)}</small></span>
      <span><strong>{lead.sport || "项目待确认"}{lead.coach_name ? ` · ${lead.coach_name}教练` : ""}</strong><small>{leadKindLabel[lead.lead_kind || "student_inquiry"]} · {lead.learner_stage || "阶段待确认"} · {lead.goal || "目标待补充"}</small></span>
      <span><strong>{lead.district || "北京"}</strong><small>{lead.desired_time || "时间待沟通"} · {formatBeijingDate(lead.created_at)}</small></span>
      <span><em className={styles.status} data-tone={lead.status === "new" ? "amber" : lead.status === "closed" ? "gray" : "green"}>{leadStatus[lead.status || "new"] || lead.status}</em></span>
      <span className={styles.rowActions}><button className={styles.secondary} disabled={busy === `contact:${lead.id}`} onClick={() => void reveal(lead)} type="button"><LockKeyhole aria-hidden size={15} />查看联系方式</button><button className={styles.secondary} disabled={busy === lead.id} onClick={() => void update(lead.id, "contacted")} type="button">标记已联系</button><button className={styles.primary} disabled={busy === lead.id} onClick={() => void update(lead.id, "qualified")} type="button">确认需求</button><button className={styles.danger} disabled={busy === lead.id} onClick={() => void update(lead.id, "closed")} type="button">关闭</button></span>
    </article>)}</div> : <Empty copy="官网访客提交训练咨询或合作意向后，会以真实线索进入这里。" title="暂无服务线索" />}</section>
    {contactLead ? <div className={styles.confirmOverlay} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeContact(); }}><section aria-labelledby="lead-contact-title" aria-modal="true" className={styles.confirmDialog} role="dialog"><LockKeyhole aria-hidden size={24} /><h2 id="lead-contact-title">{contactLead.contact_name || "联系人"}的联系方式</h2><p>本次查看已经记录到审计日志。请只用于处理该条服务需求。</p>{contact ? <div className={styles.detailList}>{contact.phone ? <div><span>手机号</span><strong>{contact.phone}</strong></div> : null}{contact.wechat ? <div><span>微信号</span><strong>{contact.wechat}</strong></div> : null}{contact.email ? <div><span>邮箱</span><strong>{contact.email}</strong></div> : null}</div> : <LoadingState label="正在安全读取联系方式" variant="detail" />}<div className={styles.confirmActions}><button className={styles.primary} onClick={closeContact} type="button">完成</button></div></section></div> : null}
    {notice ? <Toast copy={notice} /> : null}
  </div>;
}

type OpsCoach = {
  audit_status?: string;
  district?: string;
  id: number;
  lessons?: number;
  listing_changed_at?: number;
  listing_changed_by?: string;
  listing_reason?: string;
  listing_status?: "online" | "offline";
  name?: string;
  pending_credentials?: number;
  pricing_status?: string;
  booking_enabled?: number;
  price_fen?: number;
  trial_price_fen?: number;
  profile_kind?: "real" | "demo";
  review_count?: number;
  sport?: string;
  title?: string;
  updated_at?: number;
  user_id?: string;
};

type CoachStatusEvent = { actor?: string; created_at?: number; event_type?: "audit" | "listing"; from_status?: string; id: string; reason?: string; to_status?: string };

function CoachOperations() {
  const state = useOpsData<OpsCoach[]>("/api/v1/operator/coaches");
  const [busy, setBusy] = useState(0);
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ audit: "all", district: "all", kind: "all", listing: "all", sport: "all" });
  const [selected, setSelected] = useState<number[]>([]);
  const [pendingListing, setPendingListing] = useState<{ ids: number[]; status: "online" | "offline" } | null>(null);
  const [reason, setReason] = useState("");
  const [historyCoach, setHistoryCoach] = useState<OpsCoach | null>(null);
  const [businessCoach, setBusinessCoach] = useState<OpsCoach | null>(null);
  const [events, setEvents] = useState<CoachStatusEvent[]>([]);
  if (state.loading) return <Loading label="正在读取教练档案" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const rows = state.data.filter((coach) => (
    (filters.sport === "all" || coach.sport === filters.sport)
    && (filters.district === "all" || coach.district === filters.district)
    && (filters.kind === "all" || coach.profile_kind === filters.kind)
    && (filters.audit === "all" || coach.audit_status === filters.audit)
    && (filters.listing === "all" || coach.listing_status === filters.listing)
  ));
  async function setStatus(id: number, status: string) {
    setBusy(id);
    try {
      await platformRequest(`/api/v1/operator/coaches/${id}/status`, { body: { status }, method: "PATCH" });
      setNotice("教练审核状态已更新");
      await state.load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); }
    finally { setBusy(0); }
  }
  async function applyListing() {
    if (!pendingListing || !reason.trim()) return;
    setBusy(pendingListing.ids[0] ?? -1);
    try {
      const path = pendingListing.ids.length === 1
        ? `/api/v1/operator/coaches/${pendingListing.ids[0]}/listing`
        : "/api/v1/operator/coaches/listing/batch";
      await platformRequest(path, {
        body: { ids: pendingListing.ids, reason: reason.trim(), status: pendingListing.status },
        method: "PATCH",
      });
      setNotice(`${pendingListing.ids.length} 位教练已${pendingListing.status === "online" ? "上线" : "下线"}`);
      setPendingListing(null);
      setReason("");
      setSelected([]);
      await state.load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); }
    finally { setBusy(0); }
  }
  async function openHistory(coach: OpsCoach) {
    setHistoryCoach(coach);
    try { setEvents(await platformRequest<CoachStatusEvent[]>(`/api/v1/operator/coaches/${coach.id}/events`)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "读取操作记录失败"); }
  }
  function toggle(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  return <div className={styles.page}>
    <Heading copy="审核资格与公开展示相互独立。上下线不会删除档案、历史预约或教练工作台权限。" title="教练管理" />
    <section className={styles.panel}>
      <div className={styles.coachFilters}>
        <label><span>运动项目</span><select onChange={(event) => setFilters({ ...filters, sport: event.target.value })} value={filters.sport}><option value="all">全部项目</option>{SPORT_OPTIONS.map((sport) => <option key={sport}>{sport}</option>)}</select></label>
        <label><span>服务区域</span><select onChange={(event) => setFilters({ ...filters, district: event.target.value })} value={filters.district}><option value="all">北京全部区</option>{BEIJING_DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select></label>
        <label><span>资料类型</span><select onChange={(event) => setFilters({ ...filters, kind: event.target.value })} value={filters.kind}><option value="all">全部类型</option><option value="real">真实教练</option><option value="demo">演示资料</option></select></label>
        <label><span>审核状态</span><select onChange={(event) => setFilters({ ...filters, audit: event.target.value })} value={filters.audit}><option value="all">全部审核状态</option><option value="approved">已通过</option><option value="pending">待审核</option><option value="suspended">已停权</option></select></label>
        <label><span>展示状态</span><select onChange={(event) => setFilters({ ...filters, listing: event.target.value })} value={filters.listing}><option value="all">全部展示状态</option><option value="online">已上线</option><option value="offline">已下线</option></select></label>
      </div>
      {selected.length ? <div className={styles.selectionBar}><strong>已选择 {selected.length} 位</strong><span /><button className={styles.secondary} onClick={() => setPendingListing({ ids: selected, status: "online" })} type="button"><Eye aria-hidden size={16} />批量上线</button><button className={styles.danger} onClick={() => setPendingListing({ ids: selected, status: "offline" })} type="button"><EyeOff aria-hidden size={16} />批量下线</button></div> : null}
      {rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>教练</span><span>服务区域</span><span>业务数据</span><span>资格与展示</span><span>操作</span></div>{rows.map((coach) => <article className={styles.tableRow} key={coach.id}>
        <span className={styles.coachIdentity}><input aria-label={`选择${coach.name}`} checked={selected.includes(coach.id)} onChange={() => toggle(coach.id)} type="checkbox" /><span><strong>{coach.name || `教练 #${coach.id}`}</strong><small>{coach.sport} · {coach.title}</small><em className={styles.status} data-tone={coach.profile_kind === "real" ? "green" : "gray"}>{coach.profile_kind === "real" ? "真实教练" : "演示资料"}</em></span></span>
        <span><strong>{coach.district || "未设置"}</strong><small>{coach.booking_enabled ? "接受学员时间申请" : "暂停接受新预约"}</small></span>
        <span><strong>{coach.review_count || 0} 条评价</strong><small>{coach.lessons || 0} 节已完成课程</small></span>
        <span><em className={styles.status} data-tone={coach.audit_status === "approved" ? "green" : coach.audit_status === "suspended" ? "coral" : "amber"}>{coach.audit_status === "approved" ? "资格已通过" : coach.audit_status === "suspended" ? "资格已停权" : coach.audit_status || "待审核"}</em><em className={styles.status} data-tone={coach.listing_status === "online" ? "green" : "gray"}>{coach.listing_status === "online" ? "公开展示" : "已下线"}</em><small>{coach.listing_reason || (coach.user_id ? "已绑定账号" : "未绑定账号")}</small></span>
        <span className={styles.rowActions}><button className={styles.primary} onClick={() => setBusinessCoach(coach)} type="button">经营设置</button><button className={styles.secondary} onClick={() => void openHistory(coach)} type="button"><History aria-hidden size={15} />记录</button>{coach.listing_status === "online" ? <button className={styles.danger} disabled={busy === coach.id} onClick={() => setPendingListing({ ids: [coach.id], status: "offline" })} type="button"><EyeOff aria-hidden size={15} />下线</button> : <button className={styles.primary} disabled={busy === coach.id || coach.audit_status !== "approved"} onClick={() => setPendingListing({ ids: [coach.id], status: "online" })} type="button"><Eye aria-hidden size={15} />上线</button>}{coach.audit_status === "approved" ? <button className={styles.secondary} disabled={busy === coach.id} onClick={() => void setStatus(coach.id, "suspended")} type="button">暂停资格</button> : <button className={styles.secondary} disabled={busy === coach.id} onClick={() => void setStatus(coach.id, "approved")} type="button">审核通过</button>}</span>
      </article>)}</div> : <Empty copy="调整筛选条件，或导入并审核新的教练档案。" title="没有符合条件的教练" />}
    </section>
    {pendingListing ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setPendingListing(null)}><section aria-labelledby="listing-confirm-title" aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2 id="listing-confirm-title">确认{pendingListing.status === "online" ? "上线" : "下线"} {pendingListing.ids.length} 位教练</h2><p>{pendingListing.status === "online" ? "上线后会进入官网、学员网页和 App 的公开目录。" : "下线只停止公开展示与新预约，历史业务记录不会删除。"}</p><label className={styles.field}><span>操作原因</span><textarea autoFocus maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="填写本次操作原因" value={reason} /></label><div><button className={styles.secondary} onClick={() => setPendingListing(null)} type="button">取消</button><button className={pendingListing.status === "online" ? styles.primary : styles.danger} disabled={!reason.trim() || Boolean(busy)} onClick={() => void applyListing()} type="button">确认{pendingListing.status === "online" ? "上线" : "下线"}</button></div></section></div> : null}
    {historyCoach ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setHistoryCoach(null)}><section aria-labelledby="history-title" aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2 id="history-title">{historyCoach.name} · 状态记录</h2><p>审核与展示操作分别记录，最近记录优先。</p><div className={styles.statusHistory}>{events.length ? events.map((event) => <article key={event.id}><span><strong>{event.event_type === "listing" ? "公开展示" : "资格审核"}</strong><small>{formatBeijingDate(event.created_at)}</small></span><p>{event.from_status} → {event.to_status}</p><small>{event.reason || "未填写补充说明"} · {event.actor || "系统"}</small></article>) : <p>暂无状态变更记录。</p>}</div><div><button className={styles.primary} onClick={() => setHistoryCoach(null)} type="button">完成</button></div></section></div> : null}
    {businessCoach ? <BusinessSettingsDialog coach={businessCoach} onClose={() => setBusinessCoach(null)} onUpdated={state.load} /> : null}
    {notice ? <Toast copy={notice} /> : null}
  </div>;
}

function BusinessSettingsDialog({ coach, onClose, onUpdated }: { coach: OpsCoach; onClose: () => void; onUpdated: () => Promise<void> }) {
  const [settings, setSettings] = useState<OperatorCoachBusinessSettings | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void platformRequest<OperatorCoachBusinessSettings>(`/api/v1/operator/coaches/${coach.id}/business-settings`).then(setSettings).catch((error) => setNotice(error instanceof Error ? error.message : "经营设置加载失败")); }, [coach.id]);
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!settings) return;
    const form = new FormData(event.currentTarget); setBusy(true); setNotice("");
    try {
      const result = await platformRequest<OperatorCoachBusinessSettings>(`/api/v1/operator/coaches/${coach.id}/business-settings`, { body: {
        bookingEnabled: form.get("bookingEnabled") === "on",
        district: form.get("district"),
        priceFen: Math.round(Number(form.get("price")) * 100),
        pricingStatus: form.get("pricingStatus"),
        reason: form.get("reason"),
        trialPriceFen: Math.round(Number(form.get("trialPrice")) * 100),
      }, method: "PATCH" });
      setSettings(result); setNotice("经营设置已更新，已有预约价格保持不变"); await onUpdated();
    } catch (error) { setNotice(error instanceof Error ? error.message : "经营设置更新失败"); }
    finally { setBusy(false); }
  }
  async function saveVenue(venue: CoachVenue, form: HTMLFormElement) {
    const data = new FormData(form); setBusy(true); setNotice("");
    try {
      await platformRequest(`/api/v1/operator/coaches/${coach.id}/venues/${encodeURIComponent(venue.id)}`, { body: { active: data.get("active") === "on", address: data.get("address"), district: data.get("district"), name: data.get("name"), reason: data.get("reason") }, method: "PATCH" });
      setSettings(await platformRequest<OperatorCoachBusinessSettings>(`/api/v1/operator/coaches/${coach.id}/business-settings`)); setNotice("场馆资料已更新");
    } catch (error) { setNotice(error instanceof Error ? error.message : "场馆更新失败"); }
    finally { setBusy(false); }
  }
  async function createVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setNotice("");
    try {
      await platformRequest(`/api/v1/operator/coaches/${coach.id}/venues`, { body: { address: data.get("address"), district: data.get("district"), name: data.get("name"), reason: data.get("reason") }, method: "POST" });
      setSettings(await platformRequest<OperatorCoachBusinessSettings>(`/api/v1/operator/coaches/${coach.id}/business-settings`)); form.reset(); setNotice("新场馆已创建并启用");
    } catch (error) { setNotice(error instanceof Error ? error.message : "场馆创建失败"); }
    finally { setBusy(false); }
  }
  return <div className={styles.confirmOverlay} role="presentation" onClick={onClose}><section aria-labelledby="business-title" aria-modal="true" className={styles.businessDialog} onClick={(event) => event.stopPropagation()} role="dialog"><h2 id="business-title">{coach.name} · 经营设置</h2><p>运营直改只用于经营字段，每次操作必须填写原因并进入审计日志。</p>{settings ? <><form className={styles.form} onSubmit={saveSettings}><div className={styles.formGrid}><label className={styles.field}><span>常规课价格（元）</span><input defaultValue={(settings.priceFen / 100).toFixed(0)} min="0" name="price" required step="0.01" type="number" /></label><label className={styles.field}><span>试课价格（元）</span><input defaultValue={(settings.trialPriceFen / 100).toFixed(0)} min="0" name="trialPrice" required step="0.01" type="number" /></label><label className={styles.field}><span>价格状态</span><select defaultValue={settings.pricingStatus} name="pricingStatus"><option value="published">公开价格</option><option value="unavailable">价格暂不可用</option></select></label><label className={styles.field}><span>服务区域</span><select defaultValue={settings.district} name="district">{BEIJING_DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select></label></div><label className={styles.switchField}><input defaultChecked={settings.bookingEnabled} name="bookingEnabled" type="checkbox" /><span><strong>接受新预约</strong><small>关闭后保留公开资料和历史预约，但不能创建新预约。</small></span></label><label className={styles.field}><span>修改原因</span><textarea maxLength={300} name="reason" required /></label><button className={styles.primary} disabled={busy} type="submit">保存经营设置</button></form><div className={styles.venueSection}><header><div><h3>训练场馆</h3><p>停用前必须先处理该场馆的未来已确认课程。</p></div><MapPin aria-hidden /></header>{settings.venues.map((venue) => <form className={styles.venueEditor} key={venue.id} onSubmit={(event) => { event.preventDefault(); void saveVenue(venue, event.currentTarget); }}><div className={styles.formGrid}><label className={styles.field}><span>场馆名称</span><input defaultValue={venue.name} name="name" required /></label><label className={styles.field}><span>所在区域</span><select defaultValue={venue.district} name="district">{BEIJING_DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select></label></div><label className={styles.field}><span>详细地址</span><input defaultValue={venue.address} name="address" required /></label><label className={styles.switchField}><input defaultChecked={venue.active !== false} name="active" type="checkbox" /><span><strong>启用场馆</strong><small>{venue.active === false ? "当前已停用" : "当前可用于新预约地点"}</small></span></label><label className={styles.field}><span>修改原因</span><input maxLength={300} name="reason" required /></label><button className={styles.secondary} disabled={busy} type="submit">保存场馆</button></form>)}<form className={styles.venueEditor} onSubmit={createVenue}><h4><Plus aria-hidden size={16} />新增场馆</h4><div className={styles.formGrid}><label className={styles.field}><span>场馆名称</span><input name="name" required /></label><label className={styles.field}><span>所在区域</span><select defaultValue={settings.district} name="district">{BEIJING_DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select></label></div><label className={styles.field}><span>详细地址</span><input name="address" required /></label><label className={styles.field}><span>创建原因</span><input maxLength={300} name="reason" required /></label><button className={styles.secondary} disabled={busy} type="submit"><Plus aria-hidden size={16} />创建场馆</button></form></div></> : <Loading label="正在读取经营设置" />}{notice ? <p className={styles.dialogNotice} role="status">{notice}</p> : null}<div><button className={styles.secondary} onClick={onClose} type="button">关闭</button></div></section></div>;
}

type OpsBooking = { id: string; status?: string; fee_fen?: number; payment_status?: string; note?: string; learner_name?: string; coach_name?: string; sport?: string; venue_name?: string; starts_at?: number; ends_at?: number; created_at?: number };
function BookingOperations() {
  const state = useOpsData<OpsBooking[]>("/api/v1/operator/bookings");
  if (state.loading) return <Loading label="正在读取预约履约数据" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  return <div className={styles.page}><Heading copy="集中查看预约状态、时间、场馆与线下收款结果。业务状态只能由对应角色按规则流转。" title="预约履约" /><section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>预约</span><span>服务双方</span><span>时间与场馆</span><span>费用</span><span>状态</span></div>{state.data.map((booking) => <article className={styles.tableRow} key={booking.id}><span><strong>#{booking.id.slice(-8)}</strong><small>{booking.sport || "专项训练"}</small></span><span><strong>{booking.learner_name || "学员"}</strong><small>{booking.coach_name || "教练"}</small></span><span><strong>{formatBeijingDate(booking.starts_at)}</strong><small>{booking.venue_name || "场馆待确认"}</small></span><span><strong>{formatFen(booking.fee_fen)}</strong><small>{booking.payment_status === "offline_paid" ? "线下已收款" : "线下待支付"}</small></span><span><em className={styles.status} data-tone={booking.status === "completed" || booking.status === "confirmed" ? "green" : booking.status === "pending_coach" ? "amber" : "gray"}>{booking.status || "未知"}</em></span></article>)}</div> : <Empty copy="真实预约提交后会进入履约视图。" title="暂无预约记录" />}</section></div>;
}

type OpsUser = { id: string; nickname?: string; district?: string; avatar_object_key?: string; completed_at?: number; email_domain?: string; phone_last4?: string; status?: string; roles?: string; booking_count?: number; created_at?: number };
type MergeRequest = { id: string; requested_by_user_id: string; conflicting_user_id: string; requested_nickname?: string; conflicting_nickname?: string; contact_kind?: string; contact_hint?: string; status?: string; created_at?: number };
function UserOperations() {
  const state = useOpsData<OpsUser[]>("/api/v1/operator/users");
  const merges = useOpsData<MergeRequest[]>("/api/v1/operator/account-merge-requests");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  if (state.loading) return <Loading label="正在读取用户服务数据" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const rows = state.data.filter((user) => `${user.id}${user.nickname}${user.email_domain}${user.phone_last4}${user.roles}`.includes(query.trim()));
  async function reset(user: OpsUser, action: "reset_avatar" | "reset_nickname") { const reason = window.prompt(action === "reset_avatar" ? "填写重置头像原因" : "填写重置昵称原因"); if (!reason?.trim()) return; try { await platformRequest(`/api/v1/operator/users/${encodeURIComponent(user.id)}/profile`, { body: { action, reason }, method: "PATCH" }); setNotice("账号资料已重置并写入审计日志"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "处置失败"); } }
  async function reviewMerge(item: MergeRequest, decision: "approved" | "rejected") { const note = window.prompt(decision === "approved" ? "填写合并核对意见" : "填写拒绝原因"); if (!note?.trim()) return; try { await platformRequest(`/api/v1/operator/account-merge-requests/${encodeURIComponent(item.id)}`, { body: { decision, note, primaryUserId: decision === "approved" ? item.requested_by_user_id : undefined }, method: "PATCH" }); setNotice(decision === "approved" ? "账号数据已合并，角色未自动迁移" : "合并工单已拒绝"); await Promise.all([state.load(), merges.load()]); } catch (error) { setNotice(error instanceof Error ? error.message : "工单处理失败"); } }
  return <div className={styles.page}><Heading action={<div className={styles.toolbar}><input aria-label="搜索用户" onChange={(event) => setQuery(event.target.value)} placeholder="搜索昵称、账号或角色" value={query} /></div>} copy="查看资料完整度、脱敏联系方式和服务关系；违规处置与合并均写入审计日志。" title="用户服务" /><section className={styles.panel}>{rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>账号资料</span><span>联系方式</span><span>角色</span><span>预约</span><span>状态与操作</span></div>{rows.map((user) => <article className={styles.tableRow} key={user.id}><span><strong>{user.nickname || "昵称待完善"}</strong><small>#{user.id.slice(-8)} · {user.district || "区域未填"}</small></span><span><strong>{user.email_domain ? `***@${user.email_domain}` : user.phone_last4 ? `*** ${user.phone_last4}` : "未提供"}</strong><small>{user.completed_at ? "资料已完善" : "资料待完善"}</small></span><span><strong>{user.roles || "student"}</strong><small>服务端授权</small></span><span><strong>{user.booking_count || 0} 条</strong><small>累计预约</small></span><span><em className={styles.status} data-tone={user.status === "active" ? "green" : "gray"}>{user.status === "active" ? "正常" : user.status || "未知"}</em><span className={styles.rowActions}><button className={styles.secondary} disabled={!user.avatar_object_key} onClick={() => void reset(user,"reset_avatar")} type="button">重置头像</button><button className={styles.secondary} disabled={!user.nickname} onClick={() => void reset(user,"reset_nickname")} type="button">重置昵称</button></span></span></article>)}</div> : <Empty copy="完成邮箱验证后，账号会进入这里。" title="暂无注册用户" />}</section><section className={styles.panel}><header className={styles.panelHeader}><div><h2>账号合并工单</h2><p>联系方式冲突不会自动合并，需人工确定主账号</p></div></header>{merges.data?.length ? <div className={styles.list}>{merges.data.map((item) => <article className={styles.listItem} key={item.id}><span className={styles.listIcon}><UserRoundCheck aria-hidden size={19} /></span><div><h3>{item.requested_nickname || `#${item.requested_by_user_id.slice(-8)}`} 与 {item.conflicting_nickname || `#${item.conflicting_user_id.slice(-8)}`}</h3><p>{item.contact_kind === "phone" ? "手机号" : "邮箱"} {item.contact_hint} · {formatBeijingDate(item.created_at)}</p></div><em className={styles.status} data-tone={item.status === "pending" ? "amber" : item.status === "approved" ? "green" : "gray"}>{item.status === "pending" ? "待处理" : item.status}</em>{item.status === "pending" ? <span className={styles.rowActions}><button className={styles.danger} onClick={() => void reviewMerge(item,"rejected")} type="button">拒绝</button><button className={styles.primary} onClick={() => void reviewMerge(item,"approved")} type="button">合并到申请账号</button></span> : null}</article>)}</div> : <Empty copy="联系方式属于其他账号时，会在这里生成待核对工单。" title="暂无合并工单" />}</section>{notice ? <Toast copy={notice} /> : null}</div>;
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

type ProfileChange = { id: string; coach_name?: string; field?: string; current_value_json?: string; proposed_value_json?: string; status?: string; review_note?: string; reviewed_by?: string; reviewed_at?: number; created_at?: number };

function readableValue(value?: string) {
  if (!value) return "未填写";
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.join("、") : typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed); }
  catch { return value; }
}

function ProfileReviewCenter() {
  const state = useOpsData<ProfileChange[]>("/api/v1/operator/profile-change-requests");
  const [selected, setSelected] = useState<ProfileChange | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  if (state.loading) return <Loading label="正在读取资料变更申请" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  const pending = state.data.filter((item) => item.status === "pending");
  async function review(decision: "approved" | "rejected") {
    if (!selected || !note.trim()) return;
    setBusy(true);
    try {
      await platformRequest(`/api/v1/operator/profile-change-requests/${encodeURIComponent(selected.id)}`, { body: { decision, note: note.trim() }, method: "PATCH" });
      setNotice(decision === "approved" ? "资料变更已审核通过并更新公开档案" : "资料变更已拒绝，公开档案保持不变");
      setSelected(null); setNote(""); await state.load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "审核失败"); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}><Heading copy="逐项对照公开值与申请值。只有审核通过才会更新官网和 App，拒绝不会改变线上档案。" title="教练资料审核" />
    <section className={styles.metrics}><article><span>待审核</span><strong>{pending.length}</strong><small>需人工核验</small></article><article><span>全部申请</span><strong>{state.data.length}</strong><small>含历史记录</small></article></section>
    <section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>教练与字段</span><span>当前公开值</span><span>申请变更为</span><span>状态</span><span>操作</span></div>{state.data.map((item) => <article className={styles.tableRow} key={item.id}><span><strong>{item.coach_name || "教练"}</strong><small>{item.field || "资料字段"} · {formatBeijingDate(item.created_at)}</small></span><span><strong>{readableValue(item.current_value_json)}</strong><small>当前线上版本</small></span><span><strong>{readableValue(item.proposed_value_json)}</strong><small>待核验内容</small></span><span><em className={styles.status} data-tone={item.status === "approved" ? "green" : item.status === "pending" ? "amber" : "gray"}>{item.status === "approved" ? "已通过" : item.status === "rejected" ? "已拒绝" : item.status === "cancelled" ? "已撤回" : "待审核"}</em><small>{item.review_note || "暂无审核意见"}</small></span><span>{item.status === "pending" ? <button className={styles.primary} onClick={() => { setSelected(item); setNote(""); }} type="button">开始审核</button> : <small>{item.reviewed_by || "系统"}</small>}</span></article>)}</div> : <Empty copy="教练提交公开资料变更后会进入这里。" title="暂无资料变更申请" />}</section>
    {selected ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setSelected(null)}><section aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2>{selected.coach_name} · {selected.field}</h2><p>确认后会记录审核人、时间和不可变版本。拒绝时公开档案保持原值。</p><div className={styles.statusHistory}><article><strong>当前公开值</strong><p>{readableValue(selected.current_value_json)}</p></article><article><strong>申请值</strong><p>{readableValue(selected.proposed_value_json)}</p></article></div><label className={styles.field}><span>审核意见（必填）</span><textarea autoFocus maxLength={1000} onChange={(event) => setNote(event.target.value)} value={note} /></label><div><button className={styles.secondary} onClick={() => setSelected(null)} type="button">取消</button><button className={styles.danger} disabled={busy || !note.trim()} onClick={() => void review("rejected")} type="button">拒绝</button><button className={styles.primary} disabled={busy || !note.trim()} onClick={() => void review("approved")} type="button">通过并发布</button></div></section></div> : null}{notice ? <Toast copy={notice} /> : null}</div>;
}

type ModeratedReview = { id: string; coach_name?: string; rating?: number; body?: string; tags_json?: string; status?: string; review_note?: string; created_at?: number; helpful_count?: number; report_count?: number; report_reasons?: string; reply_id?: string; reply_body?: string; reply_status?: string; reply_review_note?: string };
function ReviewModeration() {
  const state = useOpsData<ModeratedReview[]>("/api/v1/operator/reviews");
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState("");
  if (state.loading) return <Loading label="正在读取学员评价" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  async function review(item: ModeratedReview, status: "approved" | "rejected") { const note = window.prompt(status === "approved" ? "填写公开审核意见" : "填写拒绝原因"); if (!note?.trim()) return; setBusy(item.id); try { await platformRequest(`/api/v1/operator/reviews/${encodeURIComponent(item.id)}`, { body: { note, status }, method: "PATCH" }); setNotice(status === "approved" ? "评价已公开" : "评价已拒绝"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "审核失败"); } finally { setBusy(""); } }
  async function reviewReply(item: ModeratedReview, status: "approved" | "rejected") { if (!item.reply_id) return; const note = window.prompt(status === "approved" ? "填写回复公开意见" : "填写回复拒绝原因"); if (!note?.trim()) return; setBusy(item.reply_id); try { await platformRequest(`/api/v1/operator/review-replies/${encodeURIComponent(item.reply_id)}`, { body: { note, status }, method: "PATCH" }); setNotice(status === "approved" ? "教练回复已公开" : "教练回复已拒绝"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "回复审核失败"); } finally { setBusy(""); } }
  async function resolveReport(item: ModeratedReview, decision: "hide" | "keep") { const note = window.prompt(decision === "hide" ? "填写下架原因" : "填写保留评价的核查结论"); if (!note?.trim()) return; setBusy(`${item.id}-report`); try { await platformRequest(`/api/v1/operator/reviews/${encodeURIComponent(item.id)}/report`, { body: { decision, note }, method: "PATCH" }); setNotice(decision === "hide" ? "评价已下架并重新计算评分" : "举报已核查，评价继续公开"); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "举报处理失败"); } finally { setBusy(""); } }
  return <div className={styles.page}><Heading copy="只公开完成课程且通过审核的匿名评价；标签、举报与教练回复在同一队列处理。" title="评价审核" /><section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>教练与评分</span><span>评价内容</span><span>反馈风险</span><span>状态</span><span>操作</span></div>{state.data.map((item) => <article className={styles.tableRow} key={item.id}><span><strong>{item.coach_name || "教练"} · {item.rating || 0}/5</strong><small>{formatBeijingDate(item.created_at)} · {item.tags_json || "[]"}</small></span><span><strong>{item.body || "未填写文字评价"}</strong><small>{item.reply_body ? `教练回复：${item.reply_body}` : item.review_note || "尚未填写审核意见"}</small></span><span><strong>{item.helpful_count || 0} 次有帮助</strong><small>{item.report_count ? `${item.report_count}次举报：${item.report_reasons || "待核对"}` : "无举报"}</small></span><span><em className={styles.status} data-tone={item.status === "approved" ? "green" : item.status === "pending" ? "amber" : "gray"}>{item.status === "approved" ? "已公开" : item.status === "rejected" ? "已拒绝" : "待审核"}</em><small>{item.reply_status === "pending" ? "教练回复待审核" : item.reply_status === "approved" ? "回复已公开" : ""}</small></span><span className={styles.rowActions}>{item.status === "pending" ? <><button className={styles.danger} disabled={busy === item.id} onClick={() => void review(item, "rejected")} type="button">拒绝</button><button className={styles.primary} disabled={busy === item.id} onClick={() => void review(item, "approved")} type="button">公开</button></> : item.report_count ? <><button className={styles.secondary} disabled={busy === `${item.id}-report`} onClick={() => void resolveReport(item, "keep")} type="button">核查保留</button><button className={styles.danger} disabled={busy === `${item.id}-report`} onClick={() => void resolveReport(item, "hide")} type="button">下架评价</button></> : item.reply_status === "pending" ? <><button className={styles.danger} disabled={busy === item.reply_id} onClick={() => void reviewReply(item, "rejected")} type="button">拒绝回复</button><button className={styles.primary} disabled={busy === item.reply_id} onClick={() => void reviewReply(item, "approved")} type="button">公开回复</button></> : null}</span></article>)}</div> : <Empty copy="完成课程并提交评价后，内容会进入这里。" title="暂无评价任务" />}</section>{notice ? <Toast copy={notice} /> : null}</div>;
}

type SupportTicket = { id: string; subject?: string; category?: string; priority?: string; status?: string; latest_message?: string; created_by_role?: string; created_at?: number; updated_at?: number };
function SupportCenter() {
  const state = useOpsData<SupportTicket[]>("/api/v1/operator/support-tickets");
  const [replying, setReplying] = useState<SupportTicket | null>(null); const [body, setBody] = useState(""); const [status, setStatus] = useState("in_progress"); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  if (state.loading) return <Loading label="正在读取售后工单" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  async function update() { if (!replying) return; setBusy(true); try { await platformRequest(`/api/v1/operator/support-tickets/${encodeURIComponent(replying.id)}`, { body: { body: body.trim() || undefined, status }, method: "PATCH" }); setNotice("工单已更新并记录运营回复"); setReplying(null); setBody(""); await state.load(); } catch (error) { setNotice(error instanceof Error ? error.message : "工单更新失败"); } finally { setBusy(false); } }
  return <div className={styles.page}><Heading copy="学员和教练可围绕真实预约发起站内售后，运营回复与处理状态会完整留痕。" title="售后工单" /><section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>工单</span><span>分类</span><span>最新内容</span><span>状态</span><span>操作</span></div>{state.data.map((item) => <article className={styles.tableRow} key={item.id}><span><strong>{item.subject || `工单 #${item.id.slice(-8)}`}</strong><small>{formatBeijingDate(item.updated_at || item.created_at)}</small></span><span><strong>{item.category || "其他"}</strong><small>{item.created_by_role === "coach" ? "教练发起" : "学员发起"} · {item.priority === "urgent" ? "紧急" : "常规"}</small></span><span><strong>{item.latest_message || "暂无消息"}</strong><small>站内工单</small></span><span><em className={styles.status} data-tone={item.status === "resolved" || item.status === "closed" ? "green" : "amber"}>{item.status || "open"}</em></span><span><button className={styles.primary} onClick={() => { setReplying(item); setStatus(item.status === "open" ? "in_progress" : item.status || "in_progress"); }} type="button">处理</button></span></article>)}</div> : <Empty copy="学员或教练发起工单后会显示在这里。" title="暂无售后工单" />}</section>{replying ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setReplying(null)}><section aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2>{replying.subject}</h2><p>{replying.latest_message}</p><label className={styles.field}><span>处理状态</span><select onChange={(event) => setStatus(event.target.value)} value={status}><option value="in_progress">处理中</option><option value="waiting_user">等待用户</option><option value="resolved">已解决</option><option value="closed">已关闭</option></select></label><label className={styles.field}><span>运营回复</span><textarea maxLength={3000} onChange={(event) => setBody(event.target.value)} value={body} /></label><div><button className={styles.secondary} onClick={() => setReplying(null)} type="button">取消</button><button className={styles.primary} disabled={busy} onClick={() => void update()} type="button">保存处理结果</button></div></section></div> : null}{notice ? <Toast copy={notice} /> : null}</div>;
}

type AuditRow = { id: string; actor?: string; action?: string; entity_type?: string; entity_id?: string; detail_json?: string; request_id?: string; created_at?: number };
function AuditLogPage() {
  const state = useOpsData<AuditRow[]>("/api/v1/operator/audit-logs");
  if (state.loading) return <Loading label="正在读取审计日志" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  return <div className={styles.page}><Heading copy="资料审核、上下线、评价、工单和内容发布均记录操作人、对象与时间。" title="审计日志" /><section className={styles.panel}>{state.data.length ? <div className={styles.table}><div className={styles.tableHead}><span>操作</span><span>对象</span><span>操作人</span><span>时间</span><span>请求标识</span></div>{state.data.map((item) => <article className={styles.tableRow} key={item.id}><span><strong>{item.action || "系统操作"}</strong><small>{item.detail_json || "{}"}</small></span><span><strong>{item.entity_type || "entity"}</strong><small>{item.entity_id || "-"}</small></span><span><strong>{item.actor || "system"}</strong><small>服务端校验</small></span><span><strong>{formatBeijingDate(item.created_at)}</strong><small>北京时间</small></span><span><strong>{item.request_id || "-"}</strong><small>追踪标识</small></span></article>)}</div> : <Empty copy="完成受审计操作后会生成不可变记录。" title="暂无审计记录" />}</section></div>;
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
function Loading({ label }: { label: string }) { return <LoadingState label={label} variant="table" />; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>运营数据暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>; }
