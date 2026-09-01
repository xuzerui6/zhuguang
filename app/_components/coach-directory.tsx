"use client";

import {
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AUDIENCE_OPTIONS, BEIJING_DISTRICTS, SPORT_OPTIONS, TRAINING_GOAL_OPTIONS, matchesAudience, matchesTrainingGoal } from "../../shared/coach-catalog";
import type { MobileCoach } from "../mobile/types";
import type { CoachProfile } from "../_lib/web-platform";
import { mapMobileCoachToWeb, publicCoaches as fallbackCoaches } from "../_lib/web-platform";
import { platformRequest } from "./platform-client";
import styles from "./coach-directory.module.css";

type DirectoryProps = {
  embedded?: boolean;
  initialCoaches?: CoachProfile[];
  initialDistrict?: string;
  initialGoal?: string;
  initialSport?: string;
};

const ALL_SPORTS = "全部项目";
const ALL_DISTRICTS = "全部区域";
const ALL_GOALS = "全部目标";
const ALL_AUDIENCES = "全部对象";

export function CoachDirectory({ embedded = false, initialCoaches = fallbackCoaches, initialDistrict = ALL_DISTRICTS, initialGoal = ALL_GOALS, initialSport = ALL_SPORTS }: DirectoryProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [directoryCoaches, setDirectoryCoaches] = useState(initialCoaches);
  const sport = searchParams.get("sport") || initialSport;
  const district = searchParams.get("district") || initialDistrict;
  const goal = searchParams.get("goal") || initialGoal;
  const audience = searchParams.get("audience") || ALL_AUDIENCES;
  const favoritesOnly = searchParams.get("favorites") === "1";
  const selectedId = Number(searchParams.get("coach")) || directoryCoaches[0]?.id;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("zhuguang-web-favorites") || "[]");
        if (Array.isArray(stored)) setFavorites(stored.filter((id): id is number => Number.isInteger(id)));
      } catch {
        setFavorites([]);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!embedded) return;
    let active = true;
    void platformRequest<{ favoriteCoachIds: number[] }>("/api/v1/bootstrap")
      .then((data) => { if (active) setFavorites(data.favoriteCoachIds); })
      .catch(() => { /* Keep the local anonymous collection until login is available. */ });
    return () => { active = false; };
  }, [embedded]);

  useEffect(() => {
    let active = true;
    void platformRequest<MobileCoach[]>("/api/v1/coaches")
      .then((items) => { if (active) setDirectoryCoaches(items.map(mapMobileCoachToWeb)); })
      .catch(() => { /* Keep the last server-rendered or offline-safe catalog. */ });
    return () => { active = false; };
  }, []);

  function updateQuery(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    startTransition(() => router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false }));
  }

  function setFilter(key: string, value: string, fallback: string) {
    updateQuery({ [key]: value === fallback ? null : value, coach: null });
  }

  const results = useMemo(() => directoryCoaches.filter((coach) => {
    if (sport !== ALL_SPORTS && coach.sport !== sport) return false;
    if (district !== ALL_DISTRICTS && coach.district !== district) return false;
    if (!matchesTrainingGoal(coach.goals, goal)) return false;
    if (!matchesAudience(coach.audience, audience)) return false;
    if (favoritesOnly && !favorites.includes(coach.id)) return false;
    return true;
  }), [audience, directoryCoaches, district, favorites, favoritesOnly, goal, sport]);

  const goalOptions = TRAINING_GOAL_OPTIONS;
  const audienceOptions = AUDIENCE_OPTIONS;

  const selected = results.find((coach) => coach.id === selectedId) ?? results[0];

  function resetFilters() {
    updateQuery({ audience: null, coach: null, district: null, favorites: null, goal: null, sport: null });
  }

  function toggleFavorite(id: number) {
    setFavorites((current) => {
      const wasFavorite = current.includes(id);
      const next = wasFavorite ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem("zhuguang-web-favorites", JSON.stringify(next));
      if (embedded) void platformRequest(`/api/v1/favorites/${id}`, { method: wasFavorite ? "DELETE" : "PUT" }).catch(() => { /* Local state remains available for retry. */ });
      return next;
    });
  }

  return (
    <section aria-busy={isNavigating} className={`${styles.directory} ${embedded ? styles.embedded : styles.standalone}`}>
      <header className={styles.directoryHeader}>
        <div><p>{embedded ? "学员服务 / 北京" : "北京教练服务"}</p><h1>找到适合你的教练</h1></div>
        {!embedded ? <p>所有评分、评价、课量和接单状态都来自真实业务数据；缺失信息会明确标注。</p> : null}
      </header>

      <div className={`${styles.filters} ${filtersExpanded ? styles.filtersExpanded : ""}`} aria-label="教练筛选条件">
        <button aria-expanded={filtersExpanded} className={styles.filterTitle} onClick={() => setFiltersExpanded((current) => !current)} type="button"><SlidersHorizontal aria-hidden size={18} />筛选 <ChevronDown aria-hidden className={styles.filterToggleIcon} size={15} /></button>
        <FilterSelect label="运动项目" onChange={(value) => setFilter("sport", value, ALL_SPORTS)} options={[ALL_SPORTS, ...SPORT_OPTIONS]} value={sport} />
        <FilterSelect label="区域" onChange={(value) => setFilter("district", value, ALL_DISTRICTS)} options={[ALL_DISTRICTS, ...BEIJING_DISTRICTS]} value={district} />
        <FilterSelect label="训练目标" onChange={(value) => setFilter("goal", value, ALL_GOALS)} options={[ALL_GOALS, ...goalOptions]} value={goal} />
        <FilterSelect label="服务对象" onChange={(value) => setFilter("audience", value, ALL_AUDIENCES)} options={[ALL_AUDIENCES, ...audienceOptions]} value={audience} />
        <button className={styles.resetButton} onClick={resetFilters} type="button"><RefreshCw aria-hidden size={15} />清空</button>
      </div>

      <div className={styles.resultsToolbar}>
        <strong>找到 {results.length} 位教练</strong>
        <span>仅展示已审核并上线的真实教练</span>
        <button aria-pressed={favoritesOnly} className={styles.favoriteFilter} onClick={() => updateQuery({ favorites: favoritesOnly ? null : "1", coach: null })} type="button"><Heart aria-hidden fill={favoritesOnly ? "currentColor" : "none"} size={17} />只看已收藏</button>
      </div>

      <div className={styles.directoryBody}>
        <div className={styles.coachList}>
          {results.map((coach) => <CoachResult active={selected?.id === coach.id} coach={coach} favorite={favorites.includes(coach.id)} key={coach.id} onFavorite={() => toggleFavorite(coach.id)} onSelect={() => updateQuery({ coach: String(coach.id) })} />)}
          {!results.length ? <div className={styles.emptyState}><Search aria-hidden size={28} /><strong>没有符合全部条件的教练</strong><p>减少一个筛选条件，或查看当前全部试点教练。</p><button onClick={resetFilters} type="button">查看全部教练</button></div> : null}
        </div>
        {selected ? <CoachInspector coach={selected} embedded={embedded} key={selected.id} /> : null}
      </div>
    </section>
  );
}

function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return <label className={styles.filterControl}><span>{label}</span><select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden size={16} /></label>;
}

function CoachResult({ active, coach, favorite, onFavorite, onSelect }: { active: boolean; coach: CoachProfile; favorite: boolean; onFavorite: () => void; onSelect: () => void }) {
  return (
    <article className={`${styles.coachResult} ${active ? styles.activeResult : ""}`}>
      <button aria-label={`查看${coach.name}教练`} className={styles.selectCoach} onClick={onSelect} type="button" />
      <Link aria-label={`打开${coach.name}教练详情`} className={styles.openCoach} href={`/coaches/${coach.id}`} />
      <div className={styles.resultImage}><Image alt={coach.profileKind === "demo" ? `${coach.sport}演示场景` : `${coach.name}教练`} fill sizes="180px" src={coach.media.cardUrl || coach.image} unoptimized />{active ? <span><Check aria-hidden size={16} /></span> : null}</div>
      <div className={styles.resultInfo}>
        <div className={styles.resultName}><h2>{coach.name}</h2><span><BadgeCheck aria-hidden size={15} />{coach.verificationLabel}</span></div>
        <p className={styles.resultTitle}>{coach.title}</p>
        <p><ShieldCheck aria-hidden size={15} />{coach.profileKind === "demo" ? "演示资料，不代表真实教练" : "未展示未经核验的证书或成绩"}</p>
        <p><MapPin aria-hidden size={15} />{coach.venue} <span>· {coach.district}</span></p>
        <p><UsersRound aria-hidden size={15} />适合 {coach.audience.slice(0, 2).join("、")} · {coach.strengths.slice(0, 2).join("、")}</p>
        <p className={styles.nextSlot}><Clock3 aria-hidden size={15} />{coach.nextSlot}</p>
      </div>
      <div className={styles.resultCommercial}>
        <span className={`${styles.rating} ${coach.reviewCount < 3 ? styles.newCoachRating : ""}`}><Star aria-hidden size={16} />{coach.profileKind === "demo" ? "演示资料" : coach.reviewCount < 3 ? coach.reviewCount ? `${coach.reviewCount}条评价` : "新教练" : coach.rating.toFixed(1)}<small>{coach.profileKind === "demo" ? "不可预约" : coach.reviewCount < 3 ? "暂不展示均分" : `${coach.reviewCount} 条评价`}</small></span>
        <strong>{coach.price === undefined ? "价格待发布" : <>¥{coach.price}<small>/60分钟</small></>}</strong><span>{coach.trialPrice === undefined ? "暂未开放试课" : `首次试课 ¥${coach.trialPrice}/60分钟`}</span>
        <button aria-label={favorite ? `取消收藏${coach.name}` : `收藏${coach.name}`} className={styles.heartButton} onClick={onFavorite} type="button"><Heart aria-hidden fill={favorite ? "currentColor" : "none"} size={19} />{favorite ? "已收藏" : "收藏"}</button>
      </div>
    </article>
  );
}

function CoachInspector({ coach, embedded }: { coach: CoachProfile; embedded: boolean }) {
  const contactHref = embedded ? `/student/messages?coach=${coach.id}` : `/?coach=${coach.id}#service-inquiry`;
  const bookingHref = `/student/bookings?coach=${coach.id}`;
  return (
    <aside className={styles.inspector} aria-label={`${coach.name}教练摘要`}>
      <div className={styles.inspectorProfile}><Image alt={coach.profileKind === "demo" ? `${coach.sport}演示场景` : `${coach.name}教练`} height={120} src={coach.media.avatarUrl || coach.image} unoptimized width={120} /><div><span><BadgeCheck aria-hidden size={14} />{coach.verificationLabel}</span><h2>{coach.name}</h2><p>{coach.title}</p></div></div>
      <div className={styles.inspectorFacts}><p><Star aria-hidden size={16} /><strong>{coach.profileKind === "demo" ? "演示资料" : coach.reviewCount >= 3 ? coach.rating.toFixed(1) : coach.reviewCount ? `${coach.reviewCount}条评价` : "新教练"}</strong><span>{coach.profileKind === "demo" ? "不参与预约" : coach.reviewCount >= 3 ? `${coach.reviewCount}条履约评价` : "暂不展示均分"}</span></p><p><MapPin aria-hidden size={16} /><strong>{coach.district}</strong><span>{coach.venue}</span></p></div>
      <section><header><h3>资料状态</h3><Link href={`/coaches/${coach.id}`}>查看档案</Link></header><ul className={styles.credentials}><li className={styles.inspectorEmpty}><ShieldCheck aria-hidden size={17} /><span>{coach.profileKind === "demo" ? "用于功能演示，不代表真实供给" : "仅展示已确认的身份与服务资料"}</span></li></ul></section>
      <section><header><h3>预约方式</h3><span>北京时间</span></header><div className={styles.availability}><div className={styles.inspectorAvailabilityEmpty}><Clock3 aria-hidden size={17} /><span>{coach.bookable ? "由学员指定未来2小时至60天内的训练时间" : coach.unavailableReason || "当前未上线接单"}</span></div></div></section>
      <div className={styles.inspectorActions}><Link href={`/coaches/${coach.id}`}>查看详情</Link>{embedded && coach.bookable ? <Link href={bookingHref}>选择时间预约</Link> : coach.canConsult ? <Link href={contactHref}>咨询训练安排</Link> : <button disabled type="button">演示资料不可咨询</button>}</div>
    </aside>
  );
}
