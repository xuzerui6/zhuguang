import { FileCheck2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { loadLegalDocuments } from "../_lib/legal-documents";
import { LegalDocumentBody } from "../_components/legal-document";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import styles from "../_components/public-pages.module.css";

export const metadata: Metadata = {
  description: "逐光运动教练服务平台用户服务协议。",
  title: "用户服务协议 | 逐光",
};

export default async function TermsPage() {
  const document = (await loadLegalDocuments()).find(item => item.slug === "terms")!;
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <section className={styles.pageIntro}>
          <p>用户服务协议</p>
          <h1>预约之前，先把平台与<br />训练服务边界说清楚</h1>
          <span>版本：{document.version} · 更新日期：{new Date(document.updatedAt).toISOString().slice(0, 10)}</span>
        </section>
        <LegalDocumentBody document={document} />
        <section className={styles.pageCta}><FileCheck2 aria-hidden size={28} /><div><h2>记录清楚，协作才更可靠</h2><p>预约、改期和售后处理均以平台状态与双方确认记录为依据。</p></div><ShieldCheck aria-hidden size={24} /></section>
      </main>
      <PublicFooter />
    </>
  );
}
