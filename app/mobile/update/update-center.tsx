"use client";

import { ArrowLeft, CheckCircle2, Download, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mobileApi, usesBundledDemoData } from "../api-client";
import { deferUpdateFor24Hours } from "../device";
import { appUpdater, type InstalledAppInfo, type UpdateDownloadProgress } from "../native-bridge";
import type { AppRelease } from "../types";
import { isNoNewReleaseError, updateCheckErrorMessage } from "./update-domain";

type UpdateCenterProps = {
  forcedRelease?: AppRelease | null;
  onBack: () => void;
};

const previewRelease: AppRelease = {
  certificateSha256: "E1:5C:DA:AB:AC:CF:B2:1E:52:1A:02:AD:14:70:AF:8D:07:9F:6D:81:6A:15:0F:11:33:92:C0:B3:C4:1E:57:9A",
  forced: false,
  minimumSupportedVersionCode: 3,
  notes: ["新增统一教练工作台", "预约提醒更及时", "优化启动速度与离线体验"],
  packageId: "com.zhuguang.coachos",
  publishedAt: "2026-08-01T12:00:00.000Z",
  sha256: "等待发布后生成",
  sizeBytes: 4_420_000,
  versionCode: 4,
  versionName: "1.1.1",
};

function sizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UpdateCenter({ forcedRelease, onBack }: UpdateCenterProps) {
  const demoMode = useMemo(() => usesBundledDemoData(), []);
  const [installed, setInstalled] = useState<InstalledAppInfo | null>(null);
  const [release, setRelease] = useState<AppRelease | null>(forcedRelease ?? null);
  const [checking, setChecking] = useState(!forcedRelease);
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);
  const [error, setError] = useState("");
  const [installPermission, setInstallPermission] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const info = await appUpdater.getInstalledInfo();
      setInstalled(info);

      void appUpdater.canInstallPackages()
        .then(({ allowed }) => setInstallPermission(allowed))
        .catch(() => setInstallPermission(null));

      const latest = demoMode ? previewRelease : await mobileApi.latestRelease();
      setRelease(latest.versionCode > info.versionCode ? latest : null);
    } catch (checkError) {
      if (isNoNewReleaseError(checkError)) setRelease(null);
      else setError(updateCheckErrorMessage(checkError));
    } finally {
      setChecking(false);
    }
  }, [demoMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (forcedRelease) void appUpdater.getInstalledInfo().then(setInstalled);
      else void check();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [check, forcedRelease]);

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    void appUpdater.onProgress(setProgress).then((next) => { handle = next; });
    return () => { void handle?.remove(); };
  }, []);

  const mandatory = Boolean(release && installed && installed.versionCode < release.minimumSupportedVersionCode);
  const downloading = progress && ["downloading", "verified", "installing"].includes(progress.state);

  const startUpdate = useCallback(async () => {
    if (!release) return;
    setError("");
    try {
      if (installPermission === false) {
        await appUpdater.openInstallPermission();
        setError("请允许逐光安装未知应用，返回后再次点击下载并更新");
        return;
      }
      const url = release.downloadUrl
        ?? (demoMode ? "" : (await mobileApi.createDownloadTicket(release.versionCode)).url);
      if (!url) throw new Error("当前是设计验收数据，发布 APK 后即可执行真实下载更新");
      await appUpdater.downloadAndInstall({
        certificateSha256: release.certificateSha256,
        packageId: release.packageId,
        sha256: release.sha256,
        url,
        versionCode: release.versionCode,
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新未完成，请重试");
    }
  }, [demoMode, installPermission, release]);

  return (
    <main className="zg-mobile-app zg-update-center">
      <header className="zg-update-header">
        <button aria-label="返回" disabled={mandatory} onClick={onBack} type="button"><ArrowLeft aria-hidden /></button>
        <h1>{downloading ? "安全更新" : mandatory ? "需要更新" : "版本更新"}</h1>
        <button aria-label="重新检查" disabled={checking || Boolean(downloading)} onClick={() => void check()} type="button"><RefreshCw aria-hidden className={checking ? "is-spinning" : ""} /></button>
      </header>

      {downloading && release ? (
        <section className="zg-update-progress">
          <h2>{progress.state === "verified" ? "安装包已安全验证" : progress.state === "installing" ? "正在打开系统安装器" : `正在下载 ${progress.percent}%`}</h2>
          <div><span style={{ width: `${progress.percent}%` }} /></div>
          <p>{sizeLabel(progress.downloadedBytes)} / {sizeLabel(progress.totalBytes || release.sizeBytes)}</p>
          <small>下载完成后将由 Android 系统确认安装</small>
        </section>
      ) : (
        <>
          <section className="zg-update-product">
            <span className="zg-update-logo">逐</span>
            <div><h2>逐光 <small>{installed?.versionName ?? "读取中"}</small></h2><p>{release ? `发现新版本 ${release.versionName}` : checking ? "正在检查新版本" : error ? "更新服务暂时不可用" : "当前已是最新版本"}</p></div>
          </section>

          {release ? (
            <>
              <section className="zg-update-notes">
                <h2>{mandatory ? "此版本需要更新" : "更新内容"}</h2>
                <ul>{release.notes.map((note) => <li key={note}>{note}</li>)}</ul>
              </section>
              <section className="zg-update-facts">
                <p><Download aria-hidden size={20} /><span>安装包</span><strong>{sizeLabel(release.sizeBytes)}</strong></p>
                <p><ShieldCheck aria-hidden size={20} /><span>签名与文件完整性</span><strong>下载后校验</strong></p>
                <p><PackageCheck aria-hidden size={20} /><span>安装确认</span><strong>仅需一次系统确认</strong></p>
              </section>
              <button className="zg-update-primary" onClick={() => void startUpdate()} type="button">下载并更新</button>
              {!mandatory ? <button className="zg-update-later" onClick={() => { void deferUpdateFor24Hours(); onBack(); }} type="button">稍后提醒我</button> : null}
            </>
          ) : !checking && !error ? (
            <section className="zg-update-current"><CheckCircle2 aria-hidden /><h2>已是最新版本</h2><p>逐光会在启动和恢复使用时安全检查更新。</p></section>
          ) : null}
        </>
      )}

      {error ? <p className="zg-update-error" role="alert">{error}</p> : null}
      <footer className="zg-update-security"><ShieldCheck aria-hidden size={20} /><span><strong>安全更新</strong>仅安装包名与当前签名一致、SHA-256 完整性通过的 APK。</span></footer>
    </main>
  );
}

export { previewRelease };
