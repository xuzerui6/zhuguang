"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
  Star,
} from "lucide-react";
import { MatchScore } from "../components";
import { formatYuan, getMatchResult } from "../domain";
import type { MatchPreferences, MobileCoach } from "../types";

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
  return (
    <div className="zg-view zg-detail-view">
      <div className="zg-detail-hero">
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
          {coach.profileKind === "demo" ? <span className="is-demo-coach"><ShieldCheck aria-hidden size={15} /><strong>演示资料</strong></span> : coach.isNew ? <span className="is-new-coach"><ShieldCheck aria-hidden size={15} /><strong>新教练</strong></span> : <span><Star aria-hidden fill="currentColor" size={15} /><strong>{coach.rating}</strong>（{coach.reviewCount}条评价）</span>}
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
        <div className="zg-review-empty"><strong>{coach.profileKind === "demo" ? "演示资料无评价" : coach.reviewCount > 0 ? `${coach.reviewCount} 条评价已通过审核` : "暂无学员评价"}</strong><p>{coach.profileKind === "demo" ? "演示记录不会生成评价或课量。" : coach.reviewCount > 0 ? "当前仅展示服务端已审核数量，评价正文同步完成后再公开。" : "完成平台课程后，真实评价会在这里展示。"}</p></div>
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
