import type { Metadata } from "next";
import { AppDownloadClient } from "../_components/app-download-client";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import styles from "../_components/public-site.module.css";

export const metadata: Metadata = {
  description: "下载逐光 Android App，在同一个应用中查找教练、管理预约与训练记录。",
  title: "下载 Android App | 逐光",
};

export default function DownloadPage() {
  return (
    <>
      <PublicHeader />
      <main className={styles.downloadPage}>
        <AppDownloadClient />
        <section className={styles.installSteps} aria-labelledby="install-title">
          <div><p className="zg-eyebrow">安装说明</p><h2 id="install-title">三步完成安装</h2></div>
          <ol>
            <li><span>01</span><div><strong>下载安装包</strong><p>点击下载后，Android 浏览器会显示下载进度。</p></div></li>
            <li><span>02</span><div><strong>确认安装来源</strong><p>首次侧载时，系统可能要求允许当前浏览器安装应用。</p></div></li>
            <li><span>03</span><div><strong>由系统确认安装</strong><p>核对“逐光”和版本信息后，在 Android 系统安装页确认。</p></div></li>
          </ol>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
