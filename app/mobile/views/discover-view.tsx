"use client";

import { ArrowDownUp, MapPin, SlidersHorizontal } from "lucide-react";
import { CoachCard, EmptyState, PageHeader, SearchBar } from "../components";
import { getMatchResult } from "../domain";
import type { MatchPreferences, MobileCoach } from "../types";

export function DiscoverView({
  coaches,
  onFilter,
  onOpenCoach,
  onQuery,
  onToggleSaved,
  preferences,
  query,
  savedCoachIds,
}: {
  coaches: MobileCoach[];
  onFilter: () => void;
  onOpenCoach: (coach: MobileCoach) => void;
  onQuery: (value: string) => void;
  onToggleSaved: (coachId: number) => void;
  preferences: MatchPreferences;
  query: string;
  savedCoachIds: number[];
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const results = coaches
    .map((coach) => ({ coach, match: getMatchResult(coach, preferences) }))
    .filter(({ coach, match }) => {
      if (!match.eligible) return false;
      if (!normalizedQuery) return true;
      return [coach.name, coach.sport, coach.level, coach.title, coach.district, ...coach.strengths, ...coach.goals]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => right.match.score - left.match.score);

  return (
    <div className="zg-view zg-discover-view">
      <PageHeader eyebrow="北京 · 已核验教练" title="找教练" />
      <SearchBar onChange={onQuery} onFilter={onFilter} value={query} />

      <div className="zg-filter-summary">
        <span><SlidersHorizontal aria-hidden size={15} />{preferences.sport}</span>
        <span><MapPin aria-hidden size={15} />{preferences.district}</span>
        <span>{preferences.goal}</span>
        <button onClick={onFilter} type="button"><ArrowDownUp aria-hidden size={15} />匹配度优先</button>
      </div>

      <div className="zg-result-heading">
        <strong>{results.length} 位合适教练</strong>
        <small>价格为常规课时参考价</small>
      </div>

      {results.length ? (
        <div className="zg-coach-list is-discover">
          {results.map(({ coach }) => (
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
      ) : (
        <EmptyState action="调整筛选" description="换一个训练项目、区域或预算范围试试。" icon="search" onAction={onFilter} title="暂时没有完全匹配的教练" />
      )}
    </div>
  );
}
