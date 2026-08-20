"use client";

import { Check, Clipboard, Download, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./public-site.module.css";

const apiOrigin = "https://api.beijingzhuguang.top";
const downloadPageUrl = "https://beijingzhuguang.top/download";
const downloadIdKey = "zhuguang-public-download-id";

interface PublicRelease {
  certificateSha256: string;
  minAndroid: string;
  minimumSupportedVersionCode: number;
  notes: string[];
  packageId: string;
  publishedAt: number;
  sha256: string;
  sizeBytes: number;
  versionCode: number;
  versionName: string;
}

function sizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeZone: "Asia/Shanghai" }).format(new Date(timestamp));
}

function getDownloadId() {
  const current = window.localStorage.getItem(downloadIdKey);
  if (current && /^[a-zA-Z0-9_-]{20,160}$/u.test(current)) return current;
  const next = crypto.randomUUID().replaceAll("-", "");
  window.localStorage.setItem(downloadIdKey, next);
  return next;
}

async function readJson(response: Response) {
  const payload = await response.json() as { data?: unknown; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "下载服务暂时不可用");
  return payload.data;
}

async function fetchPublicRelease() {
  const response = await fetch("/api/app-release", { cache: "no-store" });
  return await readJson(response) as PublicRelease;
}

export function AppDownloadClient({ compact = false }: { compact?: boolean }) {
  const [release, setRelease] = useState<PublicRelease | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "downloading" | "error">("loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<"link" | "sha" | null>(null);
  const isWeChat = useMemo(() => typeof navigator !== "undefined" && /MicroMessenger/iu.test(navigator.userAgent), []);

  const load = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    try {
      setRelease(await fetchPublicRelease());
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "下载服务暂时不可用");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPublicRelease().then((next) => {
      if (!active) return;
      setRelease(next);
      setStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "下载服务暂时不可用");
    });
    return () => { active = false; };
  }, []);

  async function copy(value: string, type: "link" | "sha") {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function startDownload() {
    if (!release) return;
    if (isWeChat) {
      setMessage("微信内暂不直接下载 APK。请点击右上角菜单，选择“在浏览器打开”。");
      return;
    }
    setStatus("downloading");
    setMessage("正在生成 5 分钟有效的安全下载链接…");
    try {
      const response = await fetch(`${apiOrigin}/api/v1/public/app/releases/${release.versionCode}/download-ticket`, {
        body: JSON.stringify({ downloadId: getDownloadId() }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const ticket = await readJson(response) as { url: string };
      window.location.assign(ticket.url);
      setStatus("ready");
      setMessage("下载已开始。安装时 Android 会再次请求你的确认。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "生成下载链接失败，请稍后重试");
    }
  }

  if (compact) {
    return (
      <div className={styles.downloadCompact}>
        <div className={styles.downloadCompactCopy}>
          <span className={styles.downloadPlatform}>ANDROID APP</span>
          <h2>把教练、预约与训练记录<br />装进同一个 App</h2>
          <p>学员与认证教练使用同一个账号。公开下载，安装包由逐光私有存储安全分发。</p>
          <div className={styles.downloadCompactActions}>
            <a className={styles.downloadPrimary} href="/download"><Download aria-hidden size={18} />下载 Android App</a>
            {release ? <span>v{release.versionName} · {sizeLabel(release.sizeBytes)} · Android {release.minAndroid}+</span> : <span>{status === "error" ? "版本信息暂不可用" : "正在读取正式版本…"}</span>}
          </div>
        </div>
        <div className={styles.downloadPhone} aria-label="逐光 Android App 界面预览">
          <div className={styles.downloadPhoneTop}><Image alt="" height={42} src="/app-icon-192.png" unoptimized width={42} /><span>逐光</span></div>
          <Image alt="逐光 App 教练服务界面" fill sizes="300px" src="/mobile-coach-hero-v23.webp" unoptimized />
          <div className={styles.downloadPhoneCaption}><strong>北京专业教练</strong><span>查找 · 咨询 · 预约 · 记录</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.downloadProduct}>
      <section className={styles.downloadSummary}>
        <div className={styles.downloadAppIdentity}>
          <Image alt="逐光 App 图标" height={82} priority src="/app-icon-192.png" unoptimized width={82} />
          <div><span>逐光 Android App</span><h1>训练服务，随时在手边</h1><p>同一个 App 支持学员模式与认证教练工作台。</p></div>
        </div>

        {isWeChat ? (
          <div className={styles.wechatNotice} role="status">
            <ExternalLink aria-hidden size={21} />
            <div><strong>请在系统浏览器中下载</strong><p>点击微信右上角菜单，选择“在浏览器打开”，再返回本页下载。</p></div>
            <button onClick={() => void copy(downloadPageUrl, "link")} type="button">{copied === "link" ? <Check aria-hidden size={17} /> : <Clipboard aria-hidden size={17} />}{copied === "link" ? "已复制" : "复制链接"}</button>
          </div>
        ) : null}

        <button className={styles.downloadHeroButton} disabled={!release || status === "loading" || status === "downloading"} onClick={() => void startDownload()} type="button">
          {status === "loading" || status === "downloading" ? <LoaderCircle aria-hidden className={styles.spin} size={20} /> : <Download aria-hidden size={20} />}
          {status === "loading" ? "正在读取正式版本" : status === "downloading" ? "正在准备安全下载" : "下载 Android 安装包"}
        </button>
        <p className={styles.downloadFeedback} aria-live="polite">{message || (release ? `当前版本 v${release.versionName}，安装需经 Android 系统确认。` : "正在连接版本服务…")}</p>
        {status === "error" ? <button className={styles.downloadRetry} onClick={() => void load()} type="button"><RefreshCw aria-hidden size={16} />重新加载版本</button> : null}
      </section>

      <aside className={styles.downloadQrPanel}>
        <Image alt="逐光 App 下载页面二维码" height={180} src="/images/app-download-qr.png" unoptimized width={180} />
        <strong>用手机扫码下载</strong>
        <span>beijingzhuguang.top/download</span>
      </aside>

      {release ? (
        <>
          <section className={styles.releaseDetails} aria-labelledby="release-title">
            <div className={styles.releaseHeading}><div><span>正式发布版本</span><h2 id="release-title">逐光 v{release.versionName}</h2></div><time dateTime={new Date(release.publishedAt).toISOString()}>{dateLabel(release.publishedAt)}</time></div>
            <dl>
              <div><dt>版本代码</dt><dd>{release.versionCode}</dd></div>
              <div><dt>安装包大小</dt><dd>{sizeLabel(release.sizeBytes)}</dd></div>
              <div><dt>系统要求</dt><dd>Android {release.minAndroid} 及以上</dd></div>
              <div><dt>应用包名</dt><dd>{release.packageId}</dd></div>
            </dl>
            <div className={styles.releaseNotes}><strong>本次更新</strong><ul>{release.notes.length ? release.notes.map((note) => <li key={note}>{note}</li>) : <li>稳定性与体验优化</li>}</ul></div>
          </section>

          <section className={styles.downloadSecurity} aria-labelledby="security-title">
            <div><ShieldCheck aria-hidden size={25} /><h2 id="security-title">安装包安全信息</h2><p>安装包来自逐光私有版本存储。下载链接五分钟内有效，文件完整性可通过 SHA-256 校验。</p></div>
            <div className={styles.hashRow}><span>SHA-256</span><code>{release.sha256}</code><button aria-label="复制 SHA-256" onClick={() => void copy(release.sha256, "sha")} type="button">{copied === "sha" ? <Check aria-hidden size={17} /> : <Clipboard aria-hidden size={17} />}</button></div>
            <div className={styles.hashRow}><span>签名指纹</span><code>{release.certificateSha256}</code></div>
          </section>
        </>
      ) : null}
    </div>
  );
}
