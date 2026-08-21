"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatBeijingDateTimeLocal, nextBeijingSlotDefaults, parseBeijingDateTimeLocal, validateScheduleDraft } from "../../shared/scheduling";
import type { BookingStatus, CoachOverview, MobileBooking } from "../mobile/types";
import { formatBeijingDate, formatFen, PlatformRequestError, platformRequest } from "./platform-client";
import styles from "./platform-pages.module.css";

export type CoachSection = "home" | "bookings" | "schedule" | "messages" | "courses" | "payments" | "credentials" | "support";

const statusCopy: Record<BookingStatus, string> = {
  cancelled_by_coach: "教练已取消",
  cancelled_by_student: "学员已取消",
  completed: "已完成",
  confirmed: "已确认",
  pending_coach: "待确认",
  rejected: "已拒绝",
  reschedule_requested: "申请改期",
};

function statusTone(status: BookingStatus) {
  if (status === "confirmed" || status === "completed") return "green";
  if (status === "pending_coach" || status === "reschedule_requested") return "amber";
  return "gray";
}

function useCoachOverview() {
  const [data, setData] = useState<CoachOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await platformRequest<CoachOverview>("/api/v1/coach/overview")); setError(""); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "教练工作台暂时不可用"); }
    finally { setLoading(false); }
  }, []);
  const refresh = useCallback(async () => { try { setData(await platformRequest<CoachOverview>("/api/v1/coach/overview")); setError(""); } catch { /* Keep the last working state during polling. */ } }, []);
  useEffect(() => {
    let active = true;
    void platformRequest<CoachOverview>("/api/v1/coach/overview")
      .then((result) => { if (active) { setData(result); setError(""); } })
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
  if (section === "bookings") content = <BookingManager bookings={state.data.bookings} busy={busy} mutate={mutate} slots={state.data.slots} />;
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

function CoachHome({ overview }: { overview: CoachOverview }) {
  const pending = overview.bookings.filter((item) => ["pending_coach", "reschedule_requested"].includes(item.status));
  const confirmed = overview.bookings.filter((item) => item.status === "confirmed");
  const unpaid = overview.bookings.filter((item) => item.status === "completed" && item.paymentStatus === "offline_unpaid");
  return <div className={styles.page}>
    <Heading action={<Link className={styles.primary} href="/coach-workspace/schedule"><CalendarPlus aria-hidden size={16} />发布可约时间</Link>} copy="待办数量与服务状态来自正式数据库，空数据不会用演示记录补齐。" title={`${overview.coach.name}，今天的工作已经整理好`} />
    <section className={styles.metrics}>
      <article><span>待处理预约</span><strong>{pending.length}</strong><small>确认、改期或拒绝</small></article>
      <article><span>已确认课程</span><strong>{confirmed.length}</strong><small>等待到场履约</small></article>
      <article><span>开放时段</span><strong>{overview.slots.length}</strong><small>未来可预约时段</small></article>
      <article><span>待标记收款</span><strong>{unpaid.length}</strong><small>仅记录线下支付结果</small></article>
    </section>
    <div className={styles.split}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>优先处理</h2><p>需要教练明确回应的预约申请</p></div><Link className={styles.secondary} href="/coach-workspace/bookings">全部预约</Link></header>
        {pending.length ? <div className={styles.list}>{pending.slice(0, 5).map((booking) => <article className={styles.listItem} key={booking.id}><span className={styles.listIcon}><Clock3 aria-hidden size={19} /></span><div><h3>{booking.dateLabel} {booking.time}–{booking.endTime}</h3><p>{formatFen(booking.feeFen)} · {statusCopy[booking.status]}</p></div><Link className={styles.secondary} href="/coach-workspace/bookings">处理 <ArrowRight aria-hidden size={15} /></Link></article>)}</div> : <Empty title="当前没有待处理预约" copy="新预约提交后会立即进入这里，并同步到教练端通知。" />}
      </section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>服务资料</h2><p>公开档案与工作状态</p></div></header><div className={styles.list}>
        <div className={styles.listItem}><span className={styles.listIcon}><BadgeCheck aria-hidden size={19} /></span><div><h3>{overview.coach.verificationLabel}</h3><p>{overview.coach.sport} · {overview.coach.district}</p></div><em className={styles.status}>已上线</em></div>
        <div className={styles.listItem}><span className={styles.listIcon}><MapPin aria-hidden size={19} /></span><div><h3>合作训练场</h3><p>{overview.venues?.[0]?.name || "尚未发布场馆"}</p></div></div>
        <Link className={styles.listItem} href="/coach-workspace/credentials"><span className={styles.listIcon}><ShieldCheck aria-hidden size={19} /></span><div><h3>资料变更</h3><p>提交后由运营审核，不直接改写公开档案</p></div><ArrowRight aria-hidden size={16} /></Link>
      </div></aside>
    </div>
  </div>;
}

function BookingManager({ bookings, busy, mutate, slots }: { bookings: MobileBooking[]; busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; slots: CoachOverview["slots"] }) {
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const [rescheduleBooking, setRescheduleBooking] = useState<MobileBooking | null>(null);
  const [rescheduleSlotId, setRescheduleSlotId] = useState(slots[0]?.id || "");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const rows = useMemo(() => bookings.filter((booking) => filter === "all" || (filter === "done" ? ["completed", "cancelled_by_coach", "cancelled_by_student", "rejected"].includes(booking.status) : ["pending_coach", "confirmed", "reschedule_requested"].includes(booking.status))), [bookings, filter]);
  async function transition(id: string, status: BookingStatus) {
    await mutate(`/api/v1/coach/bookings/${encodeURIComponent(id)}/status`, { status }, `预约已更新为“${statusCopy[status]}”`);
  }
  async function proposeReschedule() {
    if (!rescheduleBooking || !rescheduleSlotId) return;
    const ok = await mutate("/api/v1/coach/reschedule-proposals", { bookingId: rescheduleBooking.id, note: rescheduleNote, slotId: rescheduleSlotId }, "改期方案已发送，等待学员确认");
    if (ok) { setRescheduleBooking(null); setRescheduleNote(""); }
  }
  return <div className={styles.page}>
    <Heading copy="确认、改期、拒绝和完成课程都会写入状态事件，并通知对应学员。" title="预约管理" />
    <section className={styles.panel}><header className={styles.panelHeader}><div className={styles.toolbar}>{([['active', '待处理'], ['all', '全部'], ['done', '已结束']] as const).map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? styles.primary : styles.secondary} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}</div></header>
      {rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>预约</span><span>时间</span><span>费用</span><span>状态</span><span>操作</span></div>{rows.map((booking) => <article className={styles.tableRow} key={booking.id}><span><strong>#{booking.id.slice(-8)}</strong><small>{booking.note || "未填写备注"}</small></span><span><strong>{booking.dateLabel} {booking.date}</strong><small>{booking.time}–{booking.endTime}</small></span><span><strong>{formatFen(booking.feeFen)}</strong><small>{booking.paymentStatus === "offline_paid" ? "线下已收款" : "线下待支付"}</small></span><span><em className={styles.status} data-tone={statusTone(booking.status)}>{statusCopy[booking.status]}</em></span><span className={styles.rowActions}>{booking.status === "pending_coach" ? <><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "confirmed")} type="button">确认</button><button className={styles.secondary} disabled={Boolean(busy) || !slots.length} onClick={() => { setRescheduleBooking(booking); setRescheduleSlotId(slots[0]?.id || ""); }} type="button">提出改期</button><button className={styles.danger} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "rejected")} type="button">拒绝</button></> : booking.status === "confirmed" ? <><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "completed")} type="button">完成课程</button><button className={styles.secondary} disabled={Boolean(busy) || !slots.length} onClick={() => { setRescheduleBooking(booking); setRescheduleSlotId(slots[0]?.id || ""); }} type="button">提出改期</button><button className={styles.danger} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "cancelled_by_coach")} type="button">取消</button></> : null}</span></article>)}</div> : <Empty title="当前筛选下没有预约" copy="预约列表只展示真实业务记录，不会补入试点演示数据。" />}
    </section>
    {rescheduleBooking ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setRescheduleBooking(null)}><section aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2>提出改期方案</h2><p>选择一个真实开放时段。学员接受前，原预约安排保持可追溯。</p><label className={styles.field}><span>新的训练时间</span><select onChange={(event) => setRescheduleSlotId(event.target.value)} value={rescheduleSlotId}>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.dateLabel} {slot.date} {slot.time}–{slot.endTime}</option>)}</select></label><label className={styles.field}><span>改期说明</span><textarea maxLength={500} onChange={(event) => setRescheduleNote(event.target.value)} value={rescheduleNote} /></label><div><button className={styles.secondary} onClick={() => setRescheduleBooking(null)} type="button">取消</button><button className={styles.primary} disabled={!rescheduleSlotId || Boolean(busy)} onClick={() => void proposeReschedule()} type="button">发送给学员</button></div></section></div> : null}
  </div>;
}

function ScheduleManager({ overview, refresh }: { overview: CoachOverview; refresh: () => Promise<void> }) {
  const defaults = useMemo(() => nextBeijingSlotDefaults(), []);
  const [startsAt, setStartsAt] = useState(defaults.startsAt);
  const [endsAt, setEndsAt] = useState(defaults.endsAt);
  const [venueId, setVenueId] = useState(overview.venues[0]?.id || "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  function applyDuration(minutes: number) {
    const start = parseBeijingDateTimeLocal(startsAt);
    if (Number.isFinite(start)) setEndsAt(formatBeijingDateTimeLocal(start + minutes * 60_000));
  }
  async function remove(slotId: string) {
    setSubmitting(true); setNotice("");
    try { await platformRequest(`/api/v1/coach/slots/${encodeURIComponent(slotId)}`, { method: "DELETE" }); setNotice("可约时段已撤销"); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "时段撤销失败"); }
    finally { setSubmitting(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { endsAt: parseBeijingDateTimeLocal(endsAt), startsAt: parseBeijingDateTimeLocal(startsAt), venueId };
    const errors = validateScheduleDraft(draft);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSubmitting(true); setFieldErrors({}); setNotice("");
    try {
      await platformRequest("/api/v1/coach/slots", { body: draft, method: "POST" });
      setNotice("可约时间已发布");
      const next = nextBeijingSlotDefaults(); setStartsAt(next.startsAt); setEndsAt(next.endsAt);
      await refresh();
    } catch (error) {
      if (error instanceof PlatformRequestError && error.fieldErrors) setFieldErrors(error.fieldErrors);
      else setNotice(error instanceof Error ? error.message : "时段发布失败");
    } finally { setSubmitting(false); }
  }
  return <div className={styles.page}><Heading copy="时段发布后才会出现在学员预约页；已被占用的时段不能重复创建。" title="排期与场馆" />
    <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>已开放时段</h2><p>共 {overview.slots.length} 个未来时段</p></div></header>{overview.slots.length ? <div className={styles.list}>{overview.slots.map((slot) => <article className={styles.listItem} key={slot.id}><span className={styles.listIcon}><CalendarCheck2 aria-hidden size={19} /></span><div><h3>{slot.dateLabel} {slot.date}</h3><p>{slot.time}–{slot.endTime} · {overview.venues.find((venue) => venue.id === slot.venueId)?.name || slot.venueName || "合作训练场"}</p></div><span className={styles.rowActions}><em className={styles.status}>可预约</em><button className={styles.danger} disabled={submitting} onClick={() => void remove(slot.id)} type="button">撤销</button></span></article>)}</div> : <Empty copy="发布第一个真实场馆时段后，学员端会自动开放预约入口。" title="暂无可约时段" />}</section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>发布时段</h2><p>统一按北京时间保存与展示</p></div></header>{overview.venues.length ? <form className={styles.form} onSubmit={submit}><label className={styles.field}><span>训练场馆</span><select aria-invalid={Boolean(fieldErrors.venueId)} onChange={(event) => setVenueId(event.target.value)} required value={venueId}>{overview.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select>{fieldErrors.venueId ? <small className={styles.fieldError}>{fieldErrors.venueId}</small> : null}</label><div className={styles.formGrid}><label className={styles.field}><span>开始时间</span><input aria-invalid={Boolean(fieldErrors.startsAt)} min={defaults.min} onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} />{fieldErrors.startsAt ? <small className={styles.fieldError}>{fieldErrors.startsAt}</small> : null}</label><label className={styles.field}><span>结束时间</span><input aria-invalid={Boolean(fieldErrors.endsAt)} min={startsAt || defaults.min} onChange={(event) => setEndsAt(event.target.value)} required type="datetime-local" value={endsAt} />{fieldErrors.endsAt ? <small className={styles.fieldError}>{fieldErrors.endsAt}</small> : null}</label></div><div className={styles.durationOptions} aria-label="快捷设置训练时长"><span>训练时长</span>{[60, 90, 120].map((minutes) => <button key={minutes} onClick={() => applyDuration(minutes)} type="button">{minutes}分钟</button>)}</div><button className={styles.primary} disabled={submitting} type="submit"><CalendarPlus aria-hidden size={16} />{submitting ? "正在发布" : "发布时段"}</button>{notice ? <p className={styles.formNotice} role="status">{notice}</p> : null}</form> : <Empty copy="请先由运营人员审核并发布合作训练场。" title="场馆资料尚未就绪" />}</aside>
    </div></div>;
}

function CoachMessages({ busy, mutate, overview, refresh }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview; refresh: () => Promise<void> }) {
  const [activeId, setActiveId] = useState(overview.conversations[0]?.id || "");
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 15_000); return () => window.clearInterval(timer); }, [refresh]);
  async function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!activeId) return; const form = new FormData(event.currentTarget); const body = String(form.get("message") || "").trim(); if (!body) return; if (await mutate(`/api/v1/coach/conversations/${encodeURIComponent(activeId)}/messages`, { body }, "消息已发送")) event.currentTarget.reset(); }
  const active = overview.conversations.find((item) => item.id === activeId) ?? overview.conversations[0];
  return <div className={styles.page}><Heading copy="站内消息用于确认训练安排，锁屏通知不会展示未成年人姓名。" title="学员消息" /><section className={styles.panel}>{overview.conversations.length && active ? <div className={styles.conversation}><aside className={styles.conversationList}>{overview.conversations.map((item) => <button aria-pressed={activeId === item.id} key={item.id} onClick={() => setActiveId(item.id)} type="button"><strong>{item.title}</strong><span>{item.subtitle || "会话已建立"}</span></button>)}</aside><div className={styles.messagePane}><header><h2>{active.title}</h2></header><div className={styles.messages}>{active.messages.length ? active.messages.map((message) => <div className={styles.bubble} data-mine={message.sender === "coach"} key={message.id}>{message.body}<small>{message.createdAt}</small></div>) : <Empty copy="学员发出第一条消息后会显示完整沟通历史。" title="会话已建立" />}</div><form className={styles.compose} onSubmit={send}><input maxLength={1000} name="message" placeholder="输入回复" /><button className={styles.primary} disabled={Boolean(busy)} type="submit"><Send aria-hidden size={16} />发送</button></form></div></div> : <Empty copy="学员发起咨询或预约后，会话会出现在这里。" title="暂无学员会话" />}</section></div>;
}

function CourseRecords({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  const completed = overview.bookings.filter((booking) => booking.status === "completed");
  const [activeId, setActiveId] = useState(completed[0]?.id || "");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate("/api/v1/coach/training-records", { bookingId: form.get("bookingId"), coachNotes: form.get("coachNotes"), summary: form.get("summary") }, "训练记录已发布给学员"); }
  return <div className={styles.page}><Heading copy="课程完成后记录训练重点、学员表现和下一步建议。" title="课程记录" />{completed.length ? <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>已完成课程</h2><p>选择一节课程补充记录</p></div></header><div className={styles.list}>{completed.map((booking) => <button aria-pressed={activeId === booking.id} className={styles.listItem} key={booking.id} onClick={() => setActiveId(booking.id)} type="button"><span className={styles.listIcon}><FileCheck2 aria-hidden size={19} /></span><div><h3>{booking.dateLabel} {booking.time}</h3><p>#{booking.id.slice(-8)} · {formatFen(booking.feeFen)}</p></div></button>)}</div></section><aside className={styles.panel}><header className={styles.panelHeader}><div><h2>发布训练记录</h2><p>发布后学员可在训练档案查看</p></div></header><form className={styles.form} onSubmit={save}><input name="bookingId" type="hidden" value={activeId} /><label className={styles.field}><span>本节总结</span><textarea maxLength={2000} name="summary" required /></label><label className={styles.field}><span>后续建议</span><textarea maxLength={2000} name="coachNotes" /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit">发布记录</button></form></aside></div> : <section className={styles.panel}><Empty copy="完成真实课程后即可建立学员训练档案。" title="暂无可记录课程" /></section>}</div>;
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
    <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>当前公开档案</h2><p>学员端正在展示的已审核版本</p></div><em className={styles.status} data-tone="green">已审核</em></header><div className={styles.list}><div className={styles.listItem}><span className={styles.listIcon}><BadgeCheck aria-hidden size={19} /></span><div><h3>{overview.coach.name} · {overview.coach.title}</h3><p>{overview.coach.sport} · {overview.coach.district}</p></div></div><div className={styles.listItem}><span className={styles.listIcon}><CircleDollarSign aria-hidden size={19} /></span><div><h3>常规课 {overview.coach.price == null ? "待发布" : `¥${overview.coach.price}`} · 试课 {overview.coach.trialPrice == null ? "待发布" : `¥${overview.coach.trialPrice}`}</h3><p>价格变更需审核后生效</p></div></div><div className={styles.listItem}><span className={styles.listIcon}><ShieldCheck aria-hidden size={19} /></span><div><h3>{overview.coach.verificationLabel}</h3><p>评价 {overview.coach.reviewCount} 条 · 已完成课程 {overview.coach.lessons} 节</p></div></div></div></section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>申请资料变更</h2><p>同一字段有待审核申请时不能重复提交</p></div></header><form className={styles.form} onSubmit={submit}><label className={styles.field}><span>变更项目</span><select name="field"><option value="bio">个人介绍</option><option value="title">教练头衔</option><option value="district">服务区域</option><option value="venue">训练场馆</option><option value="price">常规课价格</option><option value="trialPrice">试课价格</option><option value="audience">服务对象</option><option value="goals">训练目标</option><option value="strengths">擅长方向</option><option value="honors">比赛荣誉</option><option value="motto">个人寄语</option></select></label><label className={styles.field}><span>新的内容</span><textarea maxLength={1500} name="value" placeholder="多项内容请用逗号分隔；价格直接填写元数" required /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit">提交审核</button></form></aside></div>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>变更申请记录</h2><p>草稿提交、审核、拒绝与撤回状态均保留</p></div></header>{requests.length ? <div className={styles.table}><div className={styles.tableHead}><span>变更字段</span><span>原公开值</span><span>申请值</span><span>状态</span><span>操作</span></div>{requests.map((item) => <article className={styles.tableRow} key={item.id}><span><strong>{profileFieldLabels[item.field] || item.field}</strong><small>{formatBeijingDate(item.created_at)}</small></span><span><strong>{profileValue(item.current_value_json)}</strong><small>提交时线上值</small></span><span><strong>{profileValue(item.proposed_value_json)}</strong><small>申请内容</small></span><span><em className={styles.status} data-tone={item.status === "approved" ? "green" : item.status === "pending" ? "amber" : "gray"}>{item.status === "approved" ? "已通过" : item.status === "rejected" ? "已拒绝" : item.status === "cancelled" ? "已撤回" : "待审核"}</em><small>{item.review_note || "等待运营审核"}</small></span><span>{item.status === "pending" ? <button className={styles.danger} disabled={Boolean(busy)} onClick={() => void withdraw(item.id)} type="button">撤回</button> : <small>{item.reviewed_at ? formatBeijingDate(item.reviewed_at) : "已归档"}</small>}</span></article>)}</div> : <Empty copy={requestError || "提交第一条资料变更申请后，会在这里显示审核进度。"} title="暂无变更申请" />}</section>
  </div>;
}

function Empty({ copy, title }: { copy: string; title: string }) { return <div className={styles.empty}><Sparkles aria-hidden size={28} /><strong>{title}</strong><p>{copy}</p></div>; }
function Loading({ label }: { label: string }) { return <div className={styles.loading}><LoaderCircle aria-hidden size={27} /><span>{label}</span></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>工作台暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>; }
