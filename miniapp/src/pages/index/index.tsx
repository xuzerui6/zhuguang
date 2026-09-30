import Taro, { useDidHide, useDidShow, usePullDownRefresh, useRouter } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandHeader } from "../../components/brand-header";
import { TabBar } from "../../components/tab-bar";
import { StudentHome } from "../../features/student/home";
import { StudentDiscover } from "../../features/student/discover";
import { StudentBookings } from "../../features/student/bookings";
import { StudentMessages } from "../../features/student/messages";
import { StudentProfile } from "../../features/student/profile";
import { CoachWorkspace } from "../../features/coach/workspace";
import { CoachRequests } from "../../features/coach/requests";
import { CoachSchedule } from "../../features/coach/schedule";
import { CoachProfile } from "../../features/coach/profile";
import { ApiError, bootstrap, coachOverview, listRescheduleProposals, logoutWechatSession, saveServiceCity, startWechatLogin, updateCoachAvailability } from "../../services/api";
import { getLocalFavoriteCoachIds, getMode, getSession, setMode, setSession } from "../../services/storage";
import { ALL_SPORTS, SERVICE_CITIES, getStoredServiceCity, locateServiceCity, serviceCityName, storeServiceCity, type ServiceCityId } from "../../services/service-city";
import type { AccountMode, Bootstrap, CoachOverview, CoachTab, RescheduleProposal, Session, StudentTab } from "../../types";
import "./index.scss";
import { acceptFavorites, favoriteIds, favoriteTicket, flushFavorites, subscribeFavorites } from '../../services/favorites';
import { MINIAPP_COACH_TAB_ORDER, nextMotion, STUDENT_TAB_ORDER, tabDirection, type NavigationMotionState } from '../../../../shared/motion';

export default function IndexPage() {
  const router = useRouter();
  const [mode, setAccountMode] = useState<AccountMode>(() => getMode());
  const [studentTab, setStudentTab] = useState<StudentTab>(() => {
    const tab = router.params.tab;
    return tab === "discover" || tab === "bookings" || tab === "messages" || tab === "profile" ? tab : "home";
  });
  const [discoverSport, setDiscoverSport] = useState("全部项目");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [serviceCity, setServiceCity] = useState<ServiceCityId>(() => getStoredServiceCity());
  const [coachTab, setCoachTab] = useState<CoachTab>("workspace");
  const [navigationMotion, setNavigationMotion] = useState<NavigationMotionState>({ direction: "none", intent: "tab", sequence: 0 });
  const [session, setCurrentSession] = useState<Session | null>(() => getSession());
  const [data, setData] = useState<Bootstrap>({coaches:[],bookings:[],conversations:[],favoriteCoachIds:[],learnerProfiles:[]});
  const [coachData, setCoachData] = useState<CoachOverview | null>(null);
  const [rescheduleProposals, setRescheduleProposals] = useState<RescheduleProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState("");
  const loadPromise = useRef<Promise<void> | null>(null);
  const loadContext=useRef("");
  const loadEpoch=useRef(0);
  const visible = useRef(true);

  const load = useCallback((quiet = false) => {
    const context=`${serviceCity}:${mode}:${getSession()?.accessToken||"guest"}`;
    if (loadPromise.current && loadContext.current===context) return loadPromise.current;
    loadContext.current=context;
    const epoch=++loadEpoch.current;
    const task = (async () => {
      try {
        const activeSession = getSession();
        const favoritesRead = favoriteTicket();
        setCurrentSession(activeSession);
        const [next, proposals] = await Promise.all([
          bootstrap(serviceCity),
          activeSession ? listRescheduleProposals().catch(() => []) : Promise.resolve([]),
        ]);
        if(epoch!==loadEpoch.current || !visible.current)return;
        setCurrentSession(getSession());
        setLoadError("");
        if (activeSession) acceptFavorites(next.favoriteCoachIds, favoritesRead);
        setData({ ...next, favoriteCoachIds: favoriteIds() });
        if (activeSession) void flushFavorites().catch(() => undefined);
        setRescheduleProposals(proposals);
        const refreshedSession = getSession();
        if (mode === "coach") {
          if (!refreshedSession?.availableModes.includes("coach")) {
            setCoachData(null);
            setMode("student");
            setAccountMode("student");
          } else {
            try {
              const overview=await coachOverview();
              if(epoch!==loadEpoch.current)return;
              setCoachData(overview);
            } catch (error) {
              if(epoch!==loadEpoch.current)return;
              if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                const studentSession = { ...refreshedSession, availableModes: ["student"] as AccountMode[] };
                setSession(studentSession, true);
                setCurrentSession(studentSession);
                setCoachData(null);
                setMode("student");
                setAccountMode("student");
                Taro.showToast({ title: "教练权限已更新，已切换为学员模式", icon: "none" });
              } else {
                throw error;
              }
            }
          }
        }
      } catch (error) {
        if(epoch!==loadEpoch.current)return;
        setLoadError(error instanceof Error?error.message:"刷新失败，请重试");
        if (!quiet) Taro.showToast({ title: error instanceof Error ? error.message : "刷新失败", icon: "none" });
      } finally {
        if(epoch===loadEpoch.current){setLoading(false);Taro.stopPullDownRefresh();}
      }
    })();
    loadPromise.current = task;
    void task.finally(() => { if (loadPromise.current === task) loadPromise.current = null; });
    return task;
  }, [mode, serviceCity]);
  useEffect(() => subscribeFavorites(ids => setData(current => ({ ...current, favoriteCoachIds: ids }))), []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useDidShow(() => { visible.current = true; setCurrentSession(getSession()); void load(); });
  useDidHide(() => { visible.current = false; loadEpoch.current++; loadPromise.current = null; });
  usePullDownRefresh(() => { void load(); });
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => { if (visible.current) void load(true); }, 15_000);
    return () => clearInterval(timer);
  }, [load, session]);
  useEffect(() => {
    const connected = (event: { isConnected: boolean }) => { if (event.isConnected && visible.current) void load(true); };
    Taro.onNetworkStatusChange(connected);
    return () => Taro.offNetworkStatusChange(connected);
  }, [load]);

  const switchMode = useCallback(async (next: AccountMode) => {
    if (next === "coach" && !session?.availableModes.includes("coach")) {
      Taro.showToast({ title: "该账号尚未绑定认证教练", icon: "none" });
      return;
    }
    if (next === "coach") {
      try { setCoachData(await coachOverview()); }
      catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "教练工作台加载失败", icon: "none" }); return; }
    }
    setNavigationMotion((current) => nextMotion(current, "role", "none"));
    setMode(next);
    setAccountMode(next);
  }, [session]);

  const login = useCallback(async (next?: string) => {
    try {
      Taro.showLoading({ title: "正在登录" });
      const result = await startWechatLogin();
      if (result.status === "link_required") {
        await Taro.navigateTo({ url: `/pages/account-link/index?next=${encodeURIComponent(next || "/pages/index/index?tab=profile")}` });
        return;
      }
      setCurrentSession(result.session);
      if (next) {
        const destination = result.session.profile?.completed ? next : `/pages/profile-edit/index?next=${encodeURIComponent(next)}`;
        await Taro.navigateTo({ url: destination });
        return;
      }
      if (!result.session.profile?.completed) {
        await Taro.navigateTo({ url: `/pages/profile-edit/index?next=${encodeURIComponent("/pages/index/index?tab=profile")}` });
        return;
      }
      if (result.session.availableModes.includes("coach")) {
        try {
          const choice = await Taro.showActionSheet({ itemList: ["进入学员端", "进入教练工作台"] });
          if (choice.tapIndex === 1) {
            setNavigationMotion((current) => nextMotion(current, "role", "none"));
            setMode("coach");
            setAccountMode("coach");
            setCoachData(await coachOverview());
          } else {
            setNavigationMotion((current) => nextMotion(current, "role", "none"));
            setMode("student");
            setAccountMode("student");
          }
        } catch {
          setNavigationMotion((current) => nextMotion(current, "role", "none"));
          setMode("student");
          setAccountMode("student");
        }
      }
      await load();
    } catch (error) {
      Taro.showModal({ title: "微信登录未完成", content: error instanceof Error ? error.message : "请稍后再试", showCancel: false });
    } finally {
      Taro.hideLoading();
    }
  }, [load]);

  const logout = useCallback(async () => {
    const confirmed = await Taro.showModal({ title: "退出当前账号", content: "退出后仍可匿名浏览教练，收藏会保留在本机。", confirmText: "退出" });
    if (!confirmed.confirm) return;
    try { await logoutWechatSession(); }
    catch { /* Local state is cleared even if the network is unavailable. */ }
    setCurrentSession(null);
    setCoachData(null);
    setRescheduleProposals([]);
    setNavigationMotion((current) => nextMotion(current, "role", "none"));
    setMode("student");
    setAccountMode("student");
    setStudentTab("profile");
    loadEpoch.current++;
    setData(current=>({coaches:current.coaches,bookings:[],conversations:[],learnerProfiles:[],favoriteCoachIds:getLocalFavoriteCoachIds()}));
    Taro.showToast({ title: "已退出", icon: "success" });
  }, []);

  const setAvailability = useCallback(async (enabled: boolean) => {
    if (!coachData) return;
    const previous = coachData;
    setCoachData({ ...coachData, coach: { ...coachData.coach, bookingEnabled: enabled } });
    try {
        const result = await updateCoachAvailability(enabled);
        setCoachData(current => current ? { ...current, coach: { ...current.coach, bookingEnabled: result.effectiveOnline } } : current);
        Taro.showToast({ title: result.effectiveOnline ? "已开始接单" : enabled ? "暂不能上线，请查看审核或运营状态" : "已停止接单", icon: result.effectiveOnline === enabled ? "success" : "none" });
    } catch (error) {
      setCoachData(previous);
      Taro.showToast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
    }
  }, [coachData]);

  const active = mode === "student" ? studentTab : coachTab;
  const unread = useMemo(() => (mode === "student" ? data.conversations : coachData?.conversations || []).reduce((total, item) => total + item.unreadCount, 0), [coachData?.conversations, data.conversations, mode]);
  const sports = ALL_SPORTS;
  const navigateStudent = useCallback((next: StudentTab) => {
    if (next === studentTab) return;
    setNavigationMotion((current) => nextMotion(current, "tab", tabDirection(STUDENT_TAB_ORDER, studentTab, next)));
    setStudentTab(next);
  }, [studentTab]);
  const navigateCoach = useCallback((next: CoachTab) => {
    if (next === coachTab) return;
    setNavigationMotion((current) => nextMotion(current, "tab", tabDirection(MINIAPP_COACH_TAB_ORDER, coachTab, next)));
    setCoachTab(next);
  }, [coachTab]);
  const goStudent = useCallback((tab: StudentTab) => {
    setStudentTab(tab);
    setNavigationMotion((current) => nextMotion(current, "role", "none"));
    setAccountMode("student");
    setMode("student");
  }, []);

  const changeCity = useCallback(async () => {
    try {
      const choice = await Taro.showActionSheet({ itemList: SERVICE_CITIES.map((item) => item.name) });
      const cityId = SERVICE_CITIES[choice.tapIndex]?.id;
      if (!cityId || cityId === serviceCity) return;
      storeServiceCity(cityId); setData(current=>({...current,coaches:[]}));setLoading(true);setLoadError("");setServiceCity(cityId);
      if (getSession()) await saveServiceCity(cityId, "manual").catch(() => undefined);
      Taro.showToast({ title: `已切换到${serviceCityName(cityId)}`, icon: "success" });
    } catch { /* Action sheet cancellation is expected. */ }
  }, [serviceCity]);

  const locateCity = useCallback(async () => {
    try {
      Taro.showLoading({ title: "正在定位" });
      const cityId = await locateServiceCity();
      if (!cityId) {
        await Taro.showModal({ title: "暂未覆盖当前位置", content: "逐光当前服务北京和长春，请手动选择服务城市。", showCancel: false });
        return;
      }
      storeServiceCity(cityId); setData(current=>({...current,coaches:[]}));setLoading(true);setLoadError("");setServiceCity(cityId);
      if (getSession()) await saveServiceCity(cityId, "location").catch(() => undefined);
      Taro.showToast({ title: `已定位到${serviceCityName(cityId)}`, icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "定位未完成，请手动选择", icon: "none" });
    } finally { Taro.hideLoading(); }
  }, []);

  const sceneKey = `${mode}-${active}-${navigationMotion.sequence}`;
  return <View className={`zg-app is-${mode} ${loading ? "is-loading" : ""}`}>
    <BrandHeader mode={mode} onAccount={() => mode === "student" ? navigateStudent("profile") : navigateCoach("profile")} onNotifications={() => mode === "student" ? navigateStudent("messages") : navigateCoach("messages")} unread={unread} />
    <View className={`zg-view zg-scene is-${navigationMotion.intent} is-${navigationMotion.direction}`} key={sceneKey}>
      {loadError?<View className="zg-sync-error"><Text>{loadError}</Text><View className="zg-outline-button" onClick={()=>void load()}><Text>重新连接</Text></View></View>:null}
      {mode === "student" && studentTab === "home" ? <StudentHome bookings={data.bookings} cityName={serviceCityName(serviceCity)} coaches={data.coaches} onBookings={() => navigateStudent("bookings")} onChangeCity={() => void changeCity()} onDiscover={() => navigateStudent("discover")} onLocate={() => void locateCity()} onSelectSport={(sport) => { setDiscoverSport(sport); navigateStudent("discover"); }} sports={sports} /> : null}
{mode === "student" && studentTab === "discover" ? <StudentDiscover key={serviceCity} cityName={serviceCityName(serviceCity)} coaches={data.coaches} favoriteCoachIds={data.favoriteCoachIds} favoritesOnly={favoritesOnly} onFavoritesOnly={setFavoritesOnly} onSelectSport={setDiscoverSport} selectedSport={discoverSport} /> : null}
      {mode === "student" && studentTab === "bookings" ? <StudentBookings bookings={data.bookings} onChanged={() => void load()} onDiscover={() => navigateStudent("discover")} proposals={rescheduleProposals} /> : null}
      {mode === "student" && studentTab === "messages" ? <StudentMessages conversations={data.conversations} role="student" /> : null}
{mode === "student" && studentTab === "profile" ? <StudentProfile onBookings={() => navigateStudent("bookings")} onCoachApplication={() => session ? Taro.navigateTo({ url: "/pages/coach-application/index" }) : void login("/pages/coach-application/index")} onCoachMode={() => void switchMode("coach")} onDiscover={() => { setFavoritesOnly(true); setDiscoverSport("全部项目"); navigateStudent("discover"); }} onEdit={() => Taro.navigateTo({ url: "/pages/profile-edit/index" })} onLearners={() => Taro.navigateTo({ url: "/pages/learner-profile/index" })} onLogin={() => void login()} onLogout={() => void logout()} profile={data.profile || session?.profile} session={session} /> : null}
      {mode === "coach" && coachData && coachTab === "workspace" ? <CoachWorkspace onNavigate={navigateCoach} overview={coachData} /> : null}
      {mode === "coach" && coachData && coachTab === "requests" ? <CoachRequests bookings={coachData.bookings} /> : null}
      {mode === "coach" && coachData && coachTab === "schedule" ? <CoachSchedule onToggle={(enabled) => void setAvailability(enabled)} overview={coachData} /> : null}
      {mode === "coach" && coachData && coachTab === "messages" ? <StudentMessages conversations={coachData.conversations} role="coach" /> : null}
      {mode === "coach" && coachData && coachTab === "profile" ? <CoachProfile onEdit={() => Taro.navigateTo({ url: "/pages/coach-profile-edit/index" })} onStudentMode={() => goStudent("profile")} overview={coachData} /> : null}
      {mode === "coach" && !coachData ? <View className="zg-state-panel"><View className="zg-skeleton-line is-wide" /><View className="zg-skeleton-line" /></View> : null}
    </View>
    <TabBar active={active} mode={mode} onChange={(tab) => mode === "student" ? navigateStudent(tab as StudentTab) : navigateCoach(tab as CoachTab)} unread={unread} />
  </View>;
}
