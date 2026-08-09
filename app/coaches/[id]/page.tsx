import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  Target,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";
import styles from "../../_components/public-pages.module.css";
import { getCoachById } from "../../_lib/web-platform";

export const metadata: Metadata = {
  description: "查看逐光试点教练的经历、资质、场馆、专长与可约时间。",
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
        <div className={styles.breadcrumb}><Link href="/coaches"><ArrowLeft aria-hidden size={16} />返回教练列表</Link><span>北京私有试点展示档案</span></div>
        <section className={styles.coachHero}>
          <div className={styles.coachPortrait}><Image alt={`${coach.name}教练`} fill priority sizes="360px" src={coach.image} unoptimized /></div>
          <div className={styles.coachHeroCopy}>
            <div className={styles.verified}><BadgeCheck aria-hidden size={16} />资料已核验</div>
            <h1>{coach.name}</h1>
            <p className={styles.coachTitle}>{coach.sport} · {coach.title}</p>
            <p className={styles.coachBio}>{coach.bio}</p>
            <div className={styles.coachQuickFacts}>
              <span><Star aria-hidden fill="currentColor" size={17} /><strong>{coach.rating}</strong>{coach.reviewCount}条评价</span>
              <span><MapPin aria-hidden size={17} /><strong>{coach.district}</strong>{coach.venue}</span>
              <span><Clock3 aria-hidden size={17} /><strong>最近可约</strong>{coach.nextSlot}</span>
            </div>
          </div>
          <aside className={styles.bookingSummary}>
            <p>标准课时</p>
            <strong>¥{coach.price}<small>/次</small></strong>
            <span>试课 ¥{coach.trialPrice} · 线下支付</span>
            <Link href={`/login?next=${encodeURIComponent(`/student/bookings?coach=${coach.id}`)}`}>预约试课</Link>
            <small>提交后由教练确认，确认后预约生效</small>
          </aside>
        </section>

        <div className={styles.coachDetailGrid}>
          <div>
            <section className={styles.detailSection}>
              <header><ShieldCheck aria-hidden size={22} /><div><h2>认证与资质</h2><p>平台人工查看原始资料后展示核验结果</p></div></header>
              <div className={styles.credentialGrid}>
                {coach.credentials.map((item) => <article key={item}><CheckCircle2 aria-hidden size={19} /><strong>{item}</strong><span>已核验</span></article>)}
              </div>
            </section>
            <section className={styles.detailSection}>
              <header><Target aria-hidden size={22} /><div><h2>训练专长</h2><p>适合的目标和重点训练方向</p></div></header>
              <div className={styles.tagGroups}>
                <div><strong>重点能力</strong><p>{coach.strengths.map((item) => <span key={item}>{item}</span>)}</p></div>
                <div><strong>训练目标</strong><p>{coach.goals.map((item) => <span key={item}>{item}</span>)}</p></div>
                <div><strong>服务对象</strong><p>{coach.audience.map((item) => <span key={item}>{item}</span>)}</p></div>
              </div>
            </section>
            <section className={styles.detailSection}>
              <header><UsersRound aria-hidden size={22} /><div><h2>服务方式</h2><p>课前沟通、现场训练与课后记录</p></div></header>
              <ol className={styles.serviceTimeline}>
                <li><span>01</span><div><strong>课前了解</strong><p>确认训练经历、健康情况与本次目标。</p></div></li>
                <li><span>02</span><div><strong>现场评估</strong><p>观察动作基础，确定当次训练重点。</p></div></li>
                <li><span>03</span><div><strong>训练复盘</strong><p>课程结束后记录重点与下一阶段建议。</p></div></li>
              </ol>
            </section>
          </div>
          <aside className={styles.availabilityPanel}>
            <header><CalendarDays aria-hidden size={20} /><div><h2>本周可约时间</h2><p>以下时间仅供选择，以提交时实时状态为准</p></div></header>
            <div>
              {coach.availability.map((item) => <section key={item.day}><strong>{item.day}</strong><p>{item.periods.map((period) => <span key={period}>{period}</span>)}</p></section>)}
            </div>
            <Link href={`/login?next=${encodeURIComponent(`/student/bookings?coach=${coach.id}`)}`}>选择时间并预约</Link>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
