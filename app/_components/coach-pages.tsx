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
import type { BookingStatus, CoachOverview, MobileBooking } from "../mobile/types";
import { formatFen, platformRequest } from "./platform-client";
import styles from "./platform-pages.module.css";

export type CoachSection = "home" | "bookings" | "schedule" | "messages" | "courses" | "payments" | "credentials";

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
  useEffect(() => {
    let active = true;
    void platformRequest<CoachOverview>("/api/v1/coach/overview")
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "教练工作台暂时不可用"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { data, error, load, loading };
}

export function CoachPage({ section }: { section: CoachSection }) {
  const state = useCoachOverview();
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");
  if (state.loading) return <Loading label="正在读取教练工作台" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;

  async function mutate(path: string, body: unknown, success: string) {
    setBusy(path); setActionError("");
    try { await platformRequest(path, { body, method: "POST" }); setNotice(success); await state.load(); window.setTimeout(() => setNotice(""), 2600); return true; }
    catch (error) { setActionError(error instanceof Error ? error.message : "操作没有完成"); return false; }
    finally { setBusy(""); }
  }

  let content: React.ReactNode;
  if (section === "bookings") content = <BookingManager bookings={state.data.bookings} busy={busy} mutate={mutate} />;
  else if (section === "schedule") content = <ScheduleManager busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "messages") content = <CoachMessages busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "courses") content = <CourseRecords busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "payments") content = <PaymentManager busy={busy} overview={state.data} mutate={mutate} />;
  else if (section === "credentials") content = <ProfileManager busy={busy} overview={state.data} mutate={mutate} />;
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

function BookingManager({ bookings, busy, mutate }: { bookings: MobileBooking[]; busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean> }) {
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const rows = useMemo(() => bookings.filter((booking) => filter === "all" || (filter === "done" ? ["completed", "cancelled_by_coach", "cancelled_by_student", "rejected"].includes(booking.status) : ["pending_coach", "confirmed", "reschedule_requested"].includes(booking.status))), [bookings, filter]);
  async function transition(id: string, status: BookingStatus) {
    await mutate(`/api/v1/coach/bookings/${encodeURIComponent(id)}/status`, { status }, `预约已更新为“${statusCopy[status]}”`);
  }
  return <div className={styles.page}>
    <Heading copy="确认、改期、拒绝和完成课程都会写入状态事件，并通知对应学员。" title="预约管理" />
    <section className={styles.panel}><header className={styles.panelHeader}><div className={styles.toolbar}>{([['active', '待处理'], ['all', '全部'], ['done', '已结束']] as const).map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? styles.primary : styles.secondary} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}</div></header>
      {rows.length ? <div className={styles.table}><div className={styles.tableHead}><span>预约</span><span>时间</span><span>费用</span><span>状态</span><span>操作</span></div>{rows.map((booking) => <article className={styles.tableRow} key={booking.id}><span><strong>#{booking.id.slice(-8)}</strong><small>{booking.note || "未填写备注"}</small></span><span><strong>{booking.dateLabel} {booking.date}</strong><small>{booking.time}–{booking.endTime}</small></span><span><strong>{formatFen(booking.feeFen)}</strong><small>{booking.paymentStatus === "offline_paid" ? "线下已收款" : "线下待支付"}</small></span><span><em className={styles.status} data-tone={statusTone(booking.status)}>{statusCopy[booking.status]}</em></span><span className={styles.rowActions}>{booking.status === "pending_coach" ? <><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "confirmed")} type="button">确认</button><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "reschedule_requested")} type="button">改期</button><button className={styles.danger} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "rejected")} type="button">拒绝</button></> : booking.status === "confirmed" ? <><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "completed")} type="button">完成课程</button><button className={styles.danger} disabled={Boolean(busy)} onClick={() => void transition(booking.id, "cancelled_by_coach")} type="button">取消</button></> : null}</span></article>)}</div> : <Empty title="当前筛选下没有预约" copy="预约列表只展示真实业务记录，不会补入试点演示数据。" />}
    </section>
  </div>;
}

function ScheduleManager({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const startsAt = new Date(String(form.get("startsAt"))).getTime();
    const endsAt = new Date(String(form.get("endsAt"))).getTime();
    const ok = await mutate("/api/v1/coach/slots", { endsAt, startsAt, venueId: form.get("venueId") }, "可约时间已发布");
    if (ok) event.currentTarget.reset();
  }
  return <div className={styles.page}><Heading copy="时段发布后才会出现在学员预约页；已被占用的时段不能重复创建。" title="排期与场馆" />
    <div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>已开放时段</h2><p>共 {overview.slots.length} 个未来时段</p></div></header>{overview.slots.length ? <div className={styles.list}>{overview.slots.map((slot) => <article className={styles.listItem} key={slot.id}><span className={styles.listIcon}><CalendarCheck2 aria-hidden size={19} /></span><div><h3>{slot.dateLabel} {slot.date}</h3><p>{slot.time}–{slot.endTime} · {overview.venues?.find((venue) => venue.id === slot.venueId)?.name || "合作训练场"}</p></div><em className={styles.status}>可预约</em></article>)}</div> : <Empty copy="发布第一个真实场馆时段后，学员端会自动开放预约入口。" title="暂无可约时段" />}</section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>发布时段</h2><p>按北京时间填写</p></div></header>{overview.venues?.length ? <form className={styles.form} onSubmit={submit}><label className={styles.field}><span>训练场馆</span><select name="venueId" required>{overview.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label><label className={styles.field}><span>开始时间</span><input name="startsAt" required type="datetime-local" /></label><label className={styles.field}><span>结束时间</span><input name="endsAt" required type="datetime-local" /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit"><CalendarPlus aria-hidden size={16} />发布时段</button></form> : <Empty copy="请先由运营人员审核并发布合作训练场。" title="场馆资料尚未就绪" />}</aside>
    </div></div>;
}

function CoachMessages({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  const [activeId, setActiveId] = useState(overview.conversations[0]?.id || "");
  async function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!activeId) return; const form = new FormData(event.currentTarget); const body = String(form.get("message") || "").trim(); if (!body) return; if (await mutate(`/api/v1/coach/conversations/${encodeURIComponent(activeId)}/messages`, { body }, "消息已发送")) event.currentTarget.reset(); }
  return <div className={styles.page}><Heading copy="站内消息用于确认训练安排，锁屏通知不会展示未成年人姓名。" title="学员消息" /><section className={styles.panel}>{overview.conversations.length ? <div className={styles.conversation}><aside className={styles.conversationList}>{overview.conversations.map((item) => <button aria-pressed={activeId === item.id} key={item.id} onClick={() => setActiveId(item.id)} type="button"><strong>{item.title}</strong><span>{item.last_message_at ? "最近有新消息" : "会话已建立"}</span></button>)}</aside><div className={styles.messagePane}><header><h2>{overview.conversations.find((item) => item.id === activeId)?.title || "学员会话"}</h2></header><div className={styles.messages}><Empty copy="出于最小展示原则，教练概览只读取会话摘要。发送的回复会写入正式消息记录。" title="回复学员" /></div><form className={styles.compose} onSubmit={send}><input maxLength={1000} name="message" placeholder="输入回复" /><button className={styles.primary} disabled={Boolean(busy)} type="submit"><Send aria-hidden size={16} />发送</button></form></div></div> : <Empty copy="学员发起咨询或预约后，会话会出现在这里。" title="暂无学员会话" />}</section></div>;
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

function ProfileManager({ busy, mutate, overview }: { busy: string; mutate: (path: string, body: unknown, success: string) => Promise<boolean>; overview: CoachOverview }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate("/api/v1/coach/profile-change-requests", { field: form.get("field"), value: form.get("value") }, "资料变更申请已提交审核"); }
  return <div className={styles.page}><Heading copy="公开资料变更先进入人工审核，资质原件不会出现在公开页面。" title="资质与资料" /><div className={styles.split}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>当前公开档案</h2><p>学员端正在展示的资料</p></div><em className={styles.status}>已审核</em></header><div className={styles.list}><div className={styles.listItem}><span className={styles.listIcon}><BadgeCheck aria-hidden size={19} /></span><div><h3>{overview.coach.name} · {overview.coach.title}</h3><p>{overview.coach.sport} · {overview.coach.district}</p></div></div><div className={styles.listItem}><span className={styles.listIcon}><CircleDollarSign aria-hidden size={19} /></span><div><h3>常规课 ¥{overview.coach.price} · 试课 ¥{overview.coach.trialPrice}</h3><p>价格变更需审核后生效</p></div></div><div className={styles.listItem}><span className={styles.listIcon}><ShieldCheck aria-hidden size={19} /></span><div><h3>{overview.coach.verificationLabel}</h3><p>评价 {overview.coach.reviewCount} 条 · 已完成课程 {overview.coach.lessons} 节</p></div></div></div></section><aside className={styles.panel}><header className={styles.panelHeader}><div><h2>申请资料变更</h2><p>提交后由运营人员核验</p></div></header><form className={styles.form} onSubmit={submit}><label className={styles.field}><span>变更项目</span><select name="field"><option value="bio">个人介绍</option><option value="title">教练头衔</option><option value="district">服务区域</option><option value="venue">训练场馆</option><option value="price">常规课价格</option><option value="trialPrice">试课价格</option><option value="goals">训练方向</option></select></label><label className={styles.field}><span>新的内容</span><textarea maxLength={1500} name="value" required /></label><button className={styles.primary} disabled={Boolean(busy)} type="submit">提交审核</button></form></aside></div></div>;
}

function Empty({ copy, title }: { copy: string; title: string }) { return <div className={styles.empty}><Sparkles aria-hidden size={28} /><strong>{title}</strong><p>{copy}</p></div>; }
function Loading({ label }: { label: string }) { return <div className={styles.loading}><LoaderCircle aria-hidden size={27} /><span>{label}</span></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>工作台暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>; }
