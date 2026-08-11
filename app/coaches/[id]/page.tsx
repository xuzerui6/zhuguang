import { ArrowLeft, BadgeCheck, CalendarDays, Clock3, MapPin, ShieldCheck, Star, Target, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";
import styles from "../../_components/public-pages.module.css";
import { getCoachById } from "../../_lib/web-platform";

export const metadata: Metadata = {
  description: "查看逐光试点教练的公开经历、服务区域、训练方向与真实可约状态。",
  title: "教练详情 | 逐光",
};

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = getCoachById(id);
  if (!coach) notFound();
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <div className={styles.breadcrumb}><Link href="/coaches"><ArrowLeft aria-hidden size={16} />返回教练列表</Link><span>北京试点教练档案</span></div>
        <section className={styles.coachHero}>
          <div className={styles.coachPortrait}><Image alt={`${coach.name}教练`} fill priority sizes="360px" src={coach.image} unoptimized /></div>
          <div className={styles.coachHeroCopy}>
            <div className={styles.verified}><BadgeCheck aria-hidden size={16} />{coach.verificationLabel}</div>
            <h1>{coach.name}</h1><p className={styles.coachTitle}>{coach.sport} · {coach.title}</p><p className={styles.coachBio}>{coach.bio}</p>
            <div className={styles.coachQuickFacts}><span><Star aria-hidden size={17} /><strong>新教练</strong>暂无学员评价</span><span><MapPin aria-hidden size={17} /><strong>{coach.district}</strong>{coach.venue}</span><span><Clock3 aria-hidden size={17} /><strong>开放状态</strong>{coach.nextSlot}</span></div>
          </div>
          <aside className={styles.bookingSummary}><p>常规课</p><strong>¥{coach.price}<small>/次</small></strong><span>试课 ¥{coach.trialPrice} · 线下支付</span><Link href="/#service-inquiry">咨询训练安排</Link><small>真实场馆与时段发布后开放预约；不会用虚假排期代替。</small></aside>
        </section>
        <div className={styles.coachDetailGrid}>
          <div>
            <section className={styles.detailSection}><header><ShieldCheck aria-hidden size={22} /><div><h2>资料核验状态</h2><p>平台仅展示已经提供并确认过的公开信息</p></div></header><div className={styles.credentialGrid}><div className={styles.credentialEmpty}><ShieldCheck aria-hidden size={20} /><div><strong>暂未公开专项证书</strong><p>不以运动经历替代资质证明，不展示未经提供或核验的成绩、证书和执教年限。</p></div></div></div></section>
            <section className={styles.detailSection}><header><Target aria-hidden size={22} /><div><h2>训练方向</h2><p>适合的目标与重点能力</p></div></header><div className={styles.tagGroups}><div><strong>重点能力</strong><p>{coach.strengths.map((item) => <span key={item}>{item}</span>)}</p></div><div><strong>训练目标</strong><p>{coach.goals.map((item) => <span key={item}>{item}</span>)}</p></div><div><strong>服务对象</strong><p>{coach.audience.map((item) => <span key={item}>{item}</span>)}</p></div></div></section>
            <section className={styles.detailSection}><header><UsersRound aria-hidden size={22} /><div><h2>服务方式</h2><p>从首次沟通到课程复盘</p></div></header><ol className={styles.serviceTimeline}><li><span>01</span><div><strong>课前了解</strong><p>确认训练经历、健康情况与本次目标。</p></div></li><li><span>02</span><div><strong>现场评估</strong><p>观察动作基础，确定当次训练重点。</p></div></li><li><span>03</span><div><strong>训练复盘</strong><p>课程结束后记录重点与下一阶段建议。</p></div></li></ol></section>
          </div>
          <aside className={styles.availabilityPanel}><header><CalendarDays aria-hidden size={20} /><div><h2>本周可约时间</h2><p>北京时间 · 只展示运营已发布时段</p></div></header><div><div className={styles.availabilityEmpty}><Clock3 aria-hidden size={22} /><strong>可约时段待发布</strong><p>可以先咨询训练方向，真实场馆和时段上线后再提交预约。</p></div></div><Link href="/#service-inquiry">咨询训练安排</Link></aside>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
