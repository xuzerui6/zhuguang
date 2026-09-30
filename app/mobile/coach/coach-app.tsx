"use client";
import { useRefreshLoop } from "../use-refresh-loop";

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
  RefreshCw,
  RotateCcw,
  Settings,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOperationPrompt } from "../../_components/operation-context";
import { MotionStage } from "../../_components/motion-provider";
import { mobileApi, usesBundledDemoData } from "../api-client";
import { createDemoBooking, createDemoConversations, demoCoaches } from "../demo-data";
import { impact, listenForAppResume } from "../device";
import { PullToRefresh } from "../pull-to-refresh";
import { formatBeijingDateTimeLocal, parseBeijingDateTimeLocal } from "../../../shared/scheduling";
import { getBookingPresentation } from "../../../shared/booking-presentation";
import { cityName, SERVICE_AREAS } from '../../../shared/service-cities';
import { COACH_TAB_ORDER, MOTION_DURATION_MS, nextMotion, tabDirection, type NavigationMotionState } from "../../../shared/motion";
import type {
  AccountProfile,
  BookingStatus,
  CoachAccountSummary,
  CoachOverview,
  CoachTab,
  MobileBooking,
  MobileConversation,
  PullRefreshResult,
} from "../types";

type CoachAppProps = {
  accountProfile?: AccountProfile;
  initialOverview?: CoachOverview;
  initialTab: CoachTab;
  onEditAccountProfile: () => void;
  onOpenUpdates: () => void;
  onSwitchStudent: () => void;
  onTabChange: (tab: CoachTab) => void;
  summary: CoachAccountSummary;
};

type AppointmentFilter = "active" | "completed" | "pending";
type CoachReviewRow = { id: string; rating: number; body: string; tags_json?: string; helpful_count?: number; reply_body?: string; reply_status?: string };

const tabItems: Array<{ icon: typeof LayoutDashboard; label: string; tab: CoachTab }> = [
  { icon: LayoutDashboard, label: "工作台", tab: "workspace" },
  { icon: CalendarDays, label: "预约", tab: "appointments" },
  { icon: Grid2X2, label: "日程", tab: "schedule" },
  { icon: MessageCircle, label: "消息", tab: "messages" },
  { icon: UserRound, label: "我的", tab: "profile" },
];

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
    slots: [],
    venues: [{ active: true, address: "北京市通州区合作训练场", coachId: summary.id, district: "通州区", id: "venue_demo", name: "合作训练场" }],
  };
}

function BookingRow({
  booking,
  compact = false,
  fulfillmentV2 = false,
  onAction,
  sport,
}: {
  booking: MobileBooking;
  compact?: boolean;
  fulfillmentV2?: boolean;
  onAction: (booking: MobileBooking, status: BookingStatus | "paid" | "proposal") => void;
  sport: string;
}) {
  const pending = booking.status === "pending_coach";
  const presentation = getBookingPresentation(booking);
  return (
    <article className="zg-coach-booking-row">
      <span className="zg-coach-student-avatar">{booking.learnerId.slice(-2).toUpperCase()}</span>
      <div className="zg-coach-booking-copy">
        <div><strong>{booking.learnerName || "预约学员"}</strong><small>{presentation.label}</small></div>
        <p><CalendarDays aria-hidden size={14} />{booking.dateLabel} {booking.time}-{booking.endTime}</p>
        <p><Clock3 aria-hidden size={14} />{booking.sport || sport} · {booking.note || "体验训练"}</p>
      </div>
      {!compact && pending ? (
        <div className="zg-coach-row-actions">
          <button className="is-primary" onClick={() => onAction(booking, "confirmed")} type="button">确认</button>
          <button onClick={() => onAction(booking, "proposal")} type="button">新方案</button>
          <button aria-label="拒绝预约" onClick={() => onAction(booking, "rejected")} type="button"><X aria-hidden size={16} /></button>
        </div>
      ) : null}
      {!compact && presentation.canReschedule ? (
        <div className="zg-coach-row-actions">
          <button className="is-primary" onClick={() => onAction(booking, "completed")} type="button">{fulfillmentV2 ? "发起完成确认" : "完成课程"}</button>
          <button onClick={() => onAction(booking, "proposal")} type="button">新方案</button>
          <button disabled={booking.paymentStatus !== "offline_unpaid"} onClick={() => onAction(booking, "paid")} type="button">{booking.paymentStatus === "offline_paid" ? "已收款" : booking.paymentStatus === "online_paid" ? "已支付" : "标记收款"}</button>
        </div>
      ) : null}
    </article>
  );
}

export function CoachApp({ accountProfile, initialOverview, initialTab, onEditAccountProfile, onOpenUpdates, onSwitchStudent, onTabChange, summary }: CoachAppProps) {
  const requestOperation = useOperationPrompt();
  const demoMode = useMemo(() => usesBundledDemoData(), []);
  const [tab, setTab] = useState<CoachTab>(initialTab);
  const [navigationMotion, setNavigationMotion] = useState<NavigationMotionState>({ direction: "none", intent: "tab", sequence: 0 });
  const [storedOverview, setOverview] = useState<CoachOverview>(() => initialOverview ?? createDemoCoachOverview(summary));
  const overview = initialOverview ?? storedOverview;
  const [conversations, setConversations] = useState<MobileConversation[]>(() => demoMode ? createDemoConversations() : []);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [toast, setToast] = useState("");
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("pending");
  const [proposalBooking, setProposalBooking] = useState<MobileBooking | null>(null);
  const [proposalStartsAt, setProposalStartsAt] = useState("");
  const [proposalVenueId, setProposalVenueId] = useState("");
  const [locationType, setLocationType] = useState<'venue' | 'custom'>('custom');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const proposalLock = useRef(false);
  const [proposalNote, setProposalNote] = useState("");
  const [reviews, setReviews] = useState<CoachReviewRow[]>([]);
  const refreshInFlight = useRef<Promise<PullRefreshResult> | null>(null);
  const reducedMotion = useReducedMotion();

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const fetchOverview = useCallback((): Promise<PullRefreshResult> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    if (!navigator.onLine) return Promise.resolve({ status: "error", message: "当前离线，无法刷新" });
    if (demoMode) return Promise.resolve({ status: "success", updatedAt: Date.now() });
    const request = (async (): Promise<PullRefreshResult> => {
      try {
        const [remote, reviewRows] = await Promise.all([
          mobileApi.coachOverview(),
          mobileApi.coachReviewsForCoach().catch(() => [] as CoachReviewRow[]),
        ]);
        setOverview(remote);
        setConversations(remote.conversations);
        setReviews(reviewRows);
        return { status: "success", updatedAt: Date.now() };
      } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : "工作台刷新失败，请重试" };
      }
    })();
    refreshInFlight.current = request;
    void request.finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    });
    return request;
  }, [demoMode]);
  const refresh = useRefreshLoop(fetchOverview, !demoMode);

  const replyToReview = useCallback(async (review: CoachReviewRow) => {
    const body = await requestOperation("回复将经过运营审核后公开，请勿填写学员姓名或联系方式", "", 2);
    if (!body?.trim()) return;
    try { await mobileApi.coachReplyToReview(review.id, body); showToast("回复已提交审核"); await refresh(); }
    catch (error) { showToast(error instanceof Error ? error.message : "回复提交失败"); }
  }, [refresh, requestOperation, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const removeResume = listenForAppResume(() => void refresh());
    const refreshOnNetwork = () => void refresh();
    window.addEventListener("online", refreshOnNetwork);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", refreshOnNetwork);
      removeResume();
    };
  }, [demoMode, refresh]);

  useEffect(() => {
    if (tab === "messages") void refresh();
  }, [refresh, tab]);

  const openConversation = useCallback(async (conversationId: string) => {
    setNavigationMotion((current) => nextMotion(current, "push", "forward"));
    setSelectedConversationId(conversationId);
    if (demoMode) {
      setConversations((items) => items.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
      return;
    }
    try {
      await mobileApi.coachMarkConversationRead(conversationId);
      setConversations((items) => items.map((item) => item.id === conversationId ? {
        ...item,
        messages: item.messages.map((message) => message.sender === "student" ? { ...message, read: true } : message),
        unreadCount: 0,
      } : item));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "消息已读状态同步失败");
    }
  }, [demoMode, showToast]);

  const sendCoachMessage = useCallback(async (conversationId: string, body: string) => {
    const temporaryId = `pending_${Date.now()}`;
    setConversations((items) => items.map((item) => item.id === conversationId ? {
      ...item,
      messages: [...item.messages, { body, conversationId, createdAt: "刚刚", deliveryStatus: "pending", id: temporaryId, read: true, sender: "coach" }],
    } : item));
    try {
      const sent = demoMode
        ? { body, conversationId, createdAt: "刚刚", deliveryStatus: "sent" as const, id: temporaryId, read: true, sender: "coach" as const }
        : await mobileApi.coachSendMessage(conversationId, body);
      setConversations((items) => items.map((item) => item.id === conversationId ? {
        ...item,
        messages: item.messages.map((message) => message.id === temporaryId ? { ...sent, deliveryStatus: "sent", read: true } : message),
        subtitle: body,
      } : item));
    } catch (error) {
      setConversations((items) => items.map((item) => item.id === conversationId ? {
        ...item,
        messages: item.messages.map((message) => message.id === temporaryId ? { ...message, deliveryStatus: "failed" } : message),
      } : item));
      showToast(error instanceof Error ? error.message : "消息发送失败，可点击失败消息重试");
    }
  }, [demoMode, showToast]);

  const navigate = (next: CoachTab) => {
    if (next === tab && !selectedConversationId) return;
    setNavigationMotion((current) => nextMotion(current, "tab", tabDirection(COACH_TAB_ORDER, tab, next)));
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

  const updateBooking = useCallback(async (booking: MobileBooking, action: BookingStatus | "paid" | "proposal") => {
    if (action === "proposal") {
      setProposalBooking(booking);
      setProposalStartsAt(formatBeijingDateTimeLocal(Date.now() + 24 * 60 * 60_000));
      setProposalVenueId(''); setLocationType('custom'); setProposalNote('');
      setCustomDistrict(booking.customDistrict || ''); setCustomAddress(booking.customAddress || '');
      return;
    }
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
        if (!demoMode && action === "completed" && booking.fulfillmentVersion === 2) {
          await mobileApi.coachRequestCompletion(booking.id);
          await refresh();
          showToast("已发起完成确认，等待学员确认");
          void impact("medium");
          return;
        }
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
  }, [demoMode, refresh, showToast]);

  const submitProposal = useCallback(async () => {
    if (!proposalBooking || proposalLock.current) return;
    const city = proposalBooking.serviceCityId;
    if (!city) { showToast('预约城市信息暂不可用，请刷新后重试'); return; }
    const startsAt = parseBeijingDateTimeLocal(proposalStartsAt);
    if (!Number.isFinite(startsAt) || startsAt < Date.now() + 2 * 3_600_000 || startsAt > Date.now() + 60 * 86_400_000) { showToast("请选择未来2小时至60天内的北京时间"); return; }
    if (locationType === 'venue' ? !overview.venues.some(venue => venue.id === proposalVenueId && venue.city === cityName(city)) : !SERVICE_AREAS[city].includes(customDistrict) || customAddress.trim().length < 4) { showToast('请选择本次预约城市的场馆，或填写区域和详细地点'); return; }
    proposalLock.current = true; setProposalBusy(true);
    try {
      if (!demoMode) await mobileApi.coachProposeReschedule({ bookingId: proposalBooking.id, note: proposalNote, startsAt, locationType, venueId: locationType === 'venue' ? proposalVenueId : undefined, customDistrict: locationType === 'custom' ? customDistrict : undefined, customAddress: locationType === 'custom' ? customAddress.trim() : undefined });
      setProposalBooking(null); setProposalNote(""); await refresh(); showToast("新方案已发送，等待学员确认");
    } catch (error) { showToast(error instanceof Error ? error.message : "方案发送失败"); }
    finally { proposalLock.current = false; setProposalBusy(false); }
  }, [demoMode, proposalBooking, proposalNote, proposalStartsAt, proposalVenueId, locationType, customDistrict, customAddress, overview.venues, refresh, showToast]);

  const setAvailability = useCallback(async (online: boolean) => {
    try {
      if (!demoMode) await mobileApi.coachSetAvailability(online);
      setOverview((current) => ({ ...current, coach: { ...current.coach, bookingEnabled: online } }));
      showToast(online ? "已上线接单" : "已停止接收新申请");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "接单状态更新失败");
    }
  }, [demoMode, showToast]);

  const operationalBookings = overview.bookings.filter((booking) => booking.metricEligible !== false);
  const pending = operationalBookings.filter((booking) => booking.status === "pending_coach" || booking.status === "reschedule_requested");
  const active = operationalBookings.filter((booking) => booking.status === "confirmed");
  const ended = overview.bookings.filter((booking) => ["cancelled_by_coach", "cancelled_by_student", "completed", "expired", "rejected"].includes(booking.status));
  const completedCount = overview.bookings.filter((booking) => booking.status === "completed").length;
  const filteredBookings = appointmentFilter === "pending" ? pending : appointmentFilter === "active" ? active : ended;
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const selectedConversation = conversations.find((item) => item.id === selectedConversationId) ?? null;
  const sceneKey = selectedConversation ? `coach-conversation-${selectedConversation.id}` : `coach-${tab}-${navigationMotion.sequence}`;

  return (
    <main className="zg-mobile-app zg-coach-app">
      <PullToRefresh disabled={Boolean(proposalBooking) || Boolean(selectedConversationId)} onRefresh={refresh} />
      <header className="zg-coach-topbar">
        <div className="zg-coach-brand"><Image alt="" height={28} priority src="./logo-mark.svg" unoptimized width={28} /><strong>逐光</strong><button onClick={onSwitchStudent} type="button">教练模式<ChevronRight aria-hidden size={14} /></button></div>
        <button aria-label="通知" type="button"><Bell aria-hidden size={21} />{pending.length ? <em>{pending.length}</em> : null}</button>
      </header>

      <MotionStage className="zg-mobile-scene" direction={navigationMotion.direction} intent={navigationMotion.intent} sceneKey={sceneKey} stageClassName="zg-mobile-scene-stage">
      {tab === "workspace" ? (
        <div className="zg-coach-page">
          <section className="zg-coach-identity">
            <span className="zg-coach-mode-avatar">{summary.name.slice(0, 1)}</span>
            <div><h1>{summary.name}</h1><p>{overview.coach.title || overview.coach.sport}</p></div>
            <BadgeCheck aria-label="已认证教练" size={22} />
          </section>
          <section className="zg-coach-kpis">
            <button onClick={() => openAppointments("pending")} type="button"><span>待确认</span><strong>{pending.length}</strong></button>
            <button onClick={() => openAppointments("active")} type="button"><span>进行中</span><strong>{active.length}</strong></button>
            <button onClick={() => openAppointments("completed")} type="button"><span>完成课程</span><strong>{demoMode ? Math.max(18, completedCount) : completedCount}</strong></button>
          </section>
          <section className="zg-coach-section">
            <header><h2>待处理预约</h2><button onClick={() => openAppointments("pending")} type="button">全部({pending.length})<ChevronRight aria-hidden size={15} /></button></header>
            <div className={busyBookingId ? "is-busy" : ""}>
              {pending.length ? pending.map((booking) => <BookingRow booking={booking} fulfillmentV2={booking.fulfillmentVersion === 2} key={booking.id} onAction={updateBooking} sport={overview.coach.sport} />) : <p className="zg-coach-empty">所有预约都已处理</p>}
            </div>
          </section>
          <section className="zg-coach-section">
            <header><h2>近期课程</h2><button onClick={() => openAppointments("active")} type="button">全部({active.length})<ChevronRight aria-hidden size={15} /></button></header>
            {active.map((booking) => <BookingRow booking={booking} compact fulfillmentV2={booking.fulfillmentVersion === 2} key={booking.id} onAction={updateBooking} sport={overview.coach.sport} />)}
          </section>
          <section className="zg-coach-section zg-coach-review-list">
            <header><h2>真实学员评价</h2><span>{reviews.length}条</span></header>
            {reviews.length ? reviews.slice(0, 3).map((review) => <article key={review.id}><header><strong><Star aria-hidden fill="currentColor" size={14} />{review.rating}.0</strong><small>{review.helpful_count || 0}人认为有帮助</small></header><p>{review.body}</p>{review.reply_body ? <small>回复{review.reply_status === "approved" ? "已公开" : "审核中"}：{review.reply_body}</small> : <button onClick={() => void replyToReview(review)} type="button">回复评价</button>}</article>) : <p className="zg-coach-empty">暂无公开评价</p>}
          </section>
        </div>
      ) : null}

      {tab === "appointments" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>预约管理</h1></div><button aria-label="更多操作" type="button"><MoreHorizontal aria-hidden /></button></div>
          <div className="zg-coach-segmented" role="tablist">
            <button aria-selected={appointmentFilter === "pending"} className={appointmentFilter === "pending" ? "is-active" : ""} onClick={() => setAppointmentFilter("pending")} role="tab" type="button">待处理 {pending.length}</button>
            <button aria-selected={appointmentFilter === "active"} className={appointmentFilter === "active" ? "is-active" : ""} onClick={() => setAppointmentFilter("active")} role="tab" type="button">进行中 {active.length}</button>
            <button aria-selected={appointmentFilter === "completed"} className={appointmentFilter === "completed" ? "is-active" : ""} onClick={() => setAppointmentFilter("completed")} role="tab" type="button">已结束 {ended.length}</button>
          </div>
          <section className="zg-coach-appointment-list">
            {filteredBookings.length ? filteredBookings.map((booking) => <BookingRow booking={booking} fulfillmentV2={booking.fulfillmentVersion === 2} key={booking.id} onAction={updateBooking} sport={overview.coach.sport} />) : <p className="zg-coach-empty">该分组暂无预约</p>}
          </section>
        </div>
      ) : null}

      {tab === "schedule" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>接单与日程</h1></div></div>
          <section className="zg-schedule-summary"><div><strong>{overview.coach.bookingEnabled === false ? "已下线" : "接单中"}</strong><span>公开接单状态</span></div><p>上线后学员可指定时间与地点提交申请，确认时才锁定日程。</p><button className="zg-coach-slot-submit" onClick={() => void setAvailability(overview.coach.bookingEnabled === false)} type="button">{overview.coach.bookingEnabled === false ? "上线接单" : "停止接收新申请"}</button></section>
          <section className="zg-coach-section zg-slot-list">
            <header><h2>已确认课程</h2></header>
            {!active.length ? <p className="zg-coach-empty">确认学员的时间申请后，课程会出现在这里。</p> : null}
            {active.map((booking) => (
              <article key={booking.id}><span><strong>{booking.dateLabel}</strong><small>{booking.date}</small></span><div><Clock3 aria-hidden size={16} />{booking.time}-{booking.endTime}</div><em>已确认</em></article>
            ))}
          </section>
        </div>
      ) : null}

      {tab === "messages" ? (
        <div className="zg-coach-page zg-coach-messages">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>{selectedConversation ? selectedConversation.title : "消息"}</h1></div>{selectedConversation ? <button aria-label="返回消息列表" onClick={() => { setNavigationMotion((current) => nextMotion(current, "pop", "backward")); setSelectedConversationId(null); }} type="button"><RotateCcw aria-hidden /></button> : null}</div>
          {!selectedConversation ? conversations.map((conversation) => (
            <button className="zg-coach-conversation" key={conversation.id} onClick={() => void openConversation(conversation.id)} type="button">
              <span>{conversation.title.slice(0, 1)}</span><div><strong>{conversation.title}</strong><p>{conversation.subtitle}</p></div><small>{conversation.updatedAt}</small>{conversation.unreadCount ? <em>{conversation.unreadCount}</em> : null}<ChevronRight aria-hidden size={17} />
            </button>
          )) : (
            <>
              <section className="zg-coach-message-thread">
                {selectedConversation.messages.map((message) => <p className={message.sender === "coach" ? "is-mine" : ""} key={message.id}>{message.body}<small>{message.deliveryStatus === "pending" ? "发送中" : message.deliveryStatus === "failed" ? "发送失败，点击重试" : message.createdAt}</small>{message.deliveryStatus === "failed" ? <button onClick={() => void sendCoachMessage(selectedConversation.id, message.body)} type="button">重试</button> : null}</p>)}
              </section>
              <form className="zg-coach-message-compose" onSubmit={(event) => {
                event.preventDefault();
                const body = messageDraft.trim();
                if (!body) return;
                setMessageDraft("");
                void sendCoachMessage(selectedConversation.id, body);
              }}><input aria-label="回复消息" onChange={(event) => setMessageDraft(event.target.value)} placeholder="回复学员" value={messageDraft} /><button type="submit">发送</button></form>
            </>
          )}
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="zg-coach-page">
          <div className="zg-coach-page-title"><div><small>教练模式</small><h1>我的工作台</h1></div><button aria-label="编辑账号资料" onClick={onEditAccountProfile} type="button"><Settings aria-hidden /></button></div>
          <button className="zg-coach-account-card" onClick={onEditAccountProfile} type="button"><span>{accountProfile?.avatarUrl ? <Image alt="账号头像" height={52} src={accountProfile.avatarUrl} unoptimized width={52} /> : (accountProfile?.nickname || "逐").slice(0,1)}</span><div><small>当前登录账号</small><strong>{accountProfile?.nickname || "昵称待完善"}</strong><p>{cityName(accountProfile?.serviceCityId || "beijing")}{accountProfile?.serviceArea || accountProfile?.district ? ` · ${accountProfile?.serviceArea || accountProfile?.district}` : ""} · 账号资料与公开教练档案相互独立</p></div><ChevronRight aria-hidden size={18} /></button>
          <section className="zg-coach-profile-card"><span>{summary.name.slice(0, 1)}</span><div><h2>{summary.name}教练</h2><p><BadgeCheck aria-hidden size={15} />人工审核已通过</p><small>{overview.coach.title || overview.coach.sport}</small></div></section>
          <section className="zg-coach-profile-menu">
            <button onClick={() => navigate("schedule")} type="button"><CalendarDays aria-hidden /><span><strong>接单状态与日程</strong><small>控制上线状态并查看确认课程</small></span><ChevronRight aria-hidden /></button>
            <button onClick={() => openAppointments("active")} type="button"><CircleDollarSign aria-hidden /><span><strong>课程与收款</strong><small>完成课程并记录线下收款</small></span><ChevronRight aria-hidden /></button>
            <button onClick={() => navigate("messages")} type="button"><UsersRound aria-hidden /><span><strong>学员沟通</strong><small>集中处理预约前后消息</small></span><ChevronRight aria-hidden /></button>
            <button onClick={onOpenUpdates} type="button"><RefreshCw aria-hidden /><span><strong>关于与更新</strong><small>当前版本、安全校验与更新日志</small></span><ChevronRight aria-hidden /></button>
          </section>
          <button className="zg-switch-student-button" onClick={onSwitchStudent} type="button"><UserRound aria-hidden size={19} />切换为学员身份</button>
        </div>
      ) : null}
      </MotionStage>

      <LayoutGroup id="coach-bottom-navigation"><nav className="zg-coach-bottom-nav" aria-label="教练端主导航">
        {tabItems.map((item) => {
          const Icon = item.icon;
          const count = item.tab === "appointments" ? pending.length : item.tab === "messages" ? unread : 0;
          return <button aria-current={tab === item.tab ? "page" : undefined} className={tab === item.tab ? "is-active" : ""} key={item.tab} onClick={() => navigate(item.tab)} type="button">{tab === item.tab ? <m.i className="zg-bottom-nav-indicator" layoutId="coach-active-tab" transition={{ duration: MOTION_DURATION_MS.tab / 1000, ease: [0.2, 0.8, 0.2, 1] }} /> : null}<span><Icon aria-hidden size={22} />{count ? <em>{count}</em> : null}</span><small>{item.label}</small></button>;
        })}
      </nav></LayoutGroup>
      <AnimatePresence initial={false}>{proposalBooking ? <m.div animate={{ opacity: 1 }} className="zg-sheet-backdrop zg-coach-slot-backdrop" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="coach-proposal" role="presentation" onClick={() => setProposalBooking(null)} transition={{ duration: (reducedMotion ? 80 : MOTION_DURATION_MS.content) / 1000 }}><m.form animate={{ opacity: 1, y: 0 }} aria-labelledby="zg-proposal-title" aria-modal="true" className="zg-coach-slot-sheet" exit={{ opacity: 0, y: reducedMotion ? 0 : 20 }} initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }} onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submitProposal(); }} role="dialog" transition={{ duration: (reducedMotion ? 80 : MOTION_DURATION_MS.content) / 1000, ease: [0.2, 0.8, 0.2, 1] }}><i className="zg-sheet-handle" /><header><div><small>保持{proposalBooking.durationMinutes || 60}分钟与原价格</small><h2 id="zg-proposal-title">提出新的训练方案</h2></div><button aria-label="关闭" onClick={() => setProposalBooking(null)} type="button"><X aria-hidden /></button></header><label><span>开始时间（北京时间）</span><input onChange={(event) => setProposalStartsAt(event.target.value)} required type="datetime-local" value={proposalStartsAt} /></label><fieldset><legend>训练地点{proposalBooking.serviceCityId ? ` · ${cityName(proposalBooking.serviceCityId)}` : ''}</legend><label><input checked={locationType === 'custom'} onChange={() => setLocationType('custom')} type="radio" name="proposal-location" />协商地点</label><label><input checked={locationType === 'venue'} onChange={() => setLocationType('venue')} type="radio" name="proposal-location" />已审核场馆</label></fieldset>{locationType === 'venue' ? <label><span>训练场馆</span><select required onChange={event => setProposalVenueId(event.target.value)} value={proposalVenueId}><option value="">请选择</option>{overview.venues.filter(venue => proposalBooking.serviceCityId && venue.city === cityName(proposalBooking.serviceCityId)).map(venue => <option key={venue.id} value={venue.id}>{venue.name} · {venue.district}</option>)}</select></label> : <><label><span>区域</span><select required value={customDistrict} onChange={event => setCustomDistrict(event.target.value)}><option value="">请选择</option>{(proposalBooking.serviceCityId ? SERVICE_AREAS[proposalBooking.serviceCityId] : []).map(area => <option key={area} value={area}>{area}</option>)}</select></label><label><span>详细地点</span><input required maxLength={300} value={customAddress} onChange={event => setCustomAddress(event.target.value)} /></label></>}<label><span>方案说明</span><textarea maxLength={500} onChange={(event) => setProposalNote(event.target.value)} placeholder="说明调整原因，学员确认后生效" value={proposalNote} /></label><button className="zg-coach-slot-submit" disabled={proposalBusy} type="submit">{proposalBusy ? "发送中" : "发送给学员确认"}</button></m.form></m.div> : null}</AnimatePresence>
      {toast ? <div className="zg-toast" role="status"><Check aria-hidden size={17} />{toast}</div> : null}
    </main>
  );
}
