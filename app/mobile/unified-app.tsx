"use client";

import { BadgeCheck, Bell, BriefcaseBusiness, ChevronRight, ShieldCheck, UserRound, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import MobileStudentApp from "./app";
import { mobileApi, usesBundledDemoData } from "./api-client";
import { CoachApp } from "./coach/coach-app";
import { AccountProfileSheet } from "./sheets";
import {
  acceptPrivacyConsent,
  getMobilePlatform,
  hasPrivacyConsent,
  getOrCreateDeviceId,
  listenForAppResume,
  listenForAppUrl,
  readAccountMode,
  readLastCoachTab,
  readLastStudentTab,
  readSession,
  readUpdateDeferredUntil,
  writeAccountMode,
  writeLastCoachTab,
  writeLastStudentTab,
  writeSession,
} from "./device";
import { appUpdater, pushBridge } from "./native-bridge";
import type {
  AccountMode,
  AccountProfile,
  AppRelease,
  CoachAccountSummary,
  CoachTab,
  MobileIdentity,
  MobileSession,
  MobileStudentAppProps,
  MobileTab,
} from "./types";
import { previewRelease, UpdateCenter } from "./update/update-center";
import { getUpdateDecision, parsePrivateQaNotification, parseZhuguangDeepLink, resolveAccountMode } from "./unified-domain";

type Surface = "app" | "updates";

const demoCoach: CoachAccountSummary = {
  auditStatus: "approved",
  id: 1,
  name: "周明",
  pendingBookingCount: 3,
  sport: "羽毛球",
  title: "国家队退役运动员",
};

function timeout<T>(promise: Promise<T>, durationMs: number) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), durationMs)),
  ]);
}

export default function UnifiedMobileApp(props: MobileStudentAppProps) {
  const demoMode = useMemo(() => usesBundledDemoData(), []);
  const mobilePlatform = useMemo(() => getMobilePlatform(), []);
  const nativePushSupported = pushBridge.isSupported();
  const [booting, setBooting] = useState(true);
  const [showBootBrand, setShowBootBrand] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean | null>(null);
  const [mode, setMode] = useState<AccountMode>("student");
  const [studentTab, setStudentTab] = useState<MobileTab>("home");
  const [coachTab, setCoachTab] = useState<CoachTab>("workspace");
  const [identity, setIdentity] = useState<MobileIdentity>({ availableModes: ["student"], contactMasked: "", phoneMasked: "" });
  const [roleSheet, setRoleSheet] = useState(false);
  const [surface, setSurface] = useState<Surface>("app");
  const [forcedRelease, setForcedRelease] = useState<AppRelease | null>(null);
  const [optionalRelease, setOptionalRelease] = useState<AppRelease | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState("");
  const [notificationPrompt, setNotificationPrompt] = useState(false);
  const [accountProfileOpen, setAccountProfileOpen] = useState(false);
  const [routeRevision, setRouteRevision] = useState(0);

  const hasCoachMode = identity.availableModes.includes("coach") && identity.coach?.auditStatus === "approved";

  useEffect(() => {
    if (!booting) return;
    const timer = window.setTimeout(() => setShowBootBrand(true), 250);
    return () => window.clearTimeout(timer);
  }, [booting]);

  const applyDeepLink = useCallback((url: string) => {
    const diagnostic = demoMode ? parsePrivateQaNotification(url) : null;
    if (diagnostic) {
      void pushBridge.simulateNotification(diagnostic).then(() => {
        setDeepLinkNotice("测试通知已发送");
        window.setTimeout(() => setDeepLinkNotice(""), 2400);
      }).catch(() => {
        setDeepLinkNotice("请先开启通知权限");
        window.setTimeout(() => setDeepLinkNotice(""), 2400);
      });
      return;
    }
    const target = parseZhuguangDeepLink(url);
    if (target.updates) {
      setSurface("updates");
      return;
    }
    if (target.mode === "coach" && !hasCoachMode) {
      setDeepLinkNotice("该账号当前没有可用的教练权限");
      window.setTimeout(() => setDeepLinkNotice(""), 2400);
      return;
    }
    if (target.studentTab) {
      setStudentTab(target.studentTab);
      void writeLastStudentTab(target.studentTab);
    }
    if (target.coachTab) {
      setCoachTab(target.coachTab);
      void writeLastCoachTab(target.coachTab);
    }
    if (target.mode) {
      setMode(target.mode);
      void writeAccountMode(target.mode);
    }
    if (target.mode || target.studentTab || target.coachTab) {
      setRouteRevision((revision) => revision + 1);
    }
    setSurface("app");
  }, [demoMode, hasCoachMode]);

  const consumePendingPushLink = useCallback(() => {
    void pushBridge.consumePendingDeepLink().then(({ deepLink }) => {
      if (deepLink) applyDeepLink(deepLink);
    }).catch(() => {
      // A pending notification route is retried on the next app resume.
    });
  }, [applyDeepLink]);

  const checkForUpdates = useCallback(async () => {
    if (demoMode || mobilePlatform !== "android") return;
    try {
      const latest = await timeout(mobileApi.latestRelease(), 4_000);
      const currentVersionCode = Number((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_APP_VERSION_CODE ?? 3);
      const decision = getUpdateDecision(currentVersionCode, latest, await readUpdateDeferredUntil());
      if (decision === "current" || decision === "deferred") return;
      if (decision === "forced") {
        setForcedRelease(latest);
        setSurface("updates");
        return;
      }
      setOptionalRelease(latest);
    } catch {
      // Update checks are silent during offline startup; users can retry from Version Center.
    }
  }, [demoMode, mobilePlatform]);

  const initializePush = useCallback(async () => {
    let push = await pushBridge.setPrivacyConsent(true);
    if (demoMode) return;
    try {
      if (push.initialized && !push.registrationId) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        push = await pushBridge.setPrivacyConsent(true);
      }
      const [installationId, installed] = await Promise.all([getOrCreateDeviceId(), appUpdater.getInstalledInfo()]);
      await mobileApi.registerInstallation({
        installationId,
        pushRegistrationId: push.registrationId,
        versionCode: installed.versionCode,
        versionName: installed.versionName,
      });
    } catch {
      // Device registration is retried on the next launch or app resume.
    }
  }, [demoMode]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readSession(),
      readAccountMode(),
      readLastStudentTab(),
      readLastCoachTab(),
      hasPrivacyConsent(),
    ]).then(async ([session, storedMode, storedStudentTab, storedCoachTab, consent]) => {
      let nextIdentity: MobileIdentity = {
        availableModes: session?.availableModes ?? ["student"],
        coach: session?.coach,
        contactMasked: session?.contactMasked ?? session?.phoneMasked ?? "",
        phoneMasked: session?.phoneMasked ?? "",
        profile: session?.profile,
      };
      if (demoMode) nextIdentity = { availableModes: ["student", "coach"], coach: demoCoach, contactMasked: "local@example.com", phoneMasked: "138 **** 2026" };
      else if (session) {
        try {
          nextIdentity = await timeout(mobileApi.me(), 4_000);
        } catch {
          // Keep the signed session's last known roles while offline; server checks every privileged action.
        }
      }
      if (cancelled) return;
      setIdentity(nextIdentity);
      setStudentTab(storedStudentTab);
      setCoachTab(storedCoachTab);
      setMode(resolveAccountMode(storedMode, nextIdentity.availableModes, nextIdentity.coach));
      setPrivacyAccepted(consent);
      setBooting(false);
      if (consent) void initializePush();
      void checkForUpdates();
    });
    return () => { cancelled = true; };
  }, [checkForUpdates, demoMode, initializePush]);

  useEffect(() => {
    const removeUrl = listenForAppUrl(applyDeepLink);
    let pushHandle: { remove: () => Promise<void> } | undefined;
    void pushBridge.onOpen(applyDeepLink).then((handle) => { pushHandle = handle; });
    consumePendingPushLink();
    const removeResume = listenForAppResume(() => {
      void checkForUpdates();
      if (privacyAccepted) void initializePush();
      consumePendingPushLink();
    });
    return () => {
      removeUrl();
      removeResume();
      void pushHandle?.remove();
    };
  }, [applyDeepLink, checkForUpdates, consumePendingPushLink, initializePush, privacyAccepted]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ behavior: "auto", left: 0, top: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [mode, routeRevision]);

  const switchMode = useCallback((nextMode: AccountMode) => {
    if (nextMode === "coach" && !hasCoachMode) return;
    setMode(nextMode);
    setRoleSheet(false);
    setSurface("app");
    void writeAccountMode(nextMode);
    if (nextMode === "coach") {
      if (!nativePushSupported) return;
      void pushBridge.getPermissionStatus().then(({ granted }) => {
        if (!granted) setNotificationPrompt(true);
      });
    }
  }, [hasCoachMode, nativePushSupported]);

  const handleSessionChange = useCallback((session: MobileSession | null) => {
    const nextIdentity: MobileIdentity = demoMode
      ? { availableModes: ["student", "coach"], coach: demoCoach, contactMasked: session?.contactMasked ?? "local@example.com", phoneMasked: session?.phoneMasked ?? "138 **** 2026" }
      : { availableModes: session?.availableModes ?? ["student"], coach: session?.coach, contactMasked: session?.contactMasked ?? session?.phoneMasked ?? "", phoneMasked: session?.phoneMasked ?? "", profile: session?.profile };
    setIdentity(nextIdentity);
    if (!nextIdentity.availableModes.includes("coach")) switchMode("student");
    if (session && privacyAccepted) void initializePush();
  }, [demoMode, initializePush, privacyAccepted, switchMode]);

  const applyAccountProfile = useCallback(async (profile: AccountProfile) => {
    setIdentity((current) => ({ ...current, profile }));
    const session = await readSession();
    if (session) await writeSession({ ...session, profile });
  }, []);

  if (booting) {
    return (
      <main aria-busy="true" aria-label="正在准备逐光" className="zg-mobile-app zg-native-handoff">
        {showBootBrand ? <Image alt="" className="zg-native-handoff-mark" height={72} priority src="./logo-mark.svg" unoptimized width={72} /> : null}
      </main>
    );
  }

  if (!privacyAccepted) {
    return (
      <main className="zg-mobile-app zg-privacy-gate">
        <div className="zg-privacy-brand"><Image alt="" height={34} priority src="./logo-mark.svg" unoptimized width={34} /><strong>逐光</strong></div>
        <section>
          <ShieldCheck aria-hidden size={29} />
          <h1>欢迎使用逐光</h1>
          <p>在开始前，请阅读并同意《用户协议》和《隐私政策》。逐光仅使用账号、预约与设备必要信息提供服务；{nativePushSupported ? "你同意后才会初始化消息推送。" : "iOS 首个测试版本通过应用内刷新获取消息，不会申请通知权限。"}</p>
          <div><a href="https://beijingzhuguang.top/terms" rel="noreferrer" target="_blank">用户协议</a><a href="https://beijingzhuguang.top/privacy" rel="noreferrer" target="_blank">隐私政策</a></div>
          <button className="zg-privacy-accept" onClick={() => {
            void acceptPrivacyConsent().then(initializePush);
            setPrivacyAccepted(true);
          }} type="button">同意并继续</button>
          <small>你可以在“我的 - 账号与隐私”中管理授权。</small>
        </section>
      </main>
    );
  }

  if (surface === "updates") {
    return <UpdateCenter forcedRelease={forcedRelease} onBack={() => { if (!forcedRelease) setSurface("app"); }} />;
  }

  return (
    <>
      {mode === "student" ? (
        <MobileStudentApp
          {...props}
          coachSummary={identity.coach}
          initialTab={studentTab}
          key={`student-${routeRevision}`}
          onOpenCoachMode={() => setRoleSheet(true)}
          onOpenUpdates={() => setSurface("updates")}
          onSessionChange={handleSessionChange}
          onTabChange={(tab) => { setStudentTab(tab); void writeLastStudentTab(tab); }}
        />
      ) : identity.coach ? (
        <CoachApp
          accountProfile={identity.profile}
          initialTab={coachTab}
          key={`coach-${routeRevision}`}
          onEditAccountProfile={() => setAccountProfileOpen(true)}
          onOpenUpdates={() => setSurface("updates")}
          onSwitchStudent={() => setRoleSheet(true)}
          onTabChange={(tab) => { setCoachTab(tab); void writeLastCoachTab(tab); }}
          summary={identity.coach}
        />
      ) : null}

      {optionalRelease ? (
        <button className="zg-update-banner" onClick={() => setSurface("updates")} type="button">
          <span>发现安全更新 {optionalRelease.versionName}</span><ChevronRight aria-hidden size={17} />
        </button>
      ) : null}

      {roleSheet ? (
        <div className="zg-sheet-backdrop zg-role-sheet-backdrop" role="presentation" onClick={() => setRoleSheet(false)}>
          <section aria-labelledby="zg-role-title" aria-modal="true" className="zg-role-sheet" onClick={(event) => event.stopPropagation()} role="dialog">
            <i className="zg-sheet-handle" />
            <header><h2 id="zg-role-title">切换身份</h2><button aria-label="关闭" onClick={() => setRoleSheet(false)} type="button"><X aria-hidden /></button></header>
            <button className={mode === "student" ? "is-selected" : ""} onClick={() => switchMode("student")} type="button">
              <span className="zg-role-icon"><UserRound aria-hidden /></span><span><strong>学员身份</strong><small>找教练、预约与训练记录</small></span>{mode === "student" ? <BadgeCheck aria-hidden /> : <ChevronRight aria-hidden />}
            </button>
            {identity.coach ? <button className={mode === "coach" ? "is-selected" : ""} onClick={() => switchMode("coach")} type="button">
              <span className="zg-role-avatar">{identity.coach.name.slice(0, 1)}</span><span><strong>教练身份</strong><small>{identity.coach.name} · {identity.coach.sport}</small></span>{mode === "coach" ? <BadgeCheck aria-hidden /> : <ChevronRight aria-hidden />}
            </button> : null}
            <button className="zg-role-confirm" onClick={() => switchMode(mode === "student" && hasCoachMode ? "coach" : "student")} type="button"><BriefcaseBusiness aria-hidden size={19} />{mode === "student" && hasCoachMode ? "进入教练工作台" : "切换为学员身份"}</button>
          </section>
        </div>
      ) : null}
      {accountProfileOpen ? <AccountProfileSheet
        onClose={() => setAccountProfileOpen(false)}
        onDeleteAvatar={async () => { await applyAccountProfile(await mobileApi.deleteAvatar()); }}
        onSave={async (input) => { await applyAccountProfile(await mobileApi.updateProfile(input)); setDeepLinkNotice("账号资料已更新"); window.setTimeout(() => setDeepLinkNotice(""), 2200); }}
        onUploadAvatar={async (blob) => { await applyAccountProfile(await mobileApi.uploadAvatar(blob)); setDeepLinkNotice("头像已更新"); window.setTimeout(() => setDeepLinkNotice(""), 2200); }}
        profile={identity.profile}
      /> : null}
      {notificationPrompt ? (
        <div className="zg-sheet-backdrop zg-notification-primer-backdrop" role="presentation">
          <section aria-labelledby="zg-notification-title" aria-modal="true" className="zg-notification-primer" role="dialog">
            <span><Bell aria-hidden /></span>
            <h2 id="zg-notification-title">及时处理预约</h2>
            <p>开启通知后，你会收到预约确认、改期和学员消息提醒。锁屏内容不会显示未成年学员姓名。</p>
            <button className="is-primary" onClick={() => {
              void pushBridge.requestPermission().then(({ granted }) => {
                setNotificationPrompt(false);
                setDeepLinkNotice(granted ? "通知已开启" : "你可以稍后在系统设置中开启通知");
                window.setTimeout(() => setDeepLinkNotice(""), 2400);
              });
            }} type="button">开启通知</button>
            <button onClick={() => setNotificationPrompt(false)} type="button">暂不开启</button>
          </section>
        </div>
      ) : null}
      {deepLinkNotice ? <div className="zg-toast" role="status">{deepLinkNotice}</div> : null}
    </>
  );
}

export { previewRelease };
