"use client";

import Image from "next/image";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import { CoachCard, MatchScore, SearchBar } from "../components";
import { getMatchResult } from "../domain";
import type { MatchPreferences, MobileBooking, MobileCoach } from "../types";
import type { ServiceCatalog } from '../../../shared/service-catalog';

export function HomeView({
  activeBooking,
  catalog,
  coaches,
  onDiscover,
  onOpenBooking,
  onOpenCoach,
  onOpenReview,
  onSearch,
  onSelectSport,
  onToggleSaved,
  preferences,
  query,
  reviewTodo,
  savedCoachIds,
}: {
  activeBooking: MobileBooking | null;
  catalog: ServiceCatalog;
  coaches: MobileCoach[];
  onDiscover: () => void;
  onOpenBooking: () => void;
  onOpenCoach: (coach: MobileCoach) => void;
  onOpenReview: () => void;
  onSearch: (value: string) => void;
  onSelectSport: (sport: string) => void;
  onToggleSaved: (coachId: number) => void;
  preferences: MatchPreferences;
  query: string;
  reviewTodo: MobileBooking | null;
  savedCoachIds: number[];
}) {
  const recommended = coaches
    .map((coach) => ({ coach, match: getMatchResult(coach, preferences) }))
    .filter(({ match }) => match.eligible)
    .sort((left, right) => right.match.score - left.match.score)
    .slice(0, 3);
  const featured = recommended[0]?.coach;
  const featuredMatch = recommended[0]?.match;

  return (
    <div className="zg-view zg-home-view">
      <section className="zg-home-intro">
        <h1>今天想练什么？</h1>
        <SearchBar onChange={onSearch} value={query} />
      </section>

      <nav aria-label="运动项目" className="zg-sport-tabs">
        {catalog.sports.map(({name: label}) => ({label,symbol:label.slice(-1)})).map((item) => (
          <button
            aria-current={preferences.sport === item.label ? "true" : undefined}
            className={preferences.sport === item.label ? "is-active" : ""}
            key={item.label}
            onClick={() => onSelectSport(item.label)}
            type="button"
          >
            <span>{item.symbol}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>

      {activeBooking ? (
        <button className="zg-active-booking-strip" onClick={onOpenBooking} type="button">
          <span><strong>最近预约</strong><small>{activeBooking.dateLabel} {activeBooking.time} · 等待服务进度</small></span>
          <ArrowRight aria-hidden size={19} />
        </button>
      ) : null}
      {reviewTodo ? <button className="zg-review-todo-strip" onClick={onOpenReview} type="button"><span><strong>{reviewTodo.review.canResubmit ? "评价需要修改" : "课程待评价"}</strong><small>{reviewTodo.review.rejectionReason || "分享真实体验，审核后匿名展示"}</small></span><ArrowRight aria-hidden size={19} /></button> : null}

      {featured && featuredMatch ? <button className="zg-featured-coach" onClick={() => onOpenCoach(featured)} type="button">
        <Image alt={`${featured.name}教练`} fill priority sizes="(max-width: 760px) 100vw, 430px" src={featured.heroUrl ?? "/mobile-coach-hero-v23.webp"} unoptimized />
        <span className="zg-featured-gradient" />
        <span className="zg-featured-copy">
          <strong>{featured.name}</strong>
          <small>{featured.sport} · {featured.level}</small>
          <em><ShieldCheck aria-hidden size={14} />{featured.verificationLabel ?? "履历已核验"}</em>
        </span>
        <MatchScore score={featuredMatch.score} />
      </button> : <section className="zg-service-note" role="status"><div><strong>暂无匹配的已上线教练</strong><p>可以调整训练需求，或稍后查看当前项目。</p></div></section>}

      <section className="zg-section">
        <header className="zg-section-header">
          <div><h2>为你推荐</h2><p>基于目标、位置、时间与预算计算</p></div>
          <button onClick={onDiscover} type="button">查看全部<ArrowRight aria-hidden size={16} /></button>
        </header>
        <div className="zg-coach-list">
          {recommended.map(({ coach }) => (
            <CoachCard
              coach={coach}
              isSaved={savedCoachIds.includes(coach.id)}
              key={coach.id}
              onOpen={() => onOpenCoach(coach)}
              onSave={() => onToggleSaved(coach.id)}
              preferences={preferences}
            />
          ))}
        </div>
      </section>

      <section className="zg-service-note">
        <MapPin aria-hidden size={20} />
        <div><strong>{catalog.city}教练服务</strong><p>{catalog.regions.length ? `当前服务区域：${catalog.regions.map((item)=>item.name).join('、')}。` : '当前城市暂无已审核教练，可在“我的”申请成为教练。'}</p></div>
        <ArrowRight aria-hidden size={18} />
      </section>
    </div>
  );
}
