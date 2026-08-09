"use client";

import {
  BadgeCheck,
  CalendarDays,
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CoachProfile } from "../_lib/web-platform";
import { coaches } from "../_lib/web-platform";
import styles from "./coach-directory.module.css";

type DirectoryProps = {
  embedded?: boolean;
  initialDistrict?: string;
  initialGoal?: string;
  initialSport?: string;
};

export function CoachDirectory({ embedded = false, initialDistrict = "全部区域", initialGoal = "全部目标", initialSport = "全部项目" }: DirectoryProps) {
  const [sport, setSport] = useState(initialSport);
  const [district, setDistrict] = useState(initialDistrict);
  const [goal, setGoal] = useState(initialGoal);
  const [audience, setAudience] = useState("全部对象");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("不限价格");
  const [sort, setSort] = useState("综合排序");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([1]);
  const [selectedId, setSelectedId] = useState(1);

  const results = useMemo(() => {
    let items = coaches.filter((coach) => {
      if (sport !== "全部项目" && coach.sport !== sport) return false;
      if (district !== "全部区域" && coach.district !== district) return false;
      if (goal !== "全部目标" && !coach.goals.includes(goal)) return false;
      if (audience !== "全部对象" && !coach.audience.includes(audience)) return false;
      if (date) {
        const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${date}T12:00:00`).getDay()];
        if (!coach.availability.some((item) => item.day === weekday)) return false;
      }
      if (favoritesOnly && !favorites.includes(coach.id)) return false;
      if (price === "300元以内" && coach.price > 300) return false;
      if (price === "250元以内" && coach.price > 250) return false;
      return true;
    });
    if (sort === "评分优先") items = [...items].sort((a, b) => b.rating - a.rating);
    if (sort === "价格从低到高") items = [...items].sort((a, b) => a.price - b.price);
    return items;
  }, [audience, date, district, favorites, favoritesOnly, goal, price, sort, sport]);

  const selected = results.find((coach) => coach.id === selectedId) ?? results[0] ?? coaches[0];

  function resetFilters() {
    setSport("全部项目");
    setDistrict("全部区域");
    setGoal("全部目标");
    setAudience("全部对象");
    setDate("");
    setPrice("不限价格");
    setFavoritesOnly(false);
  }

  function toggleFavorite(id: number) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <section className={`${styles.directory} ${embedded ? styles.embedded : styles.standalone}`}>
      <header className={styles.directoryHeader}>
        <div>
          <p>{embedded ? "学员服务 / 北京" : "北京教练服务"}</p>
          <h1>找适合你的教练</h1>
        </div>
        {!embedded ? <p>先比较经历、场馆、价格与时间，再决定是否预约。</p> : null}
      </header>

      <div className={`${styles.filters} ${filtersExpanded ? styles.filtersExpanded : ""}`} aria-label="教练筛选条件">
        <button aria-expanded={filtersExpanded} className={styles.filterTitle} onClick={() => setFiltersExpanded((current) => !current)} type="button"><SlidersHorizontal aria-hidden size={18} />筛选<ChevronDown aria-hidden className={styles.filterToggleIcon} size={15} /></button>
        <FilterSelect label="运动项目" onChange={setSport} options={["全部项目", "羽毛球", "游泳", "篮球", "体能"]} value={sport} />
        <FilterSelect label="区域" onChange={setDistrict} options={["全部区域", "朝阳区", "海淀区", "东城区", "丰台区"]} value={district} />
        <FilterSelect label="训练目标" onChange={setGoal} options={["全部目标", "专项提升", "兴趣培养", "体能强化", "比赛备战"]} value={goal} />
        <FilterSelect label="服务对象" onChange={setAudience} options={["全部对象", "青少年", "成人进阶", "亲子"]} value={audience} />
        <label className={styles.dateControl}><span>日期</span><input aria-label="选择训练日期" onChange={(event) => setDate(event.target.value)} type="date" value={date} /><CalendarDays aria-hidden size={17} /></label>
        <FilterSelect label="价格" onChange={setPrice} options={["不限价格", "300元以内", "250元以内"]} value={price} />
        <button className={styles.resetButton} onClick={resetFilters} type="button"><RefreshCw aria-hidden size={15} />清空</button>
      </div>

      <div className={styles.resultsToolbar}>
        <strong>找到 {results.length} 位教练</strong>
        <div className={styles.segmented}>
          {["综合排序", "评分优先", "价格从低到高"].map((item) => (
            <button aria-pressed={sort === item} className={sort === item ? styles.selectedSegment : ""} key={item} onClick={() => setSort(item)} type="button">{item}</button>
          ))}
        </div>
        <button aria-pressed={favoritesOnly} className={styles.favoriteFilter} onClick={() => setFavoritesOnly((current) => !current)} type="button">
          <Heart aria-hidden fill={favoritesOnly ? "currentColor" : "none"} size={17} />只看已收藏
        </button>
      </div>

      <div className={styles.directoryBody}>
        <div className={styles.coachList}>
          {results.map((coach) => (
            <CoachResult
              active={selected.id === coach.id}
              coach={coach}
              favorite={favorites.includes(coach.id)}
              key={coach.id}
              onFavorite={() => toggleFavorite(coach.id)}
              onSelect={() => setSelectedId(coach.id)}
            />
          ))}
          {!results.length ? (
            <div className={styles.emptyState}>
              <Search aria-hidden size={28} />
              <strong>没有符合全部条件的教练</strong>
              <p>减少一个筛选条件，或查看北京全部试点教练。</p>
              <button onClick={resetFilters} type="button">查看全部教练</button>
            </div>
          ) : null}
        </div>
        {results.length ? <CoachInspector coach={selected} embedded={embedded} /> : null}
      </div>
    </section>
  );
}

function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className={styles.filterControl}>
      <span>{label}</span>
      <select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown aria-hidden size={16} />
    </label>
  );
}

function CoachResult({ active, coach, favorite, onFavorite, onSelect }: { active: boolean; coach: CoachProfile; favorite: boolean; onFavorite: () => void; onSelect: () => void }) {
  return (
    <article className={`${styles.coachResult} ${active ? styles.activeResult : ""}`}>
      <button aria-label={`查看${coach.name}教练`} className={styles.selectCoach} onClick={onSelect} type="button" />
      <div className={styles.resultImage}>
        <Image alt={`${coach.name}教练`} fill sizes="180px" src={coach.image} unoptimized />
        {active ? <span><Check aria-hidden size={16} /></span> : null}
      </div>
      <div className={styles.resultInfo}>
        <div className={styles.resultName}>
          <h2>{coach.name}</h2>
          <span><BadgeCheck aria-hidden size={15} />已认证</span>
        </div>
        <p className={styles.resultTitle}>{coach.title}</p>
        <p><ShieldCheck aria-hidden size={15} />{coach.credentials.slice(0, 2).join(" · ")}</p>
        <p><MapPin aria-hidden size={15} />{coach.venue} <span>· {coach.district}</span></p>
        <p className={styles.nextSlot}><Clock3 aria-hidden size={15} />最早可约 {coach.nextSlot}</p>
      </div>
      <div className={styles.resultCommercial}>
        <span className={styles.rating}><Star aria-hidden fill="currentColor" size={16} />{coach.rating}<small>（{coach.reviewCount}条评价）</small></span>
        <strong>¥{coach.price}<small>/课时</small></strong>
        <span>60–90分钟</span>
        <button aria-label={favorite ? `取消收藏${coach.name}` : `收藏${coach.name}`} className={styles.heartButton} onClick={onFavorite} type="button">
          <Heart aria-hidden fill={favorite ? "currentColor" : "none"} size={19} />{favorite ? "已收藏" : "收藏"}
        </button>
      </div>
    </article>
  );
}

function CoachInspector({ coach, embedded }: { coach: CoachProfile; embedded: boolean }) {
  const bookingHref = embedded ? `/student/bookings?coach=${coach.id}` : `/login?next=${encodeURIComponent(`/student/bookings?coach=${coach.id}`)}`;
  return (
    <aside className={styles.inspector} aria-label={`${coach.name}教练摘要`}>
      <div className={styles.inspectorProfile}>
        <Image alt={`${coach.name}教练`} height={120} src={coach.image} unoptimized width={120} />
        <div><span><BadgeCheck aria-hidden size={14} />已认证</span><h2>{coach.name}</h2><p>{coach.title}</p></div>
      </div>
      <div className={styles.inspectorFacts}>
        <p><Star aria-hidden fill="currentColor" size={16} /><strong>{coach.rating}</strong><span>{coach.reviewCount} 条评价</span></p>
        <p><MapPin aria-hidden size={16} /><strong>{coach.district}</strong><span>{coach.venue}</span></p>
      </div>
      <section>
        <header><h3>认证与资质</h3><Link href={`/coaches/${coach.id}`}>查看全部</Link></header>
        <ul className={styles.credentials}>
          {coach.credentials.map((item) => <li key={item}><ShieldCheck aria-hidden size={17} /><span>{item}</span><BadgeCheck aria-hidden size={16} /></li>)}
        </ul>
      </section>
      <section>
        <header><h3>本周可约时间</h3><span>北京时间</span></header>
        <div className={styles.availability}>
          {coach.availability.map((item) => (
            <div key={item.day}><strong>{item.day}</strong>{item.periods.map((period) => <span key={period}>{period}</span>)}</div>
          ))}
        </div>
      </section>
      <div className={styles.inspectorActions}>
        <Link href={`/coaches/${coach.id}`}>查看详情</Link>
        <Link href={bookingHref}>预约试课</Link>
      </div>
    </aside>
  );
}
