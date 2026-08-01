"use client";

import Image from "next/image";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import { CoachCard, MatchScore, SearchBar } from "../components";
import { getMatchResult } from "../domain";
import type { MatchPreferences, MobileBooking, MobileCoach } from "../types";

const sports = [
  { symbol: "羽", label: "羽毛球" },
  { symbol: "泳", label: "游泳" },
  { symbol: "网", label: "网球" },
  { symbol: "篮", label: "篮球" },
];

export function HomeView({
  activeBooking,
  coaches,
  onDiscover,
  onOpenBooking,
  onOpenCoach,
  onSearch,
  onSelectSport,
  onToggleSaved,
  preferences,
  query,
  savedCoachIds,
}: {
  activeBooking: MobileBooking | null;
  coaches: MobileCoach[];
  onDiscover: () => void;
  onOpenBooking: () => void;
  onOpenCoach: (coach: MobileCoach) => void;
  onSearch: (value: string) => void;
  onSelectSport: (sport: string) => void;
  onToggleSaved: (coachId: number) => void;
  preferences: MatchPreferences;
  query: string;
  savedCoachIds: number[];
}) {
  const featured = coaches.find((coach) => coach.sport === preferences.sport) ?? coaches[0];
  const featuredMatch = getMatchResult(featured, preferences);
  const recommended = coaches
    .map((coach) => ({ coach, match: getMatchResult(coach, preferences) }))
    .filter(({ match }) => match.eligible)
    .sort((left, right) => right.match.score - left.match.score)
    .slice(0, 3);

  return (
    <div className="zg-view zg-home-view">
      <section className="zg-home-intro">
        <h1>今天想练什么？</h1>
        <SearchBar onChange={onSearch} value={query} />
      </section>

      <nav aria-label="运动项目" className="zg-sport-tabs">
        {sports.map((item) => (
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

      <button className="zg-featured-coach" onClick={() => onOpenCoach(featured)} type="button">
        <Image alt={`${featured.name}教练指导学员训练`} fill priority sizes="(max-width: 760px) 100vw, 430px" src="/mobile-coach-hero-v23.webp" unoptimized />
        <span className="zg-featured-gradient" />
        <span className="zg-featured-copy">
          <strong>{featured.name}</strong>
          <small>{featured.sport} · {featured.level}</small>
          <em><ShieldCheck aria-hidden size={14} />履历已核验</em>
        </span>
        <MatchScore score={featuredMatch.score} />
      </button>

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
        <div><strong>北京试点服务</strong><p>优先展示朝阳、海淀、东城已完成履历核验的教练。</p></div>
        <ArrowRight aria-hidden size={18} />
      </section>
    </div>
  );
}
