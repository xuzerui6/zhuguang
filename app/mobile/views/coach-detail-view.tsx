"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
  Star,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MatchScore } from "../components";
import { formatYuan, getMatchResult } from "../domain";
import type { MatchPreferences, MobileCoach } from "../types";
import type { PublicCoachReviews } from "../../../shared/reviews";
import { mobileApi } from "../api-client";

export function CoachDetailView({
  coach,
  isSaved,
  onBack,
  onBook,
  onMessage,
  onToggleSaved,
  preferences,
}: {
  coach: MobileCoach;
  isSaved: boolean;
  onBack: () => void;
  onBook: () => void;
  onMessage: () => void;
  onToggleSaved: () => void;
  preferences: MatchPreferences;
}) {
  const match = getMatchResult(coach, preferences);
  const [reviews, setReviews] = useState<PublicCoachReviews | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [reviewBusy, setReviewBusy] = useState("");
  useEffect(() => {
    let active = true;
    setReviews(null); setReviewError("");
    void mobileApi.coachReviews(coach.id).then((data) => { if (active) setReviews(data); }).catch((error) => { if (active) setReviewError(error instanceof Error ? error.message : "评价加载失败"); });
    return () => { active = false; };
  }, [coach.id]);
  async function markHelpful(reviewId: string) {
    setReviewBusy(reviewId);
    try { await mobileApi.markReviewHelpful(reviewId); setReviews((current) => current ? { ...current, items: current.items.map((item) => item.id === reviewId ? { ...item, helpfulCount: item.helpfulCount + 1 } : item) } : current); }
    catch (error) { setReviewError(error instanceof Error ? error.message : "操作失败，请登录后重试"); }
    finally { setReviewBusy(""); }
  }
  async function reportReview(reviewId: string) {
    const reason = window.prompt("请简要说明举报原因（至少4个字）");
    if (!reason?.trim()) return;
    setReviewBusy(`${reviewId}-report`);
    try { await mobileApi.reportReview(reviewId, reason.trim()); setReviewNotice("举报已提交，运营会核查处理"); }
    catch (error) { setReviewError(error instanceof Error ? error.message : "举报提交失败"); }
    finally { setReviewBusy(""); }
  }
  return (
    <div className="zg-view zg-detail-view">
      <div className={`zg-detail-hero is-coach-${coach.id}`}>
        {coach.heroUrl ? (
          <Image alt={`${coach.name}教练`} fill priority sizes="(max-width: 760px) 100vw, 430px" src={coach.heroUrl} unoptimized />
        ) : (
          <div className={`zg-detail-portrait is-coach-${coach.id}`} role="img" aria-label={`${coach.name}教练`} />
        )}
        <div className="zg-detail-hero-actions">
          <button aria-label="返回" onClick={onBack} type="button"><ArrowLeft aria-hidden size={22} /></button>
          <span />
          <button aria-label="分享教练" onClick={() => navigator.share?.({ title: `${coach.name}教练`, text: coach.title })} type="button"><Share2 aria-hidden size={20} /></button>
          <button aria-label={isSaved ? "取消收藏" : "收藏教练"} onClick={onToggleSaved} type="button"><Bookmark aria-hidden fill={isSaved ? "currentColor" : "none"} size={20} /></button>
        </div>
      </div>

      <section className="zg-detail-summary">
        <div className="zg-detail-name">
          <div><h1>{coach.name}</h1><p>{coach.sport} · {coach.level}</p></div>
          <MatchScore score={match.score} />
        </div>
        <div className="zg-detail-meta">
          {coach.profileKind === "demo" ? <span className="is-demo-coach"><ShieldCheck aria-hidden size={15} /><strong>演示资料</strong></span> : coach.reviewCount < 3 ? <span className="is-new-coach"><ShieldCheck aria-hidden size={15} /><strong>{coach.reviewCount ? `${coach.reviewCount}条履约评价` : "新教练"}</strong></span> : <span><Star aria-hidden fill="currentColor" size={15} /><strong>{coach.rating}</strong>（{coach.reviewCount}条评价）</span>}
          <span><MapPin aria-hidden size={15} />{coach.distanceKm ? `${coach.distanceKm.toFixed(1)}km` : coach.district}</span>
          {coach.responseMinutes ? <span><Clock3 aria-hidden size={15} />平均 {coach.responseMinutes} 分钟回复</span> : null}
        </div>
        <div className="zg-credential-grid">
          <div><ShieldCheck aria-hidden size={25} /><span><strong>{coach.verificationLabel ?? `${coach.level}认证`}</strong><small>{coach.profileKind === "demo" ? "不代表真实教练" : coach.isNew ? "不展示未经核验的资质" : "身份与履历已核验"}</small></span></div>
          <div><ShieldCheck aria-hidden size={25} /><span><strong>服务保障</strong><small>资质 · 安全 · 申诉</small></span></div>
        </div>
      </section>

      <section className="zg-detail-section">
        <h2>推荐理由</h2>
        <ul className="zg-reason-list">
          {match.reasons.map((reason) => <li key={reason}><CheckCircle2 aria-hidden size={17} />{reason}</li>)}
          <li><CheckCircle2 aria-hidden size={17} />{coach.note}</li>
        </ul>
      </section>

      <section className="zg-detail-section">
        <h2>擅长领域</h2>
        <div className="zg-skill-list">{coach.strengths.map((item) => <span key={item}>{item}</span>)}</div>
      </section>

      <section className="zg-detail-section zg-review-section">
        <header><h2>学员评价（{coach.reviewCount}）</h2></header>
        {reviewNotice ? <p className="zg-review-notice" role="status">{reviewNotice}</p> : null}
        {coach.profileKind === "demo" ? <div className="zg-review-empty"><strong>演示资料无评价</strong><p>演示记录不会生成评价或课量。</p></div> : reviews === null && !reviewError ? <div className="zg-review-skeleton" aria-label="正在读取真实评价"><span /><span /><span /></div> : reviews?.items.length ? <><div className="zg-mobile-review-summary"><strong>{reviews.summary.averageRating === null ? reviews.summary.total : reviews.summary.averageRating.toFixed(1)}</strong><span>{reviews.summary.averageRating === null ? "条履约评价" : `综合评分 · ${reviews.summary.total}条`}</span><small>{reviews.summary.total < 3 ? "样本不足3条，暂不展示均分" : "只统计已审核真实课程"}</small></div><div className="zg-mobile-review-list">{reviews.items.map((review) => <article key={review.id}><header><strong><Star aria-hidden fill="currentColor" size={14} />{review.rating}.0</strong><span>{review.reviewerLabel}</span><small>{review.completedMonth}</small></header><p>{review.body}</p><div>{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{review.coachReply ? <blockquote><strong>教练回复</strong><p>{review.coachReply.body}</p></blockquote> : null}<footer><button disabled={reviewBusy === review.id} onClick={() => void markHelpful(review.id)} type="button"><ThumbsUp aria-hidden size={14} />有帮助{review.helpfulCount ? ` ${review.helpfulCount}` : ""}</button><button aria-label="举报评价" disabled={reviewBusy === `${review.id}-report`} onClick={() => void reportReview(review.id)} type="button"><Flag aria-hidden size={14} />举报</button></footer></article>)}</div></> : <div className="zg-review-empty"><strong>{reviewError ? "评价暂时未加载成功" : "暂无学员评价"}</strong><p>{reviewError || "完成平台课程后，真实评价会在这里展示。"}</p>{reviewError ? <button onClick={() => { setReviewError(""); setReviews(null); void mobileApi.coachReviews(coach.id).then(setReviews).catch((error) => setReviewError(error instanceof Error ? error.message : "评价加载失败")); }} type="button">重新加载</button> : null}</div>}
      </section>

      <section className="zg-detail-section">
        <header><h2>预约方式</h2>{coach.bookable ? <button onClick={onBook} type="button">选择时间<ChevronRight aria-hidden size={16} /></button> : null}</header>
        {coach.bookable && coach.profileKind !== "demo" ? <div className="zg-slot-empty"><Clock3 aria-hidden size={18} /><span><strong>学员自主指定时间</strong><small>选择未来2小时至60天内的北京时间、训练时长与地点，教练确认后生效。</small></span></div> : <div className="zg-slot-empty"><Clock3 aria-hidden size={18} /><span><strong>{coach.profileKind === "demo" ? "演示资料不可预约" : "当前未上线接单"}</strong><small>{coach.profileKind === "demo" ? "请选择真实教练继续咨询。" : coach.unavailableReason || "可先收藏或咨询教练。"}</small></span></div>}
      </section>

      <div className="zg-detail-bottom-space" />
      <footer className="zg-detail-action">
        <button aria-label="发送消息" className="zg-secondary-icon-action" disabled={coach.canConsult === false || coach.profileKind === "demo"} onClick={onMessage} type="button"><MessageCircle aria-hidden size={21} /><small>{coach.profileKind === "demo" ? "不可咨询" : "咨询"}</small></button>
        <button className="zg-primary-action" disabled={coach.bookable === false || coach.trialPrice === undefined || coach.profileKind === "demo"} onClick={onBook} type="button">{coach.profileKind === "demo" ? "演示资料" : coach.bookable === false || coach.trialPrice === undefined ? "当前未接单" : <>选择时间预约 <span>{formatYuan(coach.trialPrice * 100)}起</span></>}</button>
      </footer>
    </div>
  );
}
