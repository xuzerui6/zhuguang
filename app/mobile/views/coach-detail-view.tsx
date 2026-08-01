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
        {coach.id === 1 ? (
          <Image alt={`${coach.name}指导羽毛球训练`} fill priority sizes="(max-width: 760px) 100vw, 430px" src="/mobile-coach-hero-v23.webp" unoptimized />
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
          <span><Star aria-hidden fill="currentColor" size={15} /><strong>{coach.rating}</strong>（{coach.reviewCount}条评价）</span>
          <span><MapPin aria-hidden size={15} />{coach.distanceKm ?? 3.2}km</span>
          <span><Clock3 aria-hidden size={15} />平均 {coach.responseMinutes ?? 12} 分钟回复</span>
        </div>
        <div className="zg-credential-grid">
          <div><ShieldCheck aria-hidden size={25} /><span><strong>{coach.level}认证</strong><small>身份与履历已核验</small></span></div>
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
        <header><h2>学员评价（{coach.reviewCount}）</h2><button type="button">查看全部<ChevronRight aria-hidden size={16} /></button></header>
        <article>
          <span className="zg-review-avatar">宇</span>
          <div><strong>小宇妈妈 <b>★★★★★ 5.0</b></strong><small>已完成平台课程 · 近期</small><p>孩子跟着教练训练半年，技术和比赛心态都有很大进步。讲解有耐心，课后复盘也很具体。</p></div>
        </article>
      </section>

      <section className="zg-detail-section">
        <header><h2>近期可约</h2><button type="button">更多日期<ChevronRight aria-hidden size={16} /></button></header>
        <div className="zg-slot-preview">
          {coach.availability.slice(0, 3).map((slot) => <span key={slot}>{slot}</span>)}
        </div>
      </section>

      <div className="zg-detail-bottom-space" />
      <footer className="zg-detail-action">
        <button aria-label="发送消息" className="zg-secondary-icon-action" onClick={onMessage} type="button"><MessageCircle aria-hidden size={21} /><small>咨询</small></button>
        <button className="zg-primary-action" onClick={onBook} type="button">申请试课 <span>{formatYuan(9900)}</span></button>
      </footer>
    </div>
  );
}
