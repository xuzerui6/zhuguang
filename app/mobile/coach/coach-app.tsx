"use client";

import {
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Grid2X2,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mobileApi, usesBundledDemoData } from "../api-client";
import { createDemoBooking, createDemoConversations, createDemoSlots, demoCoaches } from "../demo-data";
import { impact, listenForAppResume } from "../device";
import { formatBeijingDateTimeLocal, nextBeijingSlotDefaults, parseBeijingDateTimeLocal, validateScheduleDraft } from "../../../shared/scheduling";
import type {
  BookingStatus,
  CoachAccountSummary,
  CoachOverview,
  CoachTab,
  MobileBooking,
  MobileConversation,
} from "../types";

type CoachAppProps = {
  initialTab: CoachTab;
  onOpenUpdates: () => void;
  onSwitchStudent: () => void;
  onTabChange: (tab: CoachTab) => void;
  summary: CoachAccountSummary;
};

type AppointmentFilter = "active" | "completed" | "pending";

const tabItems: Array<{ icon: typeof LayoutDashboard; label: string; tab: CoachTab }> = [
  { icon: LayoutDashboard, label: "工作台", tab: "workspace" },
  { icon: CalendarDays, label: "预约", tab: "appointments" },
  { icon: Grid2X2, label: "排期", tab: "schedule" },
  { icon: MessageCircle, label: "消息", tab: "messages" },
  { icon: UserRound, label: "我的", tab: "profile" },
];

const statusCopy: Record<BookingStatus, string> = {
  cancelled_by_coach: "已取消",
  cancelled_by_student: "学员已取消",
  completed: "已完成",
  confirmed: "已确认",
  pending_coach: "待确认",
  rejected: "已拒绝",
  reschedule_requested: "待改期",
};

export function createDemoCoachOverview(summary: CoachAccountSummary): CoachOverview {
  const pending = { ...createDemoBooking(), id: "booking_coach_pending", status: "pending_coach" as const };
  const pendingTwo = { ...pending, id: "booking_coach_pending_2", learnerId: "learner_xu", time: "18:00", endTime: "19:30" };
  const pendingThree = { ...pending, dateLabel: "后天", id: "booking_coach_pending_3", learnerId: "learner_li", time: "10:00", endTime: "11:30" };
  const confirmed = {
    ...createDemoBooking(),
    dateLabel: "明天",
    id: "booking_coach_confirmed",
    paymentStatus: "offline_unpaid" as const,
    status: "confirmed" as const,
    time: "14:00",
    endTime: "15:30",
  };
  return {
    bookings: [pending, pendingTwo, pendingThree, confirmed],
    coach: { ...demoCoaches[0], id: summary.id, name: summary.name, sport: summary.sport, title: summary.title },
    conversations: createDemoConversations(),
    slots: createDemoSlots(summary.id).filter((slot) => slot.available),
    venues: [{ active: true, address: "北京市通州区合作训练场", coachId: summary.id, district: "通州区", id: "venue_demo", name: "合作训练场" }],
  };
}

function BookingRow({
  booking,
  compact = false,
  onAction,
  sport,
}: {
  booking: MobileBooking;
  compact?: boolean;
  onAction: (booking: MobileBooking, status: BookingStatus | "paid") => void;
  sport: string;
}) {
  const pending = booking.status === "pending_coach";
  return (
    <article className="zg-coach-booking-row">
      <span className="zg-coach-student-avatar">{booking.learnerId.slice(-2).toUpperCase()}</span>
      <div className="zg-coach-booking-copy">
        <div><strong>{booking.learnerName || "预约学员"}</strong><small>{statusCopy[booking.status]}</small></div>
        <p><CalendarDays aria-hidden size={14} />{booking.dateLabel} {booking.time}-{booking.endTime}</p>
        <p><Clock3 aria-hidden size={14} />{booking.sport || sport} · {booking.note || "体验训练"}</p>
      </div>
      {!compact && pending ? (
        <div className="zg-coach-row-actions">
          <button className="is-primary" onClick={() => onAction(booking, "confirmed")} type="button">确认</button>
          <button onClick={() => onAction(booking, "reschedule_requested")} type="button">改期</button>
          <button aria-label="拒绝预约" onClick={() => onAction(booking, "rejected")} type="button"><X aria-hidden size={16} /></button>
        </div>
      ) : null}
      {!compact && booking.status === "confirmed" ? (
        <div className="zg-coach-row-actions">
          <button className="is-primary" onClick={() => onAction(booking, "completed")} type="button">完成课程</button>
          <button onClick={() => onAction(booking, "paid")} type="button">{booking.paymentStatus === "offline_paid" ? "已收款" : "标记收款"}</button>
        </div>
      ) : null}
    </article>
  );
}

export function CoachApp({ initialTab, onOpenUpdates, onSwitchStudent, onTabChange, summary }: CoachAppProps) {
  const demoMode = useMemo(() => usesBundledDemoData(), []);
  const [tab, setTab] = useState<CoachTab>(initialTab);
  const [overview, setOverview] = useState<CoachOverview>(() => createDemoCoachOverview(summary));
  const [conversations, setConversations] = useState<MobileConversation[]>(() => createDemoConversations());
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [toast, setToast] = useState("");
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("pending");
  const slotDefaults = useMemo(() => nextBeijingSlotDefaults(), []);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [slotStartsAt, setSlotStartsAt] = useState(slotDefaults.startsAt);
  const [slotEndsAt, setSlotEndsAt] = useState(slotDefaults.endsAt);
  const [slotVenueId, setSlotVenueId] = useState("");
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const refresh = useCallback(async () => {
    if (demoMode) return;
    try {
      const remote = await mobileApi.coachOverview();
      setOverview(remote);
    } catch {
      if (!demoMode) showToast("工作台暂时离线，已保留最近数据");
    }
  }, [demoMode, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const removeResume = listenForAppResume(() => void refresh());
    return () => {
      window.clearTimeout(timer);
      removeResume();
    };
  }, [refresh]);

  const navigate = (next: CoachTab) => {
    setSelectedConversationId(null);
    setTab(next);
    onTabChange(next);
    window.scrollTo(0, 0);
    void impact();
  };

  const openAppointments = (filter: AppointmentFilter) => {
    setAppointmentFilter(filter);
    navigate("appointments");
  };

  const updateBooking = useCallback(async (booking: MobileBooking, action: BookingStatus | "paid") => {
    setBusyBookingId(booking.id);
    try {
      if (action === "paid") {
        if (!demoMode) await mobileApi.coachMarkOfflinePaid(booking.id, true);
        setOverview((current) => ({
          ...current,
          bookings: current.bookings.map((item) => item.id === booking.id ? { ...item, paymentStatus: "offline_paid" } : item),
        }));
        showToast("线下收款状态已记录");
      } else {
        if (!demoMode) await mobileApi.coachSetBookingStatus(booking.id, action);
        setOverview((current) => ({
          ...current,
          bookings: current.bookings.map((item) => item.id === booking.id ? { ...item, status: action } : item),
        }));
        showToast(action === "confirmed" ? "预约已确认，学员将收到通知" : action === "completed" ? "课程已完成" : "预约状态已更新");
      }
      void impact("medium");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作未完成，请稍后重试");
    } finally {
      setBusyBookingId(null);
    }
  }, [demoMode, showToast]);

  const addSlot = useCallback(async () => {
    const startsAt = parseBeijingDateTimeLocal(slotStartsAt);
    const endsAt = parseBeijingDateTimeLocal(slotEndsAt);
    const venueId = slotVenueId || overview.venues[0]?.id || "";
    const errors = validateScheduleDraft({ endsAt, startsAt, venueId });
    if (Object.keys(errors).length) { setSlotErrors(errors); return; }
    try {
      if (!demoMode) await mobileApi.coachCreateSlot({ endsAt, startsAt, venueId });
      if (demoMode) setOverview((current) => ({ ...current, slots: [...current.slots, { available: true, coachId: summary.id, date: slotStartsAt.slice(0, 10), dateLabel: "新排期", endTime: slotEndsAt.slice(11), id: `slot_${Date.now()}`, time: slotStartsAt.slice(11), venueId }] }));
      else await refresh();
      setSlotErrors({}); setSlotFormOpen(false);
      const next = nextBeijingSlotDefaults(); setSlotStartsAt(next.startsAt); setSlotEndsAt(next.endsAt);
      showToast("可约时段已添加");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "时段添加失败");
    }
  }, [demoMode, overview.venues, refresh, showToast, slotEndsAt, slotStartsAt, slotVenueId, summary.id]);

  const pending = overview.bookings.filter((booking) => booking.status === "pending_coach" || booking.status === "reschedule_requested");
  const active = overview.bookings.filter((booking) => booking.status === "confirmed");
  const completed = overview.bookings.filter((booking) => ["cancelled_by_coach", "cancelled_by_student", "completed", "rejected"].includes(booking.status));
  const filteredBookings = appointmentFilter === "pending" ? pending : appointmentFilter === "active" ? active : completed;
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) ?? null;

  return (
    <main className="zg-mobile-app zg-coach-app">
      <header className="zg-coach-topbar">
        <div className="zg-coach-brand"><Image alt="" height={28} priority src="./logo-mark.svg" unoptimized width={28} /><strong>逐光</strong><button onClick={onSwitchStudent} type="button">教练模式<ChevronRight aria-hidden size={14} /></button></div>
        <button aria-label="通知" type="button"><Bell aria-hidden size={21} />{pending.length ? <em>{pending.length}</em> : null}</button>
      </header>

      {tab === "workspace" ? (
        <div className="zg-coach-page">
          <section className="zg-coach-identity">
            <span className="zg-coach-mode-avatar">{summary.name.slice(0, 1)}</span>
            <div><h1>{summary.name}</h1><p>{summary.sport} · {summary.title}</p></div>
            <BadgeCheck aria-label="已认证教练" size={22} />
          </section>
          <section className="zg-coach-kpis">
            <button onClick={() => openAppointments("pending")} type="button"><span>待确认</span><strong>{pending.length}</strong></button>
            <button onClick={() => openAppointments("active")} type="button"><span>进行中</span><strong>{active.length}</strong></button>
            <button onClick={() => openAppointments("completed")} type="button"><span>本月完成</span><strong>{demoMode ? Math.max(18, completed.length) : completed.length}</strong></button>
          </section>
          <section className="zg-coach-section">
            <header><h2>待处理预约</h2><button onClick={() => openAppointments("pending")} type="button">全部({pending.length})<ChevronRight aria-hidden size={15} /></button></header>
            <div className={busyBookingId ? "is-busy" : ""}>
              {pending.length ? pending.map((booking) => <BookingRow booking={booking} key={booking.id} onAction={updateBooking} sport={overview.coach.sport} />) : <p className="zg-coach-empty">所有预约都已处理</p>}
            </div>
          </section>
          <section className="zg-coach-section">
            <header><h2>近期课程</h2><button onClick={() => openAppointments("active")} type="button">全部({active.length})<ChevronRight aria-hidden size={15} /></button></header>
            {active.map((booking) => <BookingRow booking={booking} compact key={booking.id} onAction={updateBooking} sport={overview.coach.sport} />)}
          </section>
        </div>
      ) : null}

      {tab === "appointments" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>预约管理</h1></div><button aria-label="更多操作" type="button"><MoreHorizontal aria-hidden /></button></div>
          <div className="zg-coach-segmented" role="tablist">
            <button aria-selected={appointmentFilter === "pending"} className={appointmentFilter === "pending" ? "is-active" : ""} onClick={() => setAppointmentFilter("pending")} role="tab" type="button">待处理 {pending.length}</button>
            <button aria-selected={appointmentFilter === "active"} className={appointmentFilter === "active" ? "is-active" : ""} onClick={() => setAppointmentFilter("active")} role="tab" type="button">进行中 {active.length}</button>
            <button aria-selected={appointmentFilter === "completed"} className={appointmentFilter === "completed" ? "is-active" : ""} onClick={() => setAppointmentFilter("completed")} role="tab" type="button">已完成 {completed.length}</button>
          </div>
          <section className="zg-coach-appointment-list">
            {filteredBookings.length ? filteredBookings.map((booking) => <BookingRow booking={booking} key={booking.id} onAction={updateBooking} sport={overview.coach.sport} />) : <p className="zg-coach-empty">该分组暂无预约</p>}
          </section>
        </div>
      ) : null}

      {tab === "schedule" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>可约排期</h1></div><button aria-label="添加时段" disabled={!overview.venues.length} onClick={() => { setSlotVenueId(overview.venues[0]?.id || ""); setSlotFormOpen(true); }} type="button"><Plus aria-hidden /></button></div>
          <section className="zg-schedule-summary"><div><strong>{overview.slots.length}</strong><span>未来可约时段</span></div><p>时段由你管理，已被预约的时间不会重复开放。</p></section>
          <section className="zg-coach-section zg-slot-list">
            <header><h2>未来 14 天</h2><button disabled={!overview.venues.length} onClick={() => { setSlotVenueId(overview.venues[0]?.id || ""); setSlotFormOpen(true); }} type="button"><Plus aria-hidden size={15} />添加</button></header>
            {!overview.venues.length ? <p className="zg-coach-empty">场馆尚未发布，请先在资料页提交场馆并等待运营审核。</p> : null}
            {overview.slots.map((slot) => (
              <article key={slot.id}><span><strong>{slot.dateLabel}</strong><small>{slot.date}</small></span><div><Clock3 aria-hidden size={16} />{slot.time}-{slot.endTime}</div><em>可预约</em></article>
            ))}
          </section>
        </div>
      ) : null}

      {tab === "messages" ? (
        <div className="zg-coach-page zg-coach-messages">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>{selectedConversation ? selectedConversation.title : "消息"}</h1></div>{selectedConversation ? <button aria-label="返回消息列表" onClick={() => setSelectedConversationId(null)} type="button"><RotateCcw aria-hidden /></button> : null}</div>
          {!selectedConversation ? conversations.map((conversation) => (
            <button className="zg-coach-conversation" key={conversation.id} onClick={() => {
              setSelectedConversationId(conversation.id);
              setConversations((items) => items.map((item) => item.id === conversation.id ? { ...item, unreadCount: 0 } : item));
            }} type="button">
              <span>{conversation.title.slice(0, 1)}</span><div><strong>{conversation.title}</strong><p>{conversation.subtitle}</p></div><small>{conversation.updatedAt}</small>{conversation.unreadCount ? <em>{conversation.unreadCount}</em> : null}<ChevronRight aria-hidden size={17} />
            </button>
          )) : (
            <>
              <section className="zg-coach-message-thread">
                {selectedConversation.messages.map((message) => <p className={message.sender === "coach" ? "is-mine" : ""} key={message.id}>{message.body}<small>{message.createdAt}</small></p>)}
              </section>
              <form className="zg-coach-message-compose" onSubmit={(event) => {
                event.preventDefault();
                const body = messageDraft.trim();
                if (!body) return;
                setConversations((items) => items.map((item) => item.id === selectedConversation.id ? { ...item, messages: [...item.messages, { body, conversationId: item.id, createdAt: "刚刚", id: `message_${Date.now()}`, read: true, sender: "coach" }] } : item));
                setMessageDraft("");
                if (!demoMode) void mobileApi.coachSendMessage(selectedConversation.id, body).catch(() => showToast("消息发送失败"));
              }}><input aria-label="回复消息" onChange={(event) => setMessageDraft(event.target.value)} placeholder="回复学员" value={messageDraft} /><button type="submit">发送</button></form>
            </>
          )}
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>我的工作台</h1></div><button aria-label="设置" type="button"><Settings aria-hidden /></button></div>
          <section className="zg-coach-profile-card"><span>{summary.name.slice(0, 1)}</span><div><h2>{summary.name}教练</h2><p><BadgeCheck aria-hidden size={15} />人工审核已通过</p><small>{summary.sport} · {summary.title}</small></div></section>
          <section className="zg-coach-profile-menu">
            <button onClick={() => navigate("schedule")} type="button"><CalendarDays aria-hidden /><span><strong>排期与场地</strong><small>管理可约时段和训练地点</small></span><ChevronRight aria-hidden /></button>
            <button onClick={() => openAppointments("active")} type="button"><CircleDollarSign aria-hidden /><span><strong>课程与收款</strong><small>完成课程并记录线下收款</small></span><ChevronRight aria-hidden /></button>
            <button onClick={() => navigate("messages")} type="button"><UsersRound aria-hidden /><span><strong>学员沟通</strong><small>集中处理预约前后消息</small></span><ChevronRight aria-hidden /></button>
            <button onClick={onOpenUpdates} type="button"><RefreshCw aria-hidden /><span><strong>关于与更新</strong><small>当前版本、安全校验与更新日志</small></span><ChevronRight aria-hidden /></button>
          </section>
          <button className="zg-switch-student-button" onClick={onSwitchStudent} type="button"><UserRound aria-hidden size={19} />切换为学员身份</button>
        </div>
      ) : null}

      <nav className="zg-coach-bottom-nav" aria-label="教练端主导航">
        {tabItems.map((item) => {
          const Icon = item.icon;
          const count = item.tab === "appointments" ? pending.length : item.tab === "messages" ? unread : 0;
          return <button aria-current={tab === item.tab ? "page" : undefined} className={tab === item.tab ? "is-active" : ""} key={item.tab} onClick={() => navigate(item.tab)} type="button"><span><Icon aria-hidden size={22} />{count ? <em>{count}</em> : null}</span><small>{item.label}</small></button>;
        })}
      </nav>
      {slotFormOpen ? <div className="zg-sheet-backdrop zg-coach-slot-backdrop" role="presentation" onClick={() => setSlotFormOpen(false)}><form aria-labelledby="zg-slot-form-title" aria-modal="true" className="zg-coach-slot-sheet" noValidate onClick={(event) => event.stopPropagation()} onSubmit={(event) => event.preventDefault()} role="dialog"><i className="zg-sheet-handle" /><header><div><small>北京时间</small><h2 id="zg-slot-form-title">发布可约时段</h2></div><button aria-label="关闭" onClick={() => setSlotFormOpen(false)} type="button"><X aria-hidden /></button></header><label><span>训练场馆</span><select aria-invalid={Boolean(slotErrors.venueId)} onChange={(event) => setSlotVenueId(event.target.value)} value={slotVenueId}>{overview.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select>{slotErrors.venueId ? <small>{slotErrors.venueId}</small> : null}</label><div className="zg-coach-slot-time-grid"><label><span>开始时间</span><input aria-invalid={Boolean(slotErrors.startsAt)} min={slotDefaults.min} onChange={(event) => setSlotStartsAt(event.target.value)} required type="datetime-local" value={slotStartsAt} />{slotErrors.startsAt ? <small>{slotErrors.startsAt}</small> : null}</label><label><span>结束时间</span><input aria-invalid={Boolean(slotErrors.endsAt)} min={slotStartsAt} onChange={(event) => setSlotEndsAt(event.target.value)} required type="datetime-local" value={slotEndsAt} />{slotErrors.endsAt ? <small>{slotErrors.endsAt}</small> : null}</label></div><div className="zg-coach-slot-durations"><span>快捷时长</span>{[60, 90, 120].map((minutes) => <button key={minutes} onClick={() => { const start = parseBeijingDateTimeLocal(slotStartsAt); if (Number.isFinite(start)) setSlotEndsAt(formatBeijingDateTimeLocal(start + minutes * 60_000)); }} type="button">{minutes}分钟</button>)}</div><button className="zg-coach-slot-submit" onClick={() => void addSlot()} type="button">发布时段</button></form></div> : null}
      {toast ? <div className="zg-toast" role="status"><Check aria-hidden size={17} />{toast}</div> : null}
    </main>
  );
}
