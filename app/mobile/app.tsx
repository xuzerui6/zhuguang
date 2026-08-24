"use client";

import { WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobileApiError, mobileApi, usesBundledDemoData } from "./api-client";
import { AppHeader, BottomNav } from "./components";
import {
  createDemoConversations,
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
import { calculateDurationPriceFen } from "../../shared/pricing";
import { formatBeijingDateTimeLocal, parseBeijingDateTimeLocal } from "../../shared/scheduling";
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
  BookingOptions,
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
  const [bookingOptions, setBookingOptions] = useState<BookingOptions | null>(null);
  const [bookingStartsAt, setBookingStartsAt] = useState(() => formatBeijingDateTimeLocal(Date.now() + 3 * 60 * 60_000));
  const [bookingDuration, setBookingDuration] = useState<60 | 90 | 120>(60);
  const [bookingLocationType, setBookingLocationType] = useState<"venue" | "custom">("venue");
  const [bookingVenue, setBookingVenue] = useState<CoachVenue>(() => venues[0]);
  const [bookingCustomDistrict, setBookingCustomDistrict] = useState("");
  const [bookingCustomAddress, setBookingCustomAddress] = useState("");
  const [bookingCustomNote, setBookingCustomNote] = useState("");
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
      showFeedback(coach.unavailableReason || "该教练当前未上线接单");
      return;
    }
    let options: BookingOptions;
    try {
      options = demoMode ? {
        coachId: coach.id, durationMinutes: [60, 90, 120], earliestStartsAt: Date.now() + 2 * 60 * 60_000,
        latestStartsAt: Date.now() + 60 * 24 * 60 * 60_000, regularBasePriceFen: (coach.price || 0) * 100,
        trialBasePriceFen: (coach.trialPrice || coach.price || 0) * 100, venues: venues.filter((item) => item.coachId === coach.id || item.coachId === 5),
      } : await mobileApi.coachBookingOptions(coach.id);
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "暂时无法读取预约配置");
      return;
    }
    setSelectedCoachId(coach.id);
    setBookingOptions(options);
    setBookingStartsAt(formatBeijingDateTimeLocal(options.earliestStartsAt + 5 * 60_000));
    setBookingDuration(60);
    if (options.venues[0]) { setBookingLocationType("venue"); setBookingVenue(options.venues[0]); }
    else setBookingLocationType("custom");
    setAgreed(false);
    detailScrollPosition.current = window.scrollY;
    setView("booking");
    queueScroll(0);
  }, [demoMode, queueScroll, selectedCoach, showFeedback]);

  const performBooking = useCallback(async () => {
    if (!bookingOptions) return;
    const startsAt = parseBeijingDateTimeLocal(bookingStartsAt);
    if (!Number.isFinite(startsAt)) { showFeedback("请选择有效的北京时间"); return; }
    if (bookingLocationType === "custom" && (!bookingCustomDistrict.trim() || !bookingCustomAddress.trim())) { showFeedback("请填写期望区域和详细地点"); return; }
    setSubmitting(true);
    const input = {
      coachId: selectedCoach.id,
      customAddress: bookingCustomAddress,
      customDistrict: bookingCustomDistrict,
      customLocationNote: bookingCustomNote,
      durationMinutes: bookingDuration,
      learnerId: learner.id,
      locationType: bookingLocationType,
      note: bookingNote,
      startsAt,
      venueId: bookingLocationType === "venue" ? bookingVenue.id : undefined,
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
          venueId: bookingLocationType === "venue" ? bookingVenue.id : "custom",
          slotId: `request_${Date.now()}`,
          date: bookingStartsAt.slice(0, 10),
          dateLabel: "申请时间",
          time: bookingStartsAt.slice(11),
          endTime: formatBeijingDateTimeLocal(startsAt + bookingDuration * 60_000).slice(11),
          status: "pending_coach",
          submittedAt: "刚刚",
          feeFen: calculateDurationPriceFen(isTrialBooking ? bookingOptions.trialBasePriceFen : bookingOptions.regularBasePriceFen, bookingDuration),
          paymentStatus: "offline_unpaid",
          note: bookingNote,
          durationMinutes: bookingDuration,
          locationType: bookingLocationType,
          customDistrict: bookingCustomDistrict,
          customAddress: bookingCustomAddress,
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
  }, [apiConnected, bookingCustomAddress, bookingCustomDistrict, bookingCustomNote, bookingDuration, bookingLocationType, bookingNote, bookingOptions, bookingStartsAt, bookingVenue.id, demoMode, isTrialBooking, learner.id, props, selectedCoach, showFeedback]);

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
      {view === "booking" && bookingOptions ? <BookingView agreed={agreed} coach={selectedCoach} customAddress={bookingCustomAddress} customDistrict={bookingCustomDistrict} customLocationNote={bookingCustomNote} durationMinutes={bookingDuration} isTrialBooking={isTrialBooking} learner={learner} locationType={bookingLocationType} note={bookingNote} onBack={handleBack} onChangeCustomAddress={setBookingCustomAddress} onChangeCustomDistrict={setBookingCustomDistrict} onChangeCustomLocationNote={setBookingCustomNote} onChangeDuration={setBookingDuration} onChangeLocationType={setBookingLocationType} onChangeNote={setBookingNote} onChangeStartsAt={setBookingStartsAt} onChangeVenue={(id) => { const venue = bookingOptions.venues.find((item) => item.id === id); if (venue) setBookingVenue(venue); }} onConfirm={submitBooking} onEditLearner={() => setSheet("learner")} onToggleAgreement={() => setAgreed((current) => !current)} options={bookingOptions} preferences={preferences} startsAt={bookingStartsAt} submitting={submitting} venue={bookingVenue} /> : null}
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
