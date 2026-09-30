import { ArrowLeft, BadgeCheck, CalendarDays, Clock3, MapPin, ShieldCheck, Star, Target, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";
import styles from "../../_components/public-pages.module.css";
import { loadPublicCoachById, loadPublicCoachReviews } from "../../_lib/web-platform";
import { cityName, resolveServiceCity } from "../../../shared/service-cities";

export const metadata: Metadata = {
  description: "查看逐光试点教练的公开经历、服务区域、训练方向与真实可约状态。",
  title: "教练详情 | 逐光",
};

export default async function CoachDetailPage({ params,searchParams }: { params: Promise<{ id: string }>; searchParams?:Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params;
  const [coach, reviews] = await Promise.all([loadPublicCoachById(id), loadPublicCoachReviews(id)]);
  if (!coach) notFound();
  const query=await searchParams;
  const cityId=resolveServiceCity(typeof query?.city==="string"?query.city:undefined);
  const servesCity=coach.city===cityName(cityId)||coach.serviceAreas?.some(area=>area.cityId===cityId);
  if (!servesCity) notFound();
  const serviceDistricts = coach.serviceAreas?.filter(area => area.cityId === cityId).map(area => area.district).join("、") || coach.district;
  const bookingTarget = `/student/bookings?coach=${coach.id}&city=${cityId}`;
  const loginToBookHref = `/login?next=${encodeURIComponent(bookingTarget)}`;
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <div className={styles.breadcrumb}><Link href={`/coaches?city=${cityId}`}><ArrowLeft aria-hidden size={16} />返回教练列表</Link><span>{coach.profileKind === "demo" ? "平台演示资料" : `${cityName(cityId)}教练档案`}</span></div>
        <section className={styles.coachHero}>
          <div className={styles.coachPortrait}><Image alt={coach.profileKind === "demo" ? `${coach.sport}演示场景` : `${coach.name}教练`} fill priority sizes="360px" src={coach.media.cardUrl || coach.image} unoptimized /></div>
          <div className={styles.coachHeroCopy}>
            <div className={styles.verified}><BadgeCheck aria-hidden size={16} />{coach.verificationLabel}</div>
            <h1>{coach.name}</h1><p className={styles.coachTitle}>{coach.sport} · {coach.title}</p><p className={styles.coachBio}>{coach.bio}</p>{coach.motto ? <p className={styles.coachMotto}>“{coach.motto}”</p> : null}
            <div className={styles.coachQuickFacts}><span><Star aria-hidden size={17} /><strong>{coach.profileKind === "demo" ? "演示资料" : reviews.summary.averageRating === null ? `${reviews.summary.total}条真实评价` : `${reviews.summary.averageRating.toFixed(1)}分`}</strong>{coach.profileKind === "demo" ? "不代表真实教练" : reviews.summary.total < 3 ? "样本不足暂不显示均分" : `${reviews.summary.total}条平台履约评价`}</span><span><MapPin aria-hidden size={17} /><strong>{cityName(cityId)}</strong>{serviceDistricts}</span><span><Clock3 aria-hidden size={17} /><strong>预约方式</strong>学员指定时间</span></div>
          </div>
          <aside className={styles.bookingSummary}><p>{coach.profileKind === "demo" ? "资料类型" : "60分钟基准价"}</p><strong>{coach.profileKind === "demo" ? "演示" : coach.price === undefined ? "待发布" : <>¥{coach.price}<small>/60分钟</small></>}</strong><span>{coach.trialPrice === undefined ? "暂未开放试课" : `首次试课 ¥${coach.trialPrice}/60分钟 · 90/120分钟按比例计价`}</span><div className={styles.bookingActions}>{coach.bookable ? <Link href={loginToBookHref}>登录后选择时间</Link> : null}{coach.canConsult ? <Link href={`/?coach=${coach.id}&city=${cityId}#service-inquiry`}>咨询训练安排</Link> : null}</div><small>{coach.profileKind === "demo" ? "此档案仅用于验证筛选与运营流程，不提供咨询或预约。" : coach.bookable ? "学员提出时间和地点，教练确认后预约生效。" : coach.unavailableReason || "教练当前未上线接单。"}</small></aside>
        </section>
        <div className={styles.coachDetailGrid}>
          <div>
            <section className={styles.detailSection}><header><ShieldCheck aria-hidden size={22} /><div><h2>资料核验状态</h2><p>{coach.profileKind === "demo" ? "演示资料始终与真实教练明确区分" : "运动经历、公开成绩与证书资料已经平台复核"}</p></div></header><div className={styles.credentialGrid}>{coach.profileKind === "demo" ? <div className={styles.credentialEmpty}><ShieldCheck aria-hidden size={20} /><div><strong>非真实教练档案</strong><p>不显示虚构资质、价格、评价、课量或排期，也不参与真实预约。</p></div></div> : coach.credentials.map((credential) => <article key={credential}><BadgeCheck aria-hidden size={18} /><strong>{credential}</strong><span>平台已核验</span></article>)}</div></section>
            <section className={styles.detailSection}><header><Target aria-hidden size={22} /><div><h2>训练方向</h2><p>适合的目标、竞赛经历与重点能力</p></div></header><div className={styles.tagGroups}>{coach.honors.length ? <div><strong>运动成绩</strong><p>{coach.honors.map((item) => <span key={item}>{item}</span>)}</p></div> : null}<div><strong>重点能力</strong><p>{coach.strengths.map((item) => <span key={item}>{item}</span>)}</p></div><div><strong>训练目标</strong><p>{coach.goals.map((item) => <span key={item}>{item}</span>)}</p></div><div><strong>服务对象</strong><p>{coach.audience.map((item) => <span key={item}>{item}</span>)}</p></div></div></section>
            <section className={styles.detailSection}><header><UsersRound aria-hidden size={22} /><div><h2>服务方式</h2><p>从首次沟通到课程复盘</p></div></header><ol className={styles.serviceTimeline}><li><span>01</span><div><strong>课前了解</strong><p>确认训练经历、健康情况与本次目标。</p></div></li><li><span>02</span><div><strong>现场评估</strong><p>观察动作基础，确定当次训练重点。</p></div></li><li><span>03</span><div><strong>训练复盘</strong><p>课程结束后记录重点与下一阶段建议。</p></div></li></ol></section>
            {coach.profileKind !== "demo" ? <section className={`${styles.detailSection} ${styles.reviewSection}`}><header><Star aria-hidden size={22} /><div><h2>真实学员评价</h2><p>仅展示完成平台课程并通过审核的匿名评价</p></div></header>{reviews.summary.total ? <><div className={styles.reviewSummary}><div><strong>{reviews.summary.averageRating === null ? reviews.summary.total : reviews.summary.averageRating.toFixed(1)}</strong><span>{reviews.summary.averageRating === null ? "条履约评价" : `综合评分 · ${reviews.summary.total}条`}</span><small>{reviews.summary.total < 3 ? "样本不足3条，暂不展示平均分" : "评分来自已审核真实课程"}</small></div><p>{reviews.summary.tagCounts.map((item) => <span key={item.tag}>{item.tag}<b>{item.count}</b></span>)}</p></div><div className={styles.reviewList}>{reviews.items.map((review) => <article key={review.id}><header><span><Star aria-hidden fill="currentColor" size={15} />{review.rating}.0</span><strong>{review.reviewerLabel}</strong><small>{review.sport} · {review.durationMinutes}分钟 · {review.completedMonth}</small></header><p>{review.body}</p>{review.tags.length ? <div>{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}{review.coachReply ? <blockquote><strong>教练回复</strong><p>{review.coachReply.body}</p></blockquote> : null}<footer>{review.helpfulCount ? `${review.helpfulCount}人认为有帮助` : "平台履约已验证"}</footer></article>)}</div></> : <div className={styles.reviewEmpty}><Star aria-hidden size={24} /><strong>暂无公开评价</strong><p>完成真实课程后，学员评价经审核会展示在这里。</p></div>}</section> : null}
          </div>
          <aside className={styles.availabilityPanel}><header><CalendarDays aria-hidden size={20} /><div><h2>预约时间申请</h2><p>北京时间 · 提前2小时至未来60天</p></div></header><div><section><strong>01</strong><div><b>学员选择时间</b><p><span>60 / 90 / 120 分钟</span></p><small>可选审核场馆或填写期望地点</small></div></section><section><strong>02</strong><div><b>教练确认安排</b><p><span>确认、拒绝或提出新方案</span></p><small>确认时检查已生效课程冲突</small></div></section><section><strong>03</strong><div><b>线下完成训练</b><p><span>价格在提交时生成快照</span></p><small>教练不能在反提案中修改价格</small></div></section></div>{coach.bookable ? <Link href={loginToBookHref}>选择时间预约</Link> : coach.canConsult ? <Link href={`/?coach=${coach.id}&city=${cityId}#service-inquiry`}>咨询训练安排</Link> : null}</aside>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
