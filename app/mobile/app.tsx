"use client";

import { WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobileApiError, mobileApi, usesBundledDemoData } from "./api-client";
import { AppHeader, BottomNav } from "./components";
import {
  createDemoConversations,
  createDemoSlots,
  defaultLearner,
  demoCoaches,
  demoNotifications,
  venues,
} from "./demo-data";
import {
  clearLegacyAppointment,
  getNetworkStatus,
  impact,
  isNativeMobile,
  listenForAppResume,
  listenForBackButton,
  readPreference,
  readSession,
  writePreference,
  writeSession,
} from "./device";
import { createRequestId, getMatchResult, mergeFavoriteIds } from "./domain";
import {
  AccountSheet,
  AuthSheet,
  BookingSuccessSheet,
  CancelBookingSheet,
  CitySheet,
  FavoritesSheet,
  FilterSheet,
  LearnerSheet,
  NotificationsSheet,
  SupportSheet,
} from "./sheets";
import type {
  BookingSlot,
  CoachVenue,
  MatchPreferences,
  MobileBooking,
  MobileCoach,
  MobileConversation,
  MobileNotification,
  MobileSession,
  MobileStudentAppProps,
  MobileTab,
  MobileView,
} from "./types";
import { BookingView } from "./views/booking-view";
import { BookingsView } from "./views/bookings-view";
import { CoachDetailView } from "./views/coach-detail-view";
import { DiscoverView } from "./views/discover-view";
import { HomeView } from "./views/home-view";
import { MessagesView } from "./views/messages-view";
import { ProfileView } from "./views/profile-view";

type SheetName = "account" | "assurance" | "auth" | "booking-success" | "cancel" | "city" | "favorites" | "feedback" | "filters" | "learner" | "notifications" | null;
type BookingTab = "pending" | "active" | "completed";

function getInitialPreferences(props: MobileStudentAppProps): MatchPreferences {
  return {
    audience: props.audience || "青少年",
    budget: 600,
    city: "北京",
    desiredTime: "周末",
    district: "全北京",
    goal: props.goal === "全部目标" ? "专项提升" : props.goal,
    sport: props.sport === "全部项目" ? "田径" : props.sport,
  };
}

export default function MobileStudentApp(props: MobileStudentAppProps) {
  const { onOpenUpdates, onSessionChange, onTabChange } = props;
  const demoMode = useMemo(() => usesBundledDemoData(), []);
  const [coaches, setCoaches] = useState<MobileCoach[]>(() => props.coaches.length ? props.coaches : demoCoaches);
  const [activeTab, setActiveTab] = useState<MobileTab>(props.initialTab ?? "home");
  const [view, setView] = useState<MobileView>(props.initialTab ?? "home");
  const [preferences, setPreferences] = useState<MatchPreferences>(() => getInitialPreferences(props));
  const [learner, setLearner] = useState(() => demoMode ? defaultLearner : {
    ...defaultLearner,
    age: 0,
    goal: "短跑专项",
    guardianName: undefined,
    guardianPhone: undefined,
    id: "",
    level: "入门",
    name: "我的学员",
    sport: "田径",
  });
  const [notifications, setNotifications] = useState<MobileNotification[]>(() => demoMode ? demoNotifications : []);
  const [query, setQuery] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(props.selectedCoachId || 5);
  const [savedCoachIds, setSavedCoachIds] = useState<number[]>(props.savedCoachIds);
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [bookingTab, setBookingTab] = useState<BookingTab>("pending");
  const [bookingSlots, setBookingSlots] = useState<BookingSlot[]>(() => createDemoSlots(props.selectedCoachId || 5));
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot>(() => createDemoSlots(props.selectedCoachId || 5).find((slot) => slot.available) ?? createDemoSlots(5)[0]);
  const [bookingVenue, setBookingVenue] = useState<CoachVenue>(() => venues[0]);
  const [bookingNote, setBookingNote] = useState("希望先沟通训练目标，真实场地与时段确认后再提交预约。");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conversations, setConversations] = useState<MobileConversation[]>(() => demoMode ? createDemoConversations() : []);
  const [selectedConversation, setSelectedConversation] = useState<MobileConversation | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [cancelTarget, setCancelTarget] = useState<MobileBooking | null>(null);
  const [session, setSession] = useState<MobileSession | null>(null);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(false);
  const [pendingConversationCoachId, setPendingConversationCoachId] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(demoMode);
  const tabScrollPositions = useRef<Record<MobileTab, number>>({
    bookings: 0,
    discover: 0,
    home: 0,
    messages: 0,
    profile: 0,
  });
  const detailScrollPosition = useRef(0);

  const selectedCoach = coaches.find((coach) => coach.id === selectedCoachId) ?? coaches[0] ?? demoCoaches[0];
  const unreadMessages = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  const activeBookingCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const pendingBookingCount = bookings.filter((booking) => booking.status === "pending_coach" || booking.status === "reschedule_requested").length;
  const isTrialBooking = !bookings.some((booking) => booking.coachId === selectedCoach.id && !["rejected", "cancelled_by_student", "cancelled_by_coach"].includes(booking.status));

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2400);
  }, []);

  const queueScroll = useCallback((top: number) => {
    window.requestAnimationFrame(() => window.scrollTo(0, top));
  }, []);

  const refreshRemoteData = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const [bootstrap, remoteNotifications] = await Promise.all([
        mobileApi.bootstrap(),
        mobileApi.notifications().catch(() => []),
      ]);
      setCoaches(bootstrap.coaches);
      if (bootstrap.learnerProfiles.length) setLearner(bootstrap.learnerProfiles[0]);
      if (!demoMode || remoteNotifications.length) setNotifications(remoteNotifications);
      setBookings(bootstrap.bookings);
      setConversations(bootstrap.conversations);
      if (bootstrap.favoriteCoachIds.length) {
        setSavedCoachIds((current) => mergeFavoriteIds(current, bootstrap.favoriteCoachIds));
      }
      setApiConnected(true);
      setBootstrapped(true);
    } catch {
      setApiConnected(false);
      setBootstrapped(true);
    }
  }, [demoMode]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readSession(),
      readPreference<number[]>("favorites"),
      readPreference<MatchPreferences>("preferences"),
      clearLegacyAppointment(),
      getNetworkStatus(),
    ]).then(([storedSession, storedFavorites, storedPreferences, , network]) => {
      if (cancelled) return;
      setSession(storedSession);
      onSessionChange?.(storedSession);
      if (storedFavorites?.length) setSavedCoachIds((current) => mergeFavoriteIds(current, storedFavorites));
      if (storedPreferences) setPreferences(storedPreferences);
      setOnline(network.connected);
      void refreshRemoteData();
    });

    const onOnline = () => { setOnline(true); void refreshRemoteData(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const removeResume = listenForAppResume(() => void refreshRemoteData());
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      removeResume();
    };
  }, [onSessionChange, refreshRemoteData]);

  useEffect(() => {
    if (!apiConnected) return;
    const timer = window.setInterval(() => void refreshRemoteData(), 15_000);
    return () => window.clearInterval(timer);
  }, [apiConnected, refreshRemoteData]);

  const handleBack = useCallback(() => {
    if (sheet) {
      setSheet(null);
      return true;
    }
    if (selectedConversation) {
      setSelectedConversation(null);
      queueScroll(tabScrollPositions.current.messages);
      return true;
    }
    if (view === "booking") {
      setView("coach");
      queueScroll(detailScrollPosition.current);
      return true;
    }
    if (view === "coach") {
      setView(activeTab);
      queueScroll(tabScrollPositions.current[activeTab]);
      return true;
    }
    return false;
  }, [activeTab, queueScroll, selectedConversation, sheet, view]);

  useEffect(() => listenForBackButton(handleBack), [handleBack]);

  const updatePreferences = useCallback((next: MatchPreferences) => {
    setPreferences(next);
    props.onChangeAudience(next.audience);
    props.onChangeCity(next.city);
    props.onChangeGoal(next.goal);
    props.onChangeSport(next.sport);
    void writePreference("preferences", next);
  }, [props]);

  const navigateTab = useCallback((tab: MobileTab) => {
    if (["home", "discover", "bookings", "messages", "profile"].includes(view) && !selectedConversation) {
      tabScrollPositions.current[view as MobileTab] = window.scrollY;
    }
    void impact();
    setActiveTab(tab);
    onTabChange?.(tab);
    setView(tab);
    setSelectedConversation(null);
    queueScroll(tabScrollPositions.current[tab]);
  }, [onTabChange, queueScroll, selectedConversation, view]);

  const openCoach = useCallback((coach: MobileCoach) => {
    if (["home", "discover", "bookings", "messages", "profile"].includes(view)) {
      tabScrollPositions.current[view as MobileTab] = window.scrollY;
    }
    props.onSelectCoach(coach.id);
    setSelectedCoachId(coach.id);
    setView("coach");
    queueScroll(0);
    void impact();
  }, [props, queueScroll, view]);

  const toggleSaved = useCallback((coachId: number) => {
    const favorite = !savedCoachIds.includes(coachId);
    const next = favorite ? [...savedCoachIds, coachId] : savedCoachIds.filter((id) => id !== coachId);
    setSavedCoachIds(next);
    props.onToggleSaved(coachId);
    void writePreference("favorites", next);
    void impact();
    showFeedback(favorite ? "已加入收藏" : "已取消收藏");
    if (session && online) void mobileApi.setFavorite(coachId, favorite).catch(() => undefined);
  }, [online, props, savedCoachIds, session, showFeedback]);

  const openBooking = useCallback(async (coach = selectedCoach) => {
    if (coach.bookable === false || coach.profileKind === "demo") {
      showFeedback("真实场地与时段发布后即可预约，可先收藏或咨询教练");
      return;
    }
    let slots: BookingSlot[];
    try {
      slots = demoMode ? createDemoSlots(coach.id) : await mobileApi.coachSlots(coach.id);
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "暂时无法读取可约时段");
      return;
    }
    const firstAvailable = slots.find((slot) => slot.available);
    if (!firstAvailable?.venueId) {
      showFeedback("真实场地与时段发布后即可预约，可先收藏或咨询教练");
      return;
    }
    const venue = demoMode
      ? venues.find((item) => item.id === firstAvailable.venueId)
      : {
          address: firstAvailable.venueAddress || "具体位置由平台与教练确认",
          coachId: coach.id,
          district: firstAvailable.venueDistrict || coach.district || "北京",
          id: firstAvailable.venueId,
          name: firstAvailable.venueName || "已确认训练场",
        };
    if (!venue) {
      showFeedback("该时段的训练场信息尚未完成发布");
      return;
    }
    setSelectedCoachId(coach.id);
    setBookingSlots(slots);
    setSelectedSlot(firstAvailable);
    setBookingVenue(venue);
    setAgreed(false);
    detailScrollPosition.current = window.scrollY;
    setView("booking");
    queueScroll(0);
  }, [demoMode, queueScroll, selectedCoach, showFeedback]);

  const performBooking = useCallback(async () => {
    setSubmitting(true);
    const input = {
      coachId: selectedCoach.id,
      learnerId: learner.id,
      note: bookingNote,
      slotId: selectedSlot.id,
      venueId: bookingVenue.id,
    };
    try {
      let booking: MobileBooking;
      try {
        booking = await mobileApi.createBooking(input);
        setApiConnected(true);
      } catch (error) {
        if (error instanceof MobileApiError && ["authentication_required", "invalid_session", "refresh_reuse_detected"].includes(error.code)) {
          setSession(null);
          setPendingBooking(true);
          setSheet("auth");
          showFeedback("登录状态已更新，请重新验证邮箱");
          return;
        }
        if (!demoMode || apiConnected) {
          showFeedback(error instanceof Error ? error.message : "预约提交失败，请稍后重试");
          return;
        }
        booking = {
          id: createRequestId("booking"),
          coachId: selectedCoach.id,
          learnerId: learner.id,
          venueId: bookingVenue.id,
          slotId: selectedSlot.id,
          date: selectedSlot.date,
          dateLabel: selectedSlot.dateLabel,
          time: selectedSlot.time,
          endTime: selectedSlot.endTime,
          status: "pending_coach",
          submittedAt: "刚刚",
          feeFen: (isTrialBooking ? selectedSlot.trialFeeFen : selectedSlot.regularFeeFen) ?? 0,
          paymentStatus: "offline_unpaid",
          note: bookingNote,
        };
      }
      setBookings((current) => [booking, ...current.filter((item) => item.id !== booking.id)]);
      props.onBook(selectedCoach.name);
      setPendingBooking(false);
      setSheet("booking-success");
      void impact("medium");
    } finally {
      setSubmitting(false);
    }
  }, [apiConnected, bookingNote, bookingVenue.id, demoMode, isTrialBooking, learner.id, props, selectedCoach, selectedSlot, showFeedback]);

  const submitBooking = useCallback(() => {
    if (!session) {
      setPendingBooking(true);
      setSheet("auth");
      return;
    }
    void performBooking();
  }, [performBooking, session]);

  const requestCode = useCallback(async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const result = await mobileApi.requestEmailOtp(email, turnstileToken);
      setChallengeId(result.challengeId);
    } catch (error) {
      if (demoMode) setChallengeId("local-preview");
      else setAuthError(error instanceof Error ? error.message : "验证码发送失败，请稍后重试");
    } finally {
      setAuthLoading(false);
    }
  }, [demoMode, email, turnstileToken]);

  const verifyCode = useCallback(async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      let verifiedSession: MobileSession;
      if (challengeId === "local-preview") {
        if (otpCode !== "888888") throw new Error("本地测试验证码不正确");
        verifiedSession = {
          accessToken: createRequestId("access"),
          availableModes: ["student", "coach"],
          coach: {
            auditStatus: "approved",
            id: 1,
            name: "周明",
            pendingBookingCount: 3,
            sport: "羽毛球",
            title: "国家队退役运动员",
          },
          refreshToken: createRequestId("refresh"),
          expiresAt: Date.now() + 15 * 60 * 1000,
          authMethod: "email_otp",
          contactMasked: email || "local@example.com",
          phoneMasked: email || "local@example.com",
        };
        await writeSession(verifiedSession);
      } else {
        verifiedSession = await mobileApi.verifyEmailOtp(challengeId, otpCode, savedCoachIds);
      }
      setSession(verifiedSession);
      onSessionChange?.(verifiedSession);
      setSheet(null);
      showFeedback("邮箱验证成功");
      if (pendingBooking) window.setTimeout(() => void performBooking(), 120);
      if (pendingConversationCoachId) {
        const coachId = pendingConversationCoachId;
        setPendingConversationCoachId(null);
        window.setTimeout(() => {
          void mobileApi.createConversation(coachId).then((conversation) => {
            setConversations((current) => [conversation, ...current.filter((item) => item.coachId !== coachId)]);
            setSelectedConversation(conversation);
            setActiveTab("messages");
            setView("messages");
            queueScroll(0);
          }).catch((reason) => showFeedback(reason instanceof Error ? reason.message : "暂时无法开始咨询"));
        }, 120);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "验证码无效，请重新输入");
    } finally {
      setAuthLoading(false);
    }
  }, [challengeId, email, onSessionChange, otpCode, pendingBooking, pendingConversationCoachId, performBooking, queueScroll, savedCoachIds, showFeedback]);

  const openConversationForCoach = useCallback((coachId: number) => {
    if (!session) {
      setPendingConversationCoachId(coachId);
      setSheet("auth");
      showFeedback("验证邮箱后即可咨询教练");
      return;
    }
    const existing = conversations.find((conversation) => conversation.coachId === coachId);
    if (existing) {
      const updated = { ...existing, unreadCount: 0, messages: existing.messages.map((message) => ({ ...message, read: true })) };
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedConversation(updated);
    } else {
      if (!online) {
        showFeedback("当前离线，联网后即可开始新咨询");
        return;
      }
      void mobileApi.createConversation(coachId).then((remote) => {
        setSelectedConversation(remote);
        setConversations((current) => [remote, ...current.filter((item) => item.coachId !== coachId)]);
        setActiveTab("messages");
        setView("messages");
        queueScroll(0);
      }).catch((reason) => showFeedback(reason instanceof Error ? reason.message : "暂时无法开始咨询"));
      return;
    }
    setActiveTab("messages");
    setView("messages");
    queueScroll(0);
  }, [conversations, online, queueScroll, session, showFeedback]);

  const sendMessage = useCallback(async () => {
    if (!selectedConversation || !messageDraft.trim() || messageSending) return;
    const body = messageDraft.trim();
    setMessageSending(true);
    try {
      const updated = await mobileApi.sendMessage(selectedConversation.id, body);
      setSelectedConversation(updated);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessageDraft("");
    } catch (reason) {
      showFeedback(reason instanceof Error ? reason.message : "消息发送失败，请重试");
    } finally {
      setMessageSending(false);
    }
  }, [messageDraft, messageSending, selectedConversation, showFeedback]);

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    try {
      const cancelled = demoMode && cancelTarget.id.startsWith("booking_")
        ? { ...cancelTarget, status: "cancelled_by_student" as const }
        : await mobileApi.cancelBooking(cancelTarget.id);
      setBookings((current) => current.map((booking) => booking.id === cancelled.id ? cancelled : booking));
      setCancelTarget(null);
      setSheet(null);
      showFeedback("预约已取消");
    } catch (reason) {
      showFeedback(reason instanceof Error ? reason.message : "取消失败，请稍后重试");
    }
  }, [cancelTarget, demoMode, showFeedback]);

  const profileAction = useCallback((action: string) => {
    if (action === "bookings") navigateTab("bookings");
    else if (action === "favorites") setSheet("favorites");
    else if (action === "learners") setSheet("learner");
    else if (action === "records") { navigateTab("bookings"); setBookingTab("completed"); }
    else if (action === "authenticate") setSheet("auth");
    else if (action === "privacy") setSheet("account");
    else if (action === "assurance") setSheet("assurance");
    else if (action === "feedback") setSheet("feedback");
    else if (action === "updates") onOpenUpdates?.();
  }, [navigateTab, onOpenUpdates]);

  const filterResultCount = coaches.filter((coach) => getMatchResult(coach, preferences).eligible).length;
  const activeBooking = bookings.find((booking) => booking.status === "pending_coach" || booking.status === "confirmed") ?? null;
  const showBottomNav = ["home", "discover", "bookings", "messages", "profile"].includes(view) && !selectedConversation;
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  if (!coaches.length) {
    return (
      <main className="zg-mobile-app">
        <div className="zg-mobile-loading" role="status">
          {bootstrapped ? <><strong>北京试点教练正在准备中</strong><p>通过审核的教练上线后会第一时间出现在这里。</p></> : <><span /><span /><span /><small>正在载入已审核教练</small></>}
        </div>
      </main>
    );
  }

  return (
    <main className={online ? "zg-mobile-app" : "zg-mobile-app is-offline"}>
      {!online ? <div className="zg-offline-banner"><WifiOff aria-hidden size={15} />当前离线，可继续浏览已缓存内容</div> : null}
      {online && bootstrapped && !apiConnected && !demoMode ? <div className="zg-offline-banner is-service-fallback"><WifiOff aria-hidden size={15} />服务连接不稳定，已显示审核教练缓存</div> : null}
      {view === "home" ? <AppHeader city={preferences.district === "全北京" ? "北京" : preferences.district} notificationCount={unreadNotifications} onCity={() => setSheet("city")} onNotifications={() => setSheet("notifications")} onProfile={() => navigateTab("profile")} /> : null}

      {view === "home" ? <HomeView activeBooking={activeBooking} coaches={coaches} onDiscover={() => navigateTab("discover")} onOpenBooking={() => navigateTab("bookings")} onOpenCoach={openCoach} onSearch={(value) => { setQuery(value); if (value) navigateTab("discover"); }} onSelectSport={(sport) => updatePreferences({ ...preferences, sport })} onToggleSaved={toggleSaved} preferences={preferences} query={query} savedCoachIds={savedCoachIds} /> : null}
      {view === "discover" ? <DiscoverView coaches={coaches} onFilter={() => setSheet("filters")} onOpenCoach={openCoach} onQuery={setQuery} onToggleSaved={toggleSaved} preferences={preferences} query={query} savedCoachIds={savedCoachIds} /> : null}
      {view === "coach" ? <CoachDetailView coach={selectedCoach} isSaved={savedCoachIds.includes(selectedCoach.id)} onBack={handleBack} onBook={() => void openBooking(selectedCoach)} onMessage={() => openConversationForCoach(selectedCoach.id)} onToggleSaved={() => toggleSaved(selectedCoach.id)} preferences={preferences} /> : null}
      {view === "booking" ? <BookingView agreed={agreed} coach={selectedCoach} isTrialBooking={isTrialBooking} learner={learner} note={bookingNote} onBack={handleBack} onChangeNote={setBookingNote} onConfirm={submitBooking} onEditLearner={() => setSheet("learner")} onSelectSlot={(slot) => { setSelectedSlot(slot); if (slot.venueId) setBookingVenue({ address: slot.venueAddress || "具体位置由平台与教练确认", coachId: selectedCoach.id, district: slot.venueDistrict || selectedCoach.district || "北京", id: slot.venueId, name: slot.venueName || "已确认训练场" }); }} onToggleAgreement={() => setAgreed((current) => !current)} preferences={preferences} selectedSlot={selectedSlot} slots={bookingSlots} submitting={submitting} venue={bookingVenue} /> : null}
      {view === "bookings" ? <BookingsView bookings={bookings} coaches={coaches} onCancel={(booking) => { setCancelTarget(booking); setSheet("cancel"); }} onDiscover={() => navigateTab("discover")} onMessage={openConversationForCoach} onReschedule={(booking) => void openBooking(coaches.find((coach) => coach.id === booking.coachId) ?? selectedCoach)} onTab={setBookingTab} tab={bookingTab} venues={venues} /> : null}
      {view === "messages" ? <MessagesView coaches={coaches} conversations={conversations} draft={messageDraft} onBack={() => setSelectedConversation(null)} onChangeDraft={setMessageDraft} onOpen={(conversation) => { setSelectedConversation({ ...conversation, unreadCount: 0 }); setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unreadCount: 0 } : item)); }} onSend={sendMessage} selectedConversation={selectedConversation} sending={messageSending} /> : null}
      {view === "profile" ? <ProfileView activeBookingCount={activeBookingCount} coachSummary={session?.coach ?? props.coachSummary} completedCount={bookings.filter((booking) => booking.status === "completed").length} contactMasked={session?.contactMasked ?? session?.phoneMasked} learner={learner} onAction={profileAction} onOpenCoachMode={props.onOpenCoachMode} savedCount={savedCoachIds.length} /> : null}

      {showBottomNav ? <BottomNav active={activeTab} bookingCount={pendingBookingCount} messageCount={unreadMessages} onNavigate={navigateTab} /> : null}

      {sheet === "filters" ? <FilterSheet onChange={updatePreferences} onClose={() => setSheet(null)} resultCount={filterResultCount} value={preferences} /> : null}
      {sheet === "city" ? <CitySheet district={preferences.district} onClose={() => setSheet(null)} onDistrict={(district) => updatePreferences({ ...preferences, district })} /> : null}
      {sheet === "notifications" ? <NotificationsSheet notifications={notifications} onClose={() => setSheet(null)} /> : null}
      {sheet === "auth" ? <AuthSheet challengeSent={Boolean(challengeId)} code={otpCode} email={email} error={authError} loading={authLoading} nativeSecurity={isNativeMobile()} onChangeCode={setOtpCode} onChangeEmail={setEmail} onChangeTurnstileToken={setTurnstileToken} onClose={() => { setSheet(null); setPendingBooking(false); setPendingConversationCoachId(null); }} onRequestCode={requestCode} onVerify={verifyCode} showLocalCode={demoMode} turnstileSiteKey={(import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TURNSTILE_SITE_KEY || ""} turnstileToken={turnstileToken} /> : null}
      {sheet === "booking-success" ? <BookingSuccessSheet coach={selectedCoach} onClose={() => setSheet(null)} onViewBooking={() => { setSheet(null); navigateTab("bookings"); setBookingTab("pending"); }} /> : null}
      {sheet === "cancel" ? <CancelBookingSheet onCancel={() => void confirmCancel()} onClose={() => { setCancelTarget(null); setSheet(null); }} /> : null}
      {sheet === "favorites" ? <FavoritesSheet coaches={coaches.filter((coach) => savedCoachIds.includes(coach.id))} onClose={() => setSheet(null)} onOpen={(coach) => { setSheet(null); openCoach(coach); }} /> : null}
      {sheet === "learner" ? <LearnerSheet learner={learner} onClose={() => setSheet(null)} onSave={(next) => { setLearner(next); if (session) void mobileApi.saveLearner(next).then(setLearner).catch((error) => showFeedback(error instanceof Error ? error.message : "档案保存失败")); }} /> : null}
      {sheet === "account" ? <AccountSheet onClose={() => setSheet(null)} onDelete={() => { void mobileApi.deleteAccount().then(() => { setSession(null); props.onSessionChange?.(null); setSheet(null); showFeedback("账号已注销"); }).catch((error) => showFeedback(error instanceof Error ? error.message : "注销失败，请稍后重试")); }} onLogout={() => { void mobileApi.logout().catch(() => writeSession(null)); setSession(null); props.onSessionChange?.(null); setSheet(null); showFeedback("已退出登录"); }} session={session} /> : null}
      {sheet === "assurance" || sheet === "feedback" ? <SupportSheet mode={sheet} onClose={() => setSheet(null)} onSubmit={async (message) => { if (!session) throw new Error("请先验证邮箱后提交反馈"); await mobileApi.createFeedbackTicket(message); showFeedback("反馈已提交，运营人员会尽快查看"); }} /> : null}
      {feedback ? <div className="zg-toast" role="status">{feedback}</div> : null}
    </main>
  );
}
