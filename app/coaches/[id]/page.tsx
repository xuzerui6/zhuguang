import { ArrowLeft, BadgeCheck, CalendarDays, Clock3, MapPin, ShieldCheck, Star, Target, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";
import styles from "../../_components/public-pages.module.css";
import { loadPublicCoachById, loadPublicCoachSlots } from "../../_lib/web-platform";

export const metadata: Metadata = {
  description: "查看逐光试点教练的公开经历、服务区域、训练方向与真实可约状态。",
  title: "教练详情 | 逐光",
};

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coach, slots] = await Promise.all([loadPublicCoachById(id), loadPublicCoachSlots(id)]);
  if (!coach) notFound();
  const firstSlot = slots[0];
  const bookingTarget = `/student/bookings?coach=${coach.id}${firstSlot ? `&slot=${encodeURIComponent(firstSlot.id)}` : ""}`;
  const loginToBookHref = `/login?next=${encodeURIComponent(bookingTarget)}`;
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <div className={styles.breadcrumb}><Link href="/coaches"><ArrowLeft aria-hidden size={16} />返回教练列表</Link><span>{coach.profileKind === "demo" ? "平台演示资料" : "北京试点教练档案"}</span></div>
        <section className={styles.coachHero}>
          <div className={styles.coachPortrait}><Image alt={coach.profileKind === "demo" ? `${coach.sport}演示场景` : `${coach.name}教练`} fill priority sizes="360px" src={coach.media.cardUrl || coach.image} unoptimized /></div>
          <div className={styles.coachHeroCopy}>
            <div className={styles.verified}><BadgeCheck aria-hidden size={16} />{coach.verificationLabel}</div>
            <h1>{coach.name}</h1><p className={styles.coachTitle}>{coach.sport} · {coach.title}</p><p className={styles.coachBio}>{coach.bio}</p>{coach.motto ? <p className={styles.coachMotto}>“{coach.motto}”</p> : null}
            <div className={styles.coachQuickFacts}><span><Star aria-hidden size={17} /><strong>{coach.profileKind === "demo" ? "演示资料" : `${coach.experience}年执教`}</strong>{coach.profileKind === "demo" ? "不代表真实教练" : "暂无学员评价"}</span><span><MapPin aria-hidden size={17} /><strong>{coach.district}</strong>{coach.venue}</span><span><Clock3 aria-hidden size={17} /><strong>开放状态</strong>{coach.nextSlot}</span></div>
          </div>
          <aside className={styles.bookingSummary}><p>{coach.profileKind === "demo" ? "资料类型" : "服务价格"}</p><strong>{coach.profileKind === "demo" ? "演示" : coach.price === undefined ? "待发布" : <>¥{coach.price}<small>/次</small></>}</strong><span>{coach.trialPrice === undefined ? "暂未开放试课" : `试课 ¥${coach.trialPrice} · 线下支付`}</span><div className={styles.bookingActions}>{coach.bookable && firstSlot ? <Link href={loginToBookHref}>登录后预约</Link> : null}{coach.canConsult ? <Link href={`/?coach=${coach.id}#service-inquiry`}>咨询训练安排</Link> : null}</div><small>{coach.profileKind === "demo" ? "此档案仅用于验证筛选与运营流程，不提供咨询或预约。" : coach.bookable && firstSlot ? "选择真实开放时段，教练确认后预约生效。" : coach.unavailableReason || "真实场馆与时段发布后开放预约。"}</small></aside>
        </section>
        <div className={styles.coachDetailGrid}>
          <div>
            <section className={styles.detailSection}><header><ShieldCheck aria-hidden size={22} /><div><h2>资料核验状态</h2><p>{coach.profileKind === "demo" ? "演示资料始终与真实教练明确区分" : "运动经历、公开成绩与证书资料已经平台复核"}</p></div></header><div className={styles.credentialGrid}>{coach.profileKind === "demo" ? <div className={styles.credentialEmpty}><ShieldCheck aria-hidden size={20} /><div><strong>非真实教练档案</strong><p>不显示虚构资质、价格、评价、课量或排期，也不参与真实预约。</p></div></div> : coach.credentials.map((credential) => <article key={credential}><BadgeCheck aria-hidden size={18} /><strong>{credential}</strong><span>平台已核验</span></article>)}</div></section>
            <section className={styles.detailSection}><header><Target aria-hidden size={22} /><div><h2>训练方向</h2><p>适合的目标、竞赛经历与重点能力</p></div></header><div className={styles.tagGroups}>{coach.honors.length ? <div><strong>运动成绩</strong><p>{coach.honors.map((item) => <span key={item}>{item}</span>)}</p></div> : null}<div><strong>重点能力</strong><p>{coach.strengths.map((item) => <span key={item}>{item}</span>)}</p></div><div><strong>训练目标</strong><p>{coach.goals.map((item) => <span key={item}>{item}</span>)}</p></div><div><strong>服务对象</strong><p>{coach.audience.map((item) => <span key={item}>{item}</span>)}</p></div></div></section>
            <section className={styles.detailSection}><header><UsersRound aria-hidden size={22} /><div><h2>服务方式</h2><p>从首次沟通到课程复盘</p></div></header><ol className={styles.serviceTimeline}><li><span>01</span><div><strong>课前了解</strong><p>确认训练经历、健康情况与本次目标。</p></div></li><li><span>02</span><div><strong>现场评估</strong><p>观察动作基础，确定当次训练重点。</p></div></li><li><span>03</span><div><strong>训练复盘</strong><p>课程结束后记录重点与下一阶段建议。</p></div></li></ol></section>
          </div>
          <aside className={styles.availabilityPanel}><header><CalendarDays aria-hidden size={20} /><div><h2>本周可约时间</h2><p>北京时间 · 只展示真实开放时段</p></div></header><div>{slots.length ? slots.slice(0, 5).map((slot) => <section key={slot.id}><strong>{slot.dateLabel}</strong><div><b>{slot.date} {slot.time}–{slot.endTime}</b><p><span>{slot.venueName || "训练场馆"}</span></p><small>{slot.venueAddress || slot.venueDistrict || "场馆地址待确认"}</small></div></section>) : <div className={styles.availabilityEmpty}><Clock3 aria-hidden size={22} /><strong>{coach.profileKind === "demo" ? "演示资料不可预约" : coach.unavailableReason || "可约时段待发布"}</strong><p>{coach.profileKind === "demo" ? "请选择标记为真实教练的档案继续咨询。" : "可以先咨询训练方向，真实场馆和时段上线后再提交预约。"}</p></div>}</div>{coach.bookable && firstSlot ? <Link href={loginToBookHref}>登录后预约这个时段</Link> : coach.canConsult ? <Link href={`/?coach=${coach.id}#service-inquiry`}>咨询训练安排</Link> : null}</aside>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
