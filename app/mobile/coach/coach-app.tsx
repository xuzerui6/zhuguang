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
import type {
  BookingSlot,
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
    conversations: createDemoConversations().map(({ id, title }) => ({ id, title })),
    slots: createDemoSlots(summary.id).filter((slot) => slot.available),
  };
}

function BookingRow({
  booking,
  compact = false,
  onAction,
}: {
  booking: MobileBooking;
  compact?: boolean;
  onAction: (booking: MobileBooking, status: BookingStatus | "paid") => void;
}) {
  const pending = booking.status === "pending_coach";
  return (
    <article className="zg-coach-booking-row">
      <span className="zg-coach-student-avatar">{booking.learnerId.slice(-2).toUpperCase()}</span>
      <div className="zg-coach-booking-copy">
        <div><strong>{booking.learnerId.includes("demo") ? "张乐" : "预约学员"}</strong><small>{statusCopy[booking.status]}</small></div>
        <p><CalendarDays aria-hidden size={14} />{booking.dateLabel} {booking.time}-{booking.endTime}</p>
        <p><Clock3 aria-hidden size={14} />羽毛球 · {booking.note || "体验训练"}</p>
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
        if (!booking.id.startsWith("booking_")) await mobileApi.coachMarkOfflinePaid(booking.id, true);
        setOverview((current) => ({
          ...current,
          bookings: current.bookings.map((item) => item.id === booking.id ? { ...item, paymentStatus: "offline_paid" } : item),
        }));
        showToast("线下收款状态已记录");
      } else {
        if (!booking.id.startsWith("booking_")) await mobileApi.coachSetBookingStatus(booking.id, action);
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
  }, [showToast]);

  const addSlot = useCallback(async () => {
    const startsAt = Date.now() + 3 * 24 * 60 * 60_000;
    const endsAt = startsAt + 90 * 60_000;
    const slot: BookingSlot = {
      available: true,
      coachId: summary.id,
      date: new Date(startsAt).toISOString().slice(0, 10),
      dateLabel: "3天后",
      endTime: new Date(endsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      id: `slot_${Date.now()}`,
      time: new Date(startsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
    try {
      if (!demoMode) await mobileApi.coachCreateSlot({ endsAt, startsAt, venueId: "venue_bj_cy_01" });
      setOverview((current) => ({ ...current, slots: [...current.slots, slot] }));
      showToast("可约时段已添加");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "时段添加失败");
    }
  }, [demoMode, showToast, summary.id]);

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
              {pending.length ? pending.map((booking) => <BookingRow booking={booking} key={booking.id} onAction={updateBooking} />) : <p className="zg-coach-empty">所有预约都已处理</p>}
            </div>
          </section>
          <section className="zg-coach-section">
            <header><h2>近期课程</h2><button onClick={() => openAppointments("active")} type="button">全部({active.length})<ChevronRight aria-hidden size={15} /></button></header>
            {active.map((booking) => <BookingRow booking={booking} compact key={booking.id} onAction={updateBooking} />)}
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
            {filteredBookings.length ? filteredBookings.map((booking) => <BookingRow booking={booking} key={booking.id} onAction={updateBooking} />) : <p className="zg-coach-empty">该分组暂无预约</p>}
          </section>
        </div>
      ) : null}

      {tab === "schedule" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>可约排期</h1></div><button aria-label="添加时段" onClick={() => void addSlot()} type="button"><Plus aria-hidden /></button></div>
          <section className="zg-schedule-summary"><div><strong>{overview.slots.length}</strong><span>未来可约时段</span></div><p>时段由你管理，已被预约的时间不会重复开放。</p></section>
          <section className="zg-coach-section zg-slot-list">
            <header><h2>未来 14 天</h2><button onClick={() => void addSlot()} type="button"><Plus aria-hidden size={15} />添加</button></header>
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
      {toast ? <div className="zg-toast" role="status"><Check aria-hidden size={17} />{toast}</div> : null}
    </main>
  );
}
