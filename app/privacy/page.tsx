import { LockKeyhole, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { loadLegalDocuments } from "../_lib/legal-documents";
import { LegalDocumentBody } from "../_components/legal-document";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import { PrivacyRequestForm } from "../_components/privacy-request-form";
import styles from "../_components/public-pages.module.css";

export const metadata: Metadata = {
  description: "逐光运动教练服务平台隐私政策与未成年人信息保护说明。",
  title: "隐私政策 | 逐光",
};

export default async function PrivacyPage() {
  const document = (await loadLegalDocuments()).find(item => item.slug === "privacy")!;
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <section className={styles.pageIntro}>
          <p>隐私政策</p>
          <h1>只处理完成训练服务<br />真正需要的信息</h1>
          <span>版本：{document.version} · 更新日期：{new Date(document.updatedAt).toISOString().slice(0, 10)}</span>
        </section>
        <LegalDocumentBody document={document} />
        <section className={styles.guaranteeBand} id="privacy-request">
          <div><p>06 / 权利请求</p><h2>未登录也可以提交隐私问题</h2><ShieldCheck aria-hidden size={24} /></div>
          <div><p>用于查询、更正、删除或投诉个人信息处理问题。运营查看联系方式时会再次鉴权并写入审计记录。</p><PrivacyRequestForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} /></div>
        </section>
        <section className={styles.pageCta}><LockKeyhole aria-hidden size={28} /><div><h2>已有逐光账号？</h2><p>也可以登录后从账号设置提交隐私工单，并持续查看处理状态。</p></div><ShieldCheck aria-hidden size={24} /></section>
      </main>
      <PublicFooter />
    </>
  );
}
