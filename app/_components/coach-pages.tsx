"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatBeijingDateTimeLocal } from "../../shared/scheduling";
import { getBookingPresentation } from "../../shared/booking-presentation";
import type { BookingStatus, CoachOverview, MobileBooking } from "../mobile/types";
import { formatBeijingDate, formatFen, platformRequest } from "./platform-client";
import styles from "./platform-pages.module.css";
import { LoadingState } from "./async-states";

export type CoachSection = "home" | "bookings" | "schedule" | "messages" | "courses" | "payments" | "credentials" | "support";

const statusCopy: Record<BookingStatus, string> = {
  cancelled_by_coach: "教练已取消",
  cancelled_by_student: "学员已取消",
  completed: "已完成",
  confirmed: "已确认",
  pending_coach: "待确认",
  rejected: "已拒绝",
  expired: "已失效",
  reschedule_requested: "申请改期",
};

function statusTone(status: BookingStatus) {
  if (status === "confirmed" || status === "completed") return "green";
  if (status === "pending_coach" || status === "reschedule_requested") return "amber";
  return "gray";
}

function useCoachOverview() {
  const [data, setData] = useState<CoachOverview | null>(null);
  const hasData = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    try { setData(await platformRequest<CoachOverview>("/api/v1/coach/overview")); hasData.current = true; setError(""); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "教练工作台暂时不可用"); }
    finally { setLoading(false); }
  }, []);
  const refresh = useCallback(async () => { try { setData(await platformRequest<CoachOverview>("/api/v1/coach/overview")); setError(""); } catch { /* Keep the last working state during polling. */ } }, []);
  useEffect(() => {
    let active = true;
    void platformRequest<CoachOverview>("/api/v1/coach/overview")
      .then((result) => { if (active) { setData(result); hasData.current = true; setError(""); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "教练工作台暂时不可用"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { data, error, load, loading, refresh };
}

export function CoachPage({ section }: { section: CoachSection }) {
  const state = useCoachOverview();
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");
  if (state.loading) return <Loading label="正在读取教练工作台" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;

  async function mutate(path: string, body: unknown, success: string, method: "DELETE" | "POST" = "POST") {
    setBusy(path); setActionError("");
    try { await platformRequest(path, { body, method }); setNotice(success); await state.load(); window.setTimeout(() => setNotice(""), 2600); return true; }
    catch (error) { setActionError(error instanceof Error ? error.message : "操作没有完成"); return false; }
    finally { setBusy(""); }
  }

  let content: React.ReactNode;
  if (section === "bookings") content = <BookingManager bookings={state.data.bookings} busy={busy} mutate={mutate} venues={state.data.venues} />;
  else if (section === "schedule") content = <ScheduleManager overview={state.data} refresh={state.load} />;
  else if (section === "messages") content = <CoachMessages busy={busy} overview={state.data} mutate={mutate} refresh={state.refresh} />;
  else if (section === "courses") content = <CourseRecords busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "payments") content = <PaymentManager busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "credentials") content = <ProfileManager busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "support") content = <CoachSupport busy={busy} overview={state.data} mutate={mutate} />;
  else content = <CoachHome overview={state.data} />;
  return <>{content}{actionError ? <div className={styles.notice} role="alert"><CircleAlert aria-hidden size={17} />{actionError}</div> : null}{notice ? <div className={styles.notice} role="status"><CheckCircle2 aria-hidden size={17} />{notice}</div> : null}</>;
}

function Heading({ action, copy, title }: { action?: React.ReactNode; copy: string; title: string }) {
  return <header className={styles.heading}><div><p className={styles.eyebrow}>教练模式</p><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function coachServiceScope(coach: CoachOverview["coach"]) {
  if (coach.serviceAreas?.length) {
    return coach.serviceAreas.map((area) => `${area.cityName}·${area.district}`).join("、");
  }
  return [coach.city, coach.district].filter(Boolean).join("·") || "服务区域待完善";
}

function CoachHome({ overview }: { overview: CoachOverview }) {
  const operationalBookings = overview.bookings.filter((item) => item.metricEligible !== false);
  const pending = operationalBookings.filter((item) => ["pending_coach", "reschedule_requested"].includes(item.status));
  const confirmed = operationalBookings.filter((item) => item.status === "confirmed");
  const unpaid = operationalBookings.filter((item) => item.status === "completed" && item.paymentStatus === "offline_unpaid");
  return <div className={styles.page}>
    <Heading action={<Link className={styles.primary} href="/coach-workspace/schedule"><CalendarCheck2 aria-hidden size={16} />接单状态与日程</Link>} copy="优先处理预约申请，查看已确认课程与学员消息。" title={`${overview.coach.name}，今天的工作已经整理好`} />
    <section className={styles.metrics}>
      <article><span>待处理预约</span><strong>{pending.length}</strong><small>确认、改期或拒绝</small></article>
      <article><span>已确认课程</span><strong>{confirmed.length}</strong><small>等待到场履约</small></article>
      <article><span>接单状态</span><strong>{overview.coach.bookingEnabled === false ? "已下线" : "接单中"}</strong><small>学员可自主申请时间</small></article>
      <article><span>待标记收款</span><strong>{unpaid.length}</strong><small>仅记录线下支付结果</small></article>
    </section>
    <div className={styles.split}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>优先处理</h2><p>需要教练明确回应的预约申请</p></div><Link className={styles.secondary} href="/coach-workspace/bookings">全部预约</Link></header>
        {pending.length ? <div className={styles.list}>{pending.slice(0, 5).map((booking) => <article className={styles.listItem} key={booking.id}><span className={styles.listIcon}><Clock3 aria-hidden size={19} /></span><div><h3>{booking.dateLabel} {booking.time}–{booking.endTime}</h3><p>{formatFen(booking.feeFen)} · {statusCopy[booking.status]}</p></div><Link className={styles.secondary} href="/coach-workspace/bookings">处理 <ArrowRight aria-hidden size={15} /></Link></article>)}</div> : <Empty title="当前没有待处理预约" copy="新预约提交后会立即进入这里，并同步到教练端通知。" />}
      </section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>服务资料</h2><p>公开档案与工作状态</p></div></header><div className={styles.list}>
        <div className={styles.listItem}><span className={styles.listIcon}><BadgeCheck aria-hidden size={19} /></span><div><h3>{overview.coach.verificationLabel}</h3><p>{overview.coach.sport} · {coachServiceScope(overview.coach)}</p></div><em className={styles.status}>已上线</em></div>
        <div className={styles.listItem}><span className={styles.listIcon}><MapPin aria-hidden size={19} /></span><div><h3>合作训练场</h3><p>{overview.venues?.[0]?.name || "尚未发布场馆"}</p></div></div>
        <Link className={styles.listItem} href="/coach-workspace/credentials"><span className={styles.listIcon}><ShieldCheck aria-hidden size={19} /></span><div><h3>资料变更</h3><p>提交后由运营审核，不直接改写公开档案</p></div><ArrowRight aria-hidden size={16} /></Link>
      </div></aside>
    </div>
  </div>;
}

/* Date defaults are created only from explicit button actions, not during initial render. */
/* eslint-disable react-hooks/purity */
function BookingManager({ bookings, busy, mutate, venues }: { bookings: MobileBooking[]; busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; venues: CoachOverview["venues"] }) {
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const [rescheduleBooking, setRescheduleBooking] = useState<MobileBooking | null>(null);
  const [rescheduleStartsAt, setRescheduleStartsAt] = useState("");
  const [rescheduleLocationType, setRescheduleLocationType] = useState<"venue" | "custom">("venue");
  const [rescheduleVenueId, setRescheduleVenueId] = useState(venues[0]?.id || "");
  const [rescheduleDistrict, setRescheduleDistrict] = useState("");
  const [rescheduleAddress, setRescheduleAddress] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const rows = useMemo(() => bookings.filter((booking) => filter === "all" || (filter === "done" ? ["completed", "cancelled_by_coach", "cancelled_by_student", "rejected"].includes(booking.status) : ["pending_coach", "confirmed", "reschedule_requested"].includes(booking.status))), [bookings, filter]);
  async function transition(id: string, status: BookingStatus) {
    await mutate(`/api/v1/coach/bookings/${encodeURIComponent(id)}/status`, { status }, `预约已更新为“${statusCopy[status]}”`);
  }
  async function requestCompletion(id: string) {
    if (bookings.find((booking) => booking.id === id)?.fulfillmentVersion !== 2) return transition(id, "completed");
    await mutate(`/api/v1/coach/bookings/${encodeURIComponent(id)}/completion-request`, { note: "课程已按预约安排完成，请学员确认。" }, "已发送课程完成确认，等待学员回应");
  }
  async function proposeReschedule() {
    if (!rescheduleBooking || !rescheduleStartsAt) return;
    const startsAt = new Date(`${rescheduleStartsAt}:00+08:00`).getTime();
    const ok = await mutate("/api/v1/coach/reschedule-proposals", { bookingId: rescheduleBooking.id, customAddress: rescheduleAddress, customDistrict: rescheduleDistrict, locationType: rescheduleLocationType, note: rescheduleNote, startsAt, venueId: rescheduleLocationType === "venue" ? rescheduleVenueId : undefined }, "新时间地点方案已发送，等待学员确认");
    if (ok) { setRescheduleBooking(null); setRescheduleNote(""); }
  }
  return <div className={styles.page}>
    <Heading copy="确认、改期、拒绝和完成课程都会写入状态事件，并通知对应学员。" title="预约管理" />
    <section className={styles.panel}><header className={styles.panelHeader}><div className={styles.toolbar}>{([['active', '待处理'], ['all', '全部'], ['done', '已结束']] as const).map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? styles.primary : styles.secondary} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}</div></header>
      {rows.length ? <div className={styles.table}>
        <div className={styles.tableHead}><span>预约</span><span>时间</span><span>费用</span><span>状态</span><span>操作</span></div>
        {rows.map((booking) => {
          const presentation = getBookingPresentation(booking);
          const propose = () => { setRescheduleBooking(booking); setRescheduleStartsAt(formatBeijingDateTimeLocal(Date.now() + 24 * 60 * 60_000)); };
          return <article className={styles.tableRow} key={booking.id}>
            <span><strong>#{booking.id.slice(-8)}</strong><small>{booking.note || "未填写备注"}</small></span>
            <span><strong>{booking.dateLabel} {booking.date}</strong><small>{booking.time}–{booking.endTime} · {booking.durationMinutes ? `${booking.durationMinutes}分钟` : "时长待核对"}</small></span>
            <span><strong>{formatFen(booking.feeFen)}</strong>{presentation.paymentLabel ? <small>{presentation.paymentLabel}</small> : null}</span>
            <span><em className={styles.status} data-tone={statusTone(booking.status)}>{presentation.label}</em></span>
            <span className={styles.rowActions}>{booking.status === "pending_coach" ? <>
              <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "confirmed")} type="button">确认</button>
              <button className={styles.secondary} disabled={Boolean(busy)} onClick={propose} type="button">提出新方案</button>
              <button className={styles.danger} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "rejected")} type="button">拒绝</button>
            </> : presentation.canReschedule ? <>
              <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void requestCompletion(booking.id)} type="button">{booking.fulfillmentVersion === 2 ? "发起完成确认" : "完成课程"}</button>
              <button className={styles.secondary} disabled={Boolean(busy)} onClick={propose} type="button">提出新方案</button>
              <button className={styles.danger} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "cancelled_by_coach")} type="button">取消</button>
            </> : null}</span>
          </article>;
        })}
      </div> : <Empty title="当前筛选下没有预约" copy="预约列表只展示真实业务记录，不会补入试点演示数据。" />}
    </section>
    {rescheduleBooking ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setRescheduleBooking(null)}><section aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2>提出新的时间与地点</h2><p>时长和费用保持学员提交时的快照不变。学员接受后，新方案才正式生效。</p><div className={styles.formGrid}><label className={styles.field}><span>新的开始时间（北京时间）</span><input min={formatBeijingDateTimeLocal(Date.now() + 60_000)} onChange={(event) => setRescheduleStartsAt(event.target.value)} type="datetime-local" value={rescheduleStartsAt} /></label><label className={styles.field}><span>地点方式</span><select onChange={(event) => setRescheduleLocationType(event.target.value as "venue" | "custom")} value={rescheduleLocationType}><option value="venue">审核场馆</option><option value="custom">其他地点</option></select></label></div>{rescheduleLocationType === "venue" ? <label className={styles.field}><span>训练场馆</span><select onChange={(event) => setRescheduleVenueId(event.target.value)} value={rescheduleVenueId}>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} · {venue.district}</option>)}</select></label> : <div className={styles.formGrid}><label className={styles.field}><span>区域</span><input onChange={(event) => setRescheduleDistrict(event.target.value)} value={rescheduleDistrict} /></label><label className={styles.field}><span>详细地点</span><input onChange={(event) => setRescheduleAddress(event.target.value)} value={rescheduleAddress} /></label></div>}<label className={styles.field}><span>方案说明</span><textarea maxLength={500} onChange={(event) => setRescheduleNote(event.target.value)} value={rescheduleNote} /></label><div><button className={styles.secondary} onClick={() => setRescheduleBooking(null)} type="button">取消</button><button className={styles.primary} disabled={!rescheduleStartsAt || (rescheduleLocationType === "venue" ? !rescheduleVenueId : !rescheduleDistrict.trim() || !rescheduleAddress.trim()) || Boolean(busy)} onClick={() => void proposeReschedule()} type="button">发送给学员</button></div></section></div> : null}
  </div>;
}
/* eslint-enable react-hooks/purity */

function ScheduleManager({ overview, refresh }: { overview: CoachOverview; refresh: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = overview.bookings.filter((booking) => booking.status === "pending_coach");
  const confirmed = overview.bookings.filter((booking) => booking.status === "confirmed");
  const online = overview.coach.bookingEnabled !== false;
  async function setOnline(next: boolean) {
    setSubmitting(true); setNotice("");
    try {
      await platformRequest("/api/v1/coach/availability", { body: { online: next }, method: "PATCH" });
      setNotice(next ? "已上线接单，学员现在可以提交时间申请" : "已停止接收新申请，历史预约仍然保留");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "接单状态更新失败");
    } finally { setSubmitting(false); }
  }
  return <div className={styles.page}><Heading copy="无需预先发布时段。上线后学员可指定时间和地点，你在确认时决定是否接单。" title="接单状态与日程" />
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>接受新预约申请</h2><p>运营下线、审核暂停或风控状态优先于教练自行设置</p></div><em className={styles.status} data-tone={online ? "green" : "gray"}>{online ? "接单中" : "已下线"}</em></header><div className={styles.form}><label className={styles.switchField}><input checked={online} disabled={submitting} onChange={(event) => void setOnline(event.target.checked)} type="checkbox" /><span><strong>{online ? "允许学员提交时间申请" : "暂不接受新的时间申请"}</strong><small>切换不会删除历史预约，也不会取消已经确认的课程。</small></span></label>{notice ? <p className={styles.formNotice} role="status">{notice}</p> : null}</div></section>
    <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>待确认申请</h2><p>共 {pending.length} 条，可确认、拒绝或提出新方案</p></div></header>{pending.length ? <div className={styles.list}>{pending.map((booking) => <article className={styles.listItem} key={booking.id}><span className={styles.listIcon}><Clock3 aria-hidden size={19} /></span><div><h3>{booking.dateLabel} {booking.date} · {booking.time}–{booking.endTime}</h3><p>{booking.durationMinutes || 60}分钟 · {booking.locationType === "custom" ? `${booking.customDistrict || "期望区域"} ${booking.customAddress || "地点待沟通"}` : booking.venueName || "审核场馆"}</p></div><Link className={styles.secondary} href="/coach-workspace/bookings">处理</Link></article>)}</div> : <Empty copy="学员提交时间申请后会出现在这里。" title="当前没有待确认申请" />}</section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>已确认课程</h2><p>最终日程按北京时间展示</p></div></header>{confirmed.length ? <div className={styles.list}>{confirmed.map((booking) => <article className={styles.listItem} key={booking.id}><span className={styles.listIcon}><CalendarCheck2 aria-hidden size={19} /></span><div><h3>{booking.dateLabel} {booking.date}</h3><p>{booking.time}–{booking.endTime} · {booking.venueName || booking.customAddress || "训练地点"}</p></div><em className={styles.status}>已确认</em></article>)}</div> : <Empty copy="确认学员的时间申请后，课程会进入这里。" title="暂无已确认课程" />}</aside>
    </div></div>;
}

function CoachMessages({ busy, mutate, overview, refresh }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview; refresh: () => Promise<void> }) {
  const [activeId, setActiveId] = useState(overview.conversations[0]?.id || "");
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 15_000); return () => window.clearInterval(timer); }, [refresh]);
  const active = overview.conversations.find((item) => item.id === activeId) ?? overview.conversations[0];
  useEffect(() => {
    if (!active?.id || !active.unreadCount) return;
    void platformRequest(`/api/v1/coach/conversations/${encodeURIComponent(active.id)}/read`, { method: "POST" }).then(() => refresh()).catch(() => undefined);
  }, [active?.id, active?.unreadCount, refresh]);
  async function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!activeId) return; const form = new FormData(event.currentTarget); const body = String(form.get("message") || "").trim(); if (!body) return; if (await mutate(`/api/v1/coach/conversations/${encodeURIComponent(activeId)}/messages`, { body }, "消息已发送")) event.currentTarget.reset(); }
  return <div className={styles.page}><Heading copy="站内消息用于确认训练安排，锁屏通知不会展示未成年人姓名。" title="学员消息" /><section className={styles.panel}>{overview.conversations.length && active ? <div className={styles.conversation}><aside className={styles.conversationList}>{overview.conversations.map((item) => <button aria-pressed={activeId === item.id} key={item.id} onClick={() => setActiveId(item.id)} type="button"><strong>{item.title}</strong><span>{item.subtitle || "会话已建立"}</span></button>)}</aside><div className={styles.messagePane}><header><h2>{active.title}</h2></header><div className={styles.messages}>{active.messages.length ? active.messages.map((message) => <div className={styles.bubble} data-mine={message.sender === "coach"} key={message.id}>{message.body}<small>{message.createdAt}</small></div>) : <Empty copy="学员发出第一条消息后会显示完整沟通历史。" title="会话已建立" />}</div><form className={styles.compose} onSubmit={send}><input maxLength={1000} name="message" placeholder="输入回复" /><button className={styles.primary} disabled={Boolean(busy)} type="submit"><Send aria-hidden size={16} />发送</button></form></div></div> : <Empty copy="学员发起咨询或预约后，会话会出现在这里。" title="暂无学员会话" />}</section></div>;
}

function CourseRecords({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  const completed = overview.bookings.filter((booking) => booking.status === "completed");
  const [activeId, setActiveId] = useState(completed[0]?.id || "");
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; body: string; tags_json?: string; helpful_count?: number; reply_body?: string; reply_status?: string }>>([]);
  const [replying, setReplying] = useState<string | null>(null);
  const loadReviews = useCallback(async () => { try { setReviews(await platformRequest("/api/v1/coach/reviews")); } catch { setReviews([]); } }, []);
  useEffect(() => { queueMicrotask(() => void loadReviews()); }, [loadReviews]);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate("/api/v1/coach/training-records", { bookingId: form.get("bookingId"), coachNotes: form.get("coachNotes"), summary: form.get("summary") }, "训练记录已发布给学员"); }
  async function reply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!replying) return; const form = new FormData(event.currentTarget); if (await mutate(`/api/v1/coach/reviews/${encodeURIComponent(replying)}/reply`, { body: form.get("body") }, "回复已提交，审核通过后公开")) { setReplying(null); await loadReviews(); } }
  return <div className={styles.page}><Heading copy="课程完成后记录训练重点，并认真回应平台履约学员的真实评价。" title="课程记录与评价" />{completed.length ? <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>已完成课程</h2><p>选择一节课程补充记录</p></div></header><div className={styles.list}>{completed.map((booking) => <button aria-pressed={activeId === booking.id} className={styles.listItem} key={booking.id} onClick={() => setActiveId(booking.id)} type="button"><span className={styles.listIcon}><FileCheck2 aria-hidden size={19} /></span><div><h3>{booking.dateLabel} {booking.time}</h3><p>#{booking.id.slice(-8)} · {formatFen(booking.feeFen)}</p></div></button>)}</div></section><aside className={styles.panel}><header className={styles.panelHeader}><div><h2>发布训练记录</h2><p>发布后学员可在训练档案查看</p></div></header><form className={styles.form} onSubmit={save}><input name="bookingId" type="hidden" value={activeId} /><label className={styles.field}><span>本节总结</span><textarea maxLength={2000} name="summary" required /></label><label className={styles.field}><span>后续建议</span><textarea maxLength={2000} name="coachNotes" /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit">发布记录</button></form></aside></div> : <section className={styles.panel}><Empty copy="完成真实课程后即可建立学员训练档案。" title="暂无可记录课程" /></section>}<section className={styles.panel}><header className={styles.panelHeader}><div><h2>真实学员评价</h2><p>公开回复需要运营审核，学员原文不能修改或隐藏</p></div></header>{reviews.length ? <div className={styles.list}>{reviews.map((review) => <article className={styles.listItem} key={review.id}><span className={styles.listIcon}><Sparkles aria-hidden size={19} /></span><div><h3>{review.rating}/5 · {review.tags_json || "[]"}</h3><p>{review.body}</p><small>{review.reply_body ? `回复${review.reply_status === "approved" ? "已公开" : "审核中"}：${review.reply_body}` : `${review.helpful_count || 0}人认为有帮助`}</small></div>{!review.reply_body ? <button className={styles.secondary} onClick={() => setReplying(review.id)} type="button">公开回复</button> : null}</article>)}</div> : <Empty copy="学员评价审核公开后会显示在这里。" title="暂无公开评价" />}</section>{replying ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setReplying(null)}><form aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={reply} role="dialog"><h2>回复学员评价</h2><p>保持专业、客观，不填写学员姓名或联系方式。审核通过后公开展示。</p><label className={styles.field}><span>回复内容</span><textarea autoFocus maxLength={500} minLength={4} name="body" required /></label><div><button className={styles.secondary} onClick={() => setReplying(null)} type="button">取消</button><button className={styles.primary} disabled={Boolean(busy)} type="submit">提交审核</button></div></form></div> : null}</div>;
}

function PaymentManager({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  const eligible = overview.bookings.filter((booking) => ["confirmed", "completed"].includes(booking.status));
  return <div className={styles.page}><Heading copy="这里只记录线下收款结果，不在平台内收取费用。" title="线下收款" /><section className={styles.panel}>{eligible.length ? <div className={styles.table}><div className={styles.tableHead}><span>预约</span><span>课程时间</span><span>金额</span><span>收款状态</span><span>操作</span></div>{eligible.map((booking) => <article className={styles.tableRow} key={booking.id}><span><strong>#{booking.id.slice(-8)}</strong><small>{statusCopy[booking.status]}</small></span><span><strong>{booking.dateLabel} {booking.date}</strong><small>{booking.time}–{booking.endTime}</small></span><span><strong>{formatFen(booking.feeFen)}</strong><small>线下支付</small></span><span><em className={styles.status} data-tone={booking.paymentStatus === "offline_paid" ? "green" : "amber"}>{booking.paymentStatus === "offline_paid" ? "已收款" : "待收款"}</em></span><span><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => void mutate(`/api/v1/coach/bookings/${encodeURIComponent(booking.id)}/offline-payment`, { paid: booking.paymentStatus !== "offline_paid" }, booking.paymentStatus === "offline_paid" ? "已撤销收款标记" : "已标记线下收款")} type="button">{booking.paymentStatus === "offline_paid" ? "撤销标记" : "标记已收款"}</button></span></article>)}</div> : <Empty copy="已确认或已完成课程会出现在这里。" title="暂无待记录收款" />}</section></div>;
}

type CoachTicket = { id: string; subject?: string; status?: string; latest_message?: string; updated_at?: number; created_at?: number };
function CoachSupport({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  const [tickets, setTickets] = useState<CoachTicket[]>([]);
  const load = useCallback(async () => { try { setTickets(await platformRequest<CoachTicket[]>("/api/v1/coach/support-tickets")); } catch { setTickets([]); } }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); if (await mutate("/api/v1/coach/support-tickets", { bookingId: form.get("bookingId") || undefined, body: form.get("body"), category: form.get("category"), subject: form.get("subject") }, "售后工单已创建")) { event.currentTarget.reset(); await load(); } }
  return <div className={styles.page}><Heading copy="围绕预约履约、线下收款、安全或平台使用问题发起站内工单。" title="售后工单" /><div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>我的工单</h2><p>运营回复与状态会保留</p></div></header>{tickets.length ? <div className={styles.list}>{tickets.map((ticket) => <article className={styles.listItem} key={ticket.id}><span className={styles.listIcon}><FileCheck2 aria-hidden size={19} /></span><div><h3>{ticket.subject || `工单 #${ticket.id.slice(-8)}`}</h3><p>{ticket.latest_message || "等待运营处理"} · {formatBeijingDate(ticket.updated_at || ticket.created_at)}</p></div><em className={styles.status} data-tone={ticket.status === "resolved" || ticket.status === "closed" ? "green" : "amber"}>{ticket.status === "resolved" ? "已解决" : ticket.status === "closed" ? "已关闭" : "处理中"}</em></article>)}</div> : <Empty copy="需要平台协助时可创建第一条工单。" title="暂无售后工单" />}</section><aside className={styles.panel}><header className={styles.panelHeader}><div><h2>创建工单</h2><p>可关联具体预约</p></div></header><form className={styles.form} onSubmit={submit}><label className={styles.field}><span>问题主题</span><input maxLength={120} name="subject" required /></label><div className={styles.formGrid}><label className={styles.field}><span>问题类型</span><select name="category"><option value="service">服务履约</option><option value="booking">预约安排</option><option value="payment">线下收款</option><option value="safety">安全问题</option><option value="privacy">隐私问题</option><option value="other">其他</option></select></label><label className={styles.field}><span>关联预约</span><select name="bookingId"><option value="">不关联预约</option>{overview.bookings.map((booking) => <option key={booking.id} value={booking.id}>#{booking.id.slice(-8)} · {booking.dateLabel}</option>)}</select></label></div><label className={styles.field}><span>问题说明</span><textarea maxLength={3000} name="body" required /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit">提交工单</button></form></aside></div></div>;
}

type ProfileChange = { id: string; field: string; current_value_json?: string; proposed_value_json?: string; status: string; review_note?: string; created_at?: number; reviewed_at?: number };
const profileFieldLabels: Record<string, string> = { audience: "服务对象", bio: "个人介绍", district: "服务区域", goals: "训练目标", honors: "比赛荣誉", motto: "个人寄语", price: "常规课价格", strengths: "擅长方向", title: "教练头衔", trialPrice: "试课价格", venue: "训练场馆" };

function profileValue(value?: string) {
  if (!value) return "未填写";
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.join("、") : typeof parsed === "object" ? Object.values(parsed).filter(Boolean).join(" · ") : String(parsed); }
  catch { return value; }
}

function ProfileManager({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  const [requests, setRequests] = useState<ProfileChange[]>([]);
  const [requestError, setRequestError] = useState("");
  const loadRequests = useCallback(async () => { try { setRequests(await platformRequest<ProfileChange[]>("/api/v1/coach/profile-change-requests")); setRequestError(""); } catch (error) { setRequestError(error instanceof Error ? error.message : "申请记录暂时不可用"); } }, []);
  useEffect(() => { queueMicrotask(() => void loadRequests()); }, [loadRequests]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = String(form.get("field"));
    const raw = String(form.get("value") || "").trim();
    let value: unknown = raw;
    if (["audience", "goals", "honors", "strengths"].includes(field)) value = raw.split(/[，,、\n]/u).map((item) => item.trim()).filter(Boolean);
    if (field === "price" || field === "trialPrice") value = Number(raw);
    if (field === "venue") value = { address: raw, district: overview.coach.district, name: raw };
    if (await mutate("/api/v1/coach/profile-change-requests", { field, value }, "资料变更申请已提交审核")) { event.currentTarget.reset(); await loadRequests(); }
  }
  async function withdraw(id: string) { if (await mutate(`/api/v1/coach/profile-change-requests/${encodeURIComponent(id)}/withdraw`, {}, "资料变更申请已撤回")) await loadRequests(); }
  return <div className={styles.page}><Heading copy="公开资料变更先进入人工审核。审核前官网和 App 继续展示当前版本，每次变更都有完整记录。" title="资质与资料" />
    <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>当前公开档案</h2><p>学员端正在展示的已审核版本</p></div><em className={styles.status} data-tone="green">已审核</em></header><div className={styles.list}><div className={styles.listItem}><span className={styles.listIcon}><BadgeCheck aria-hidden size={19} /></span><div><h3>{overview.coach.name} · {overview.coach.title}</h3><p>{overview.coach.sport} · {coachServiceScope(overview.coach)}</p></div></div><div className={styles.listItem}><span className={styles.listIcon}><CircleDollarSign aria-hidden size={19} /></span><div><h3>常规课 {overview.coach.price == null ? "待发布" : `¥${overview.coach.price}`} · 试课 {overview.coach.trialPrice == null ? "待发布" : `¥${overview.coach.trialPrice}`}</h3><p>价格变更需审核后生效</p></div></div><div className={styles.listItem}><span className={styles.listIcon}><ShieldCheck aria-hidden size={19} /></span><div><h3>{overview.coach.verificationLabel}</h3><p>评价 {overview.coach.reviewCount} 条 · 已完成课程 {overview.coach.lessons} 节</p></div></div></div></section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>申请资料变更</h2><p>同一字段有待审核申请时不能重复提交</p></div></header><form className={styles.form} onSubmit={submit}><label className={styles.field}><span>变更项目</span><select name="field"><option value="bio">个人介绍</option><option value="title">教练头衔</option><option value="district">服务区域</option><option value="venue">训练场馆</option><option value="price">常规课价格</option><option value="trialPrice">试课价格</option><option value="audience">服务对象</option><option value="goals">训练目标</option><option value="strengths">擅长方向</option><option value="honors">比赛荣誉</option><option value="motto">个人寄语</option></select></label><label className={styles.field}><span>新的内容</span><textarea maxLength={1500} name="value" placeholder="多项内容请用逗号分隔；价格直接填写元数" required /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit">提交审核</button></form></aside></div>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>变更申请记录</h2><p>草稿提交、审核、拒绝与撤回状态均保留</p></div></header>{requests.length ? <div className={styles.table}><div className={styles.tableHead}><span>变更字段</span><span>原公开值</span><span>申请值</span><span>状态</span><span>操作</span></div>{requests.map((item) => <article className={styles.tableRow} key={item.id}><span><strong>{profileFieldLabels[item.field] || item.field}</strong><small>{formatBeijingDate(item.created_at)}</small></span><span><strong>{profileValue(item.current_value_json)}</strong><small>提交时线上值</small></span><span><strong>{profileValue(item.proposed_value_json)}</strong><small>申请内容</small></span><span><em className={styles.status} data-tone={item.status === "approved" ? "green" : item.status === "pending" ? "amber" : "gray"}>{item.status === "approved" ? "已通过" : item.status === "rejected" ? "已拒绝" : item.status === "cancelled" ? "已撤回" : "待审核"}</em><small>{item.review_note || "等待运营审核"}</small></span><span>{item.status === "pending" ? <button className={styles.danger} disabled={Boolean(busy)} onClick={() => void withdraw(item.id)} type="button">撤回</button> : <small>{item.reviewed_at ? formatBeijingDate(item.reviewed_at) : "已归档"}</small>}</span></article>)}</div> : <Empty copy={requestError || "提交第一条资料变更申请后，会在这里显示审核进度。"} title="暂无变更申请" />}</section>
  </div>;
}

function Empty({ copy, title }: { copy: string; title: string }) { return <div className={styles.empty}><Sparkles aria-hidden size={28} /><strong>{title}</strong><p>{copy}</p></div>; }
function Loading({ label }: { label: string }) { return <LoadingState label={label} />; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>工作台暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>; }
