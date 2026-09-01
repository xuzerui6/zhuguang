import { ArrowRight, BadgeCheck, BriefcaseBusiness, CheckCircle2, ClipboardCheck, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import { ServiceLeadForm } from "../_components/service-lead-form";
import styles from "../_components/public-pages.module.css";

export const metadata: Metadata = {
  description: "了解逐光北京试点服务的教练合作方式、审核材料和工作台能力。",
  title: "教练合作 | 逐光",
};

export default function CoachPartnershipPage() {
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <section className={styles.partnerIntro}>
          <div><p>教练合作</p><h1>让专业经历成为<br />长期可信的服务</h1><span>逐光当前采用定向邀请和人工审核，不开放线上自助注册。</span></div>
          <div className={styles.partnerStatus}><BadgeCheck aria-hidden size={28} /><strong>北京试点服务</strong><p>首批合作优先面向退役运动员、专业队经历教练和具备可核验资质的专项教练。</p></div>
        </section>
        <section className={styles.partnerSteps}>
          <article><span>01</span><ClipboardCheck aria-hidden size={24} /><h2>资料核验</h2><p>身份证明、运动经历、教练资质、场馆与服务范围由运营团队人工确认。</p></article>
          <article><span>02</span><MessagesSquare aria-hidden size={24} /><h2>服务访谈</h2><p>确认教学方向、服务对象、时间安排、定价和未成年人保护要求。</p></article>
          <article><span>03</span><BriefcaseBusiness aria-hidden size={24} /><h2>开通工作台</h2><p>审核通过后绑定同一手机号账号，直接进入教练工作台，无需重复注册。</p></article>
        </section>
        <section className={styles.materialSection}>
          <div><p>合作材料</p><h2>提前准备，核验过程会更顺畅</h2></div>
          <ul>
            {["个人身份证明与常用手机号", "运动员等级、退役或专业队经历材料", "教练员证书及其他专项资质", "常用训练场馆与可服务时间", "擅长方向、服务对象与参考价格"].map((item) => <li key={item}><CheckCircle2 aria-hidden size={18} />{item}</li>)}
          </ul>
        </section>
        <section className={styles.partnerLeadSection} id="partnership-inquiry">
          <div><p>合作意向</p><h2>先提交真实经历，再进入人工核验</h2><span>逐光不开放自助注册。提交意向后，运营会核对项目、经历、服务区域和合作条件。</span></div>
          <ServiceLeadForm kind="coach" siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </section>
        <section className={styles.pageCta}>
          <BadgeCheck aria-hidden size={28} />
          <div><h2>已经通过逐光人工审核？</h2><p>使用审核时绑定的账号登录，即可进入独立教练工作台。</p></div>
          <Link href="/login?next=/coach-workspace">进入教练工作台 <ArrowRight aria-hidden size={17} /></Link>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
