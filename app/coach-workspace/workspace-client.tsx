"use client";

import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  LogIn,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookingStatus, MobileBooking, MobileCoach, MobileConversation } from "../mobile/types";
import { formatYuan, getBookingStatusCopy } from "../mobile/domain";
import styles from "./workspace.module.css";

type Overview = {
  bookings: MobileBooking[];
  coach: MobileCoach;
  conversations: Array<MobileConversation | { id: string; title: string }>;
  slots: Array<{ available: boolean; date: string; dateLabel: string; endTime: string; id: string; time: string }>;
};

type ApiFailure = { error?: { message?: string } };

const navigation = [
  { icon: LayoutDashboard, label: "今日工作", section: "工作" },
  { icon: UserRoundCheck, label: "预约管理", section: "履约" },
  { icon: CalendarDays, label: "排期与场馆", section: "履约" },
  { icon: MessageCircle, label: "学员消息", section: "沟通" },
  { icon: ClipboardCheck, label: "课程记录", section: "经营" },
  { icon: CircleDollarSign, label: "线下收款", section: "经营" },
  { icon: ShieldCheck, label: "资质与资料", section: "设置" },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload = await response.json() as { data?: T } & ApiFailure;
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "服务暂时不可用");
  return payload.data;
}

export default function CoachWorkspaceClient({ signedInEmail }: { signedInEmail: string | null }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [active, setActive] = useState("今日工作");
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await api<Overview>("/api/v1/coach/overview"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "工作台载入失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const data = await api<Overview>("/api/v1/coach/overview");
        if (!cancelled) setOverview(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "工作台载入失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  const filteredBookings = useMemo(() => {
    const bookings = overview?.bookings ?? [];
    if (filter === "pending") return bookings.filter((booking) => booking.status === "pending_coach" || booking.status === "reschedule_requested");
    if (filter === "confirmed") return bookings.filter((booking) => booking.status === "confirmed");
    return bookings;
  }, [filter, overview]);

  const transition = async (booking: MobileBooking, status: BookingStatus) => {
    setBusyId(booking.id);
    setError("");
    try {
      const updated = await api<MobileBooking>(`/api/v1/coach/bookings/${encodeURIComponent(booking.id)}/status`, {
        body: JSON.stringify({ status }),
        method: "POST",
      });
      setOverview((current) => current ? { ...current, bookings: current.bookings.map((item) => item.id === updated.id ? updated : item) } : current);
      setNotice(status === "confirmed" ? "预约已确认，学员会收到站内通知与短信" : "预约状态已更新");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败");
    } finally {
      setBusyId("");
    }
  };

  const pendingCount = overview?.bookings.filter((booking) => booking.status === "pending_coach" || booking.status === "reschedule_requested").length ?? 0;
  const todaySlots = overview?.slots.filter((slot) => slot.dateLabel === "今天").length ?? 0;

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="返回逐光首页">
          <Image alt="" height={34} src="/logo-mark.svg" width={34} />
          <span><strong>逐光</strong><small>教练工作台</small></span>
        </Link>
        <nav aria-label="教练工作台导航">
          {[...new Set(navigation.map((item) => item.section))].map((section) => (
            <section key={section}>
              <p>{section}</p>
              {navigation.filter((item) => item.section === section).map((item) => {
                const Icon = item.icon;
                return (
                  <button className={active === item.label ? styles.activeNav : ""} key={item.label} onClick={() => setActive(item.label)} type="button">
                    <Icon aria-hidden size={18} />
                    <span>{item.label}</span>
                    {item.label === "预约管理" && pendingCount ? <b>{pendingCount}</b> : null}
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <ShieldCheck aria-hidden size={17} />
          <span><strong>北京私有试点</strong><small>身份与操作均留痕</small></span>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p>北京试点 / {active}</p>
            <h1>{active}</h1>
          </div>
          <div className={styles.account}>
            <button aria-label="刷新工作台" onClick={() => void load()} title="刷新" type="button"><RefreshCw aria-hidden size={18} /></button>
            <span><b>{overview?.coach.name?.slice(0, 1) ?? "教"}</b><span><strong>{overview?.coach.name ?? "试点教练"}</strong><small>{signedInEmail ?? "本地预览身份"}</small></span></span>
            <button aria-label="账号设置" title="账号设置" type="button"><Settings aria-hidden size={18} /></button>
          </div>
        </header>

        {loading ? <WorkspaceSkeleton /> : null}
        {!loading && error && !overview ? (
          <section className={styles.accessState}>
            <LogIn aria-hidden size={28} />
            <h2>需要已获邀的教练账号</h2>
            <p>{error}</p>
            <a href={`/signin-with-chatgpt?return_to=${encodeURIComponent("/coach-workspace")}`}>登录教练工作台</a>
          </section>
        ) : null}

        {overview ? (
          <div className={styles.content}>
            <section className={styles.metrics} aria-label="今日经营概览">
              <article><span><Clock3 aria-hidden size={18} /></span><p>待确认预约</p><strong>{pendingCount}</strong><small>建议 2 小时内处理</small></article>
              <article><span><CalendarClock aria-hidden size={18} /></span><p>今日可约时段</p><strong>{todaySlots}</strong><small>来自已发布排期</small></article>
              <article><span><MessageCircle aria-hidden size={18} /></span><p>学员会话</p><strong>{overview.conversations.length}</strong><small>前台每 15 秒同步</small></article>
              <article><span><CircleDollarSign aria-hidden size={18} /></span><p>待线下收款</p><strong>{overview.bookings.filter((booking) => booking.status === "confirmed" && booking.paymentStatus === "offline_unpaid").length}</strong><small>完成后请及时标记</small></article>
            </section>

            <section className={styles.queue}>
              <header>
                <div><h2>预约处理队列</h2><p>仅展示你名下的真实预约，状态更新会同步给学员。</p></div>
                <div className={styles.segmented} role="tablist">
                  <button aria-selected={filter === "pending"} className={filter === "pending" ? styles.selected : ""} onClick={() => setFilter("pending")} role="tab" type="button">待处理</button>
                  <button aria-selected={filter === "confirmed"} className={filter === "confirmed" ? styles.selected : ""} onClick={() => setFilter("confirmed")} role="tab" type="button">已确认</button>
                  <button aria-selected={filter === "all"} className={filter === "all" ? styles.selected : ""} onClick={() => setFilter("all")} role="tab" type="button">全部</button>
                </div>
              </header>

              <div className={styles.tableHeader}><span>学员与项目</span><span>上课安排</span><span>费用</span><span>状态</span><span>操作</span></div>
              <div className={styles.bookingList}>
                {filteredBookings.map((booking) => <BookingRow booking={booking} busy={busyId === booking.id} key={booking.id} onTransition={transition} />)}
                {!filteredBookings.length ? <div className={styles.empty}><BadgeCheck aria-hidden size={25} /><strong>当前队列已处理完</strong><p>新的预约申请会自动出现在这里。</p></div> : null}
              </div>
            </section>
          </div>
        ) : null}
        {error && overview ? <div className={styles.error} role="alert"><X aria-hidden size={16} />{error}</div> : null}
        {notice ? <div className={styles.toast} role="status"><Check aria-hidden size={17} />{notice}</div> : null}
      </section>
    </main>
  );
}

function BookingRow({ booking, busy, onTransition }: { booking: MobileBooking; busy: boolean; onTransition: (booking: MobileBooking, status: BookingStatus) => void }) {
  const status = getBookingStatusCopy(booking.status);
  return (
    <article className={styles.bookingRow}>
      <div><span className={styles.studentAvatar}>轩</span><span><strong>徐子轩</strong><small>羽毛球 · 专项提升</small></span></div>
      <div><strong>{booking.dateLabel} {booking.time}-{booking.endTime}</strong><small>北京试点场馆</small></div>
      <div><strong>{formatYuan(booking.feeFen)}</strong><small>{booking.paymentStatus === "offline_paid" ? "线下已收款" : "线下待支付"}</small></div>
      <div><span className={`${styles.status} ${styles[status.tone]}`}>{status.label}</span><small>#{booking.id.slice(-8)}</small></div>
      <div className={styles.actions}>
        {booking.status === "pending_coach" || booking.status === "reschedule_requested" ? (
          <>
            <button disabled={busy} onClick={() => onTransition(booking, "confirmed")} type="button"><Check aria-hidden size={16} />确认</button>
            <button className={styles.secondary} disabled={busy} onClick={() => onTransition(booking, "reschedule_requested")} type="button"><Clock3 aria-hidden size={16} />改期</button>
            <button aria-label="拒绝预约" className={styles.iconAction} disabled={busy} onClick={() => onTransition(booking, "rejected")} title="拒绝" type="button"><X aria-hidden size={17} /></button>
          </>
        ) : booking.status === "confirmed" ? (
          <button disabled={busy} onClick={() => onTransition(booking, "completed")} type="button"><ClipboardCheck aria-hidden size={16} />完成课程</button>
        ) : <button aria-label="更多操作" className={styles.iconAction} title="更多" type="button"><MoreHorizontal aria-hidden size={18} /></button>}
      </div>
    </article>
  );
}

function WorkspaceSkeleton() {
  return <div className={styles.skeleton} aria-label="正在载入教练工作台"><span /><span /><span /><span /><i /><i /><i /></div>;
}
