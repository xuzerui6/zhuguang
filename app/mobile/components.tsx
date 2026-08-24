"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Home,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { getBookingStatusCopy, getMatchResult } from "./domain";
import type { MatchPreferences, MobileBooking, MobileCoach, MobileTab } from "./types";

const mobileTabs: Array<{ id: MobileTab; icon: typeof Home; label: string }> = [
  { id: "home", icon: Home, label: "首页" },
  { id: "discover", icon: UsersRound, label: "找教练" },
  { id: "bookings", icon: CalendarDays, label: "预约" },
  { id: "messages", icon: MessageCircle, label: "消息" },
  { id: "profile", icon: UserRound, label: "我的" },
];

const portraitPositions: Record<number, string> = {
  1: "12.5% 0%",
  2: "87.5% 0%",
  3: "12.5% 100%",
  4: "87.5% 100%",
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "zg-brand is-compact" : "zg-brand"}>
      <Image alt="" height={compact ? 27 : 32} priority src="/logo-mark.svg" width={compact ? 27 : 32} />
      <strong>逐光</strong>
    </span>
  );
}

export function AppHeader({
  city,
  notificationCount,
  onCity,
  onNotifications,
  onProfile,
}: {
  city: string;
  notificationCount: number;
  onCity: () => void;
  onNotifications: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="zg-app-header">
      <Brand />
      <button className="zg-location-button" onClick={onCity} type="button">
        <MapPin aria-hidden size={16} />
        <span>{city}</span>
        <ChevronRight aria-hidden size={14} />
      </button>
      <span className="zg-header-spacer" />
      <button aria-label="查看通知" className="zg-icon-button" onClick={onNotifications} type="button">
        <Bell aria-hidden size={21} />
        {notificationCount > 0 ? <b>{Math.min(notificationCount, 9)}</b> : null}
      </button>
      <button aria-label="个人中心" className="zg-avatar-button" onClick={onProfile} type="button">
        <UserRound aria-hidden size={18} />
      </button>
    </header>
  );
}

export function PageHeader({
  action,
  eyebrow,
  onBack,
  title,
}: {
  action?: ReactNode;
  eyebrow?: string;
  onBack?: () => void;
  title: string;
}) {
  return (
    <header className={onBack ? "zg-page-header has-back" : "zg-page-header"}>
      {onBack ? (
        <button aria-label="返回" className="zg-icon-button" onClick={onBack} type="button">
          <ArrowLeft aria-hidden size={22} />
        </button>
      ) : null}
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {action ? <span className="zg-page-header-action">{action}</span> : null}
    </header>
  );
}

export function BottomNav({
  active,
  bookingCount,
  messageCount,
  onNavigate,
}: {
  active: MobileTab;
  bookingCount: number;
  messageCount: number;
  onNavigate: (tab: MobileTab) => void;
}) {
  return (
    <nav aria-label="手机端主导航" className="zg-bottom-nav">
      {mobileTabs.map((item) => {
        const Icon = item.icon;
        const count = item.id === "messages" ? messageCount : item.id === "bookings" ? bookingCount : 0;
        return (
          <button
            aria-current={active === item.id ? "page" : undefined}
            className={active === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <span>
              <Icon aria-hidden size={22} strokeWidth={active === item.id ? 2.25 : 1.8} />
              {count > 0 ? <b>{Math.min(count, 9)}</b> : null}
            </span>
            <small>{item.label}</small>
          </button>
        );
      })}
    </nav>
  );
}

export function SearchBar({
  onChange,
  onFilter,
  placeholder = "搜索项目、教练或场馆",
  value,
}: {
  onChange: (value: string) => void;
  onFilter?: () => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <div className="zg-search-row">
      <label className="zg-search-box">
        <Search aria-hidden size={19} />
        <input aria-label={placeholder} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
        {value ? (
          <button aria-label="清除搜索" onClick={() => onChange("")} type="button"><X aria-hidden size={16} /></button>
        ) : null}
      </label>
      {onFilter ? (
        <button aria-label="筛选教练" className="zg-filter-button" onClick={onFilter} type="button">
          <SlidersHorizontal aria-hidden size={20} />
        </button>
      ) : null}
    </div>
  );
}

export function CoachAvatar({ coach, size = "medium" }: { coach: MobileCoach; size?: "small" | "medium" | "large" }) {
  return (
    <span
      aria-label={`${coach.name}教练头像`}
      className={`zg-coach-avatar is-${size}${coach.avatarUrl ? " has-image" : ""}`}
      role="img"
      style={{ "--zg-coach-position": portraitPositions[coach.id] ?? portraitPositions[1] } as CSSProperties}
    >
      {coach.avatarUrl ? <Image alt="" fill sizes="96px" src={coach.avatarUrl} unoptimized /> : null}
    </span>
  );
}

export function MatchScore({ score }: { score: number }) {
  return (
    <span className="zg-match-score">
      <small>匹配度</small>
      <strong>{score}%</strong>
    </span>
  );
}

export function CoachCard({
  coach,
  isSaved,
  onOpen,
  onSave,
  preferences,
}: {
  coach: MobileCoach;
  isSaved: boolean;
  onOpen: () => void;
  onSave: () => void;
  preferences: MatchPreferences;
}) {
  const match = getMatchResult(coach, preferences);
  return (
    <article className="zg-coach-card">
      <button className="zg-coach-card-main" onClick={onOpen} type="button">
        <CoachAvatar coach={coach} size="medium" />
        <span className="zg-coach-card-copy">
          <span className="zg-coach-card-title">
            <strong>{coach.name}</strong>
            {coach.verified !== false ? <em><ShieldCheck aria-hidden size={14} />{coach.verificationLabel ?? coach.level}</em> : null}
          </span>
          <small>{coach.profileKind === "demo" ? `${coach.sport} · 演示资料` : coach.isNew ? `${coach.sport} · 新教练` : `${coach.sport} · ${coach.experienceYears ?? 0}年教学经验`}</small>
          <span className="zg-coach-card-meta">
            {coach.profileKind === "demo" ? <b className="is-demo">演示</b> : coach.isNew ? <b className="is-new">新教练</b> : <b><Star aria-hidden fill="currentColor" size={14} />{coach.rating}</b>}
            {coach.distanceKm ? <i>{coach.distanceKm.toFixed(1)}km</i> : <i>{coach.district}</i>}
            <i>{coach.profileKind === "demo" ? "不可预约" : coach.bookable === false ? "当前未接单" : "可指定时间"}</i>
          </span>
        </span>
        <MatchScore score={match.score} />
      </button>
      <button
        aria-label={isSaved ? `取消收藏${coach.name}` : `收藏${coach.name}`}
        aria-pressed={isSaved}
        className={isSaved ? "zg-save-button is-saved" : "zg-save-button"}
        onClick={onSave}
        type="button"
      >
        <Bookmark aria-hidden fill={isSaved ? "currentColor" : "none"} size={19} />
      </button>
    </article>
  );
}

export function BookingStatusPill({ booking }: { booking: MobileBooking }) {
  const status = getBookingStatusCopy(booking.status);
  return <span className={`zg-status-pill is-${status.tone}`}>{status.label}</span>;
}

export function EmptyState({
  action,
  description,
  icon = "calendar",
  onAction,
  title,
}: {
  action?: string;
  description: string;
  icon?: "calendar" | "message" | "search";
  onAction?: () => void;
  title: string;
}) {
  const Icon = icon === "message" ? MessageCircle : icon === "search" ? Search : CalendarDays;
  return (
    <section className="zg-empty-state">
      <span><Icon aria-hidden size={28} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && onAction ? <button onClick={onAction} type="button">{action}</button> : null}
    </section>
  );
}

export function TrustRow({ detail, title }: { detail: string; title: string }) {
  return (
    <span className="zg-trust-row">
      <ShieldCheck aria-hidden size={19} />
      <span><strong>{title}</strong><small>{detail}</small></span>
      <ChevronRight aria-hidden size={17} />
    </span>
  );
}

export function Sheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("[data-sheet-autofocus], input, textarea, select, button:not([aria-label='关闭'])")?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="zg-sheet-layer">
      <button aria-label="关闭弹层" className="zg-sheet-backdrop" onClick={onClose} type="button" />
      <section aria-label={title} aria-modal="true" className="zg-sheet" ref={panelRef} role="dialog">
        <span className="zg-sheet-handle" />
        <header><h2>{title}</h2><button aria-label="关闭" onClick={onClose} type="button"><X aria-hidden size={20} /></button></header>
        <div className="zg-sheet-body">{children}</div>
      </section>
    </div>
  );
}

export function VerifiedPhone({ masked }: { masked?: string }) {
  return (
    <span className="zg-verified-phone">
      <ShieldCheck aria-hidden size={17} />
      <span>{masked ? `账号 ${masked}` : "账号待验证"}</span>
      <ChevronRight aria-hidden size={16} />
    </span>
  );
}

export function ProfileAvatar({ label = "个人头像" }: { label?: string }) {
  return <span aria-label={label} className="zg-profile-avatar" role="img"><CircleUserRound aria-hidden size={34} /></span>;
}
