"use client";

import { BadgeCheck, CalendarDays, CalendarRange, ChartNoAxesCombined, ChevronDown, ClipboardCheck, CircleDollarSign, FileCheck2, Home, LayoutDashboard, Menu, MessageCircle, Search, Settings2, ShieldCheck, UsersRound, UserRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { IconName, NavItem, WebArea, WebSession } from "../_lib/web-platform";
import { coachNavigation, opsNavigation, studentNavigation } from "../_lib/web-platform";
import { Brand } from "./brand";
import styles from "./workspace-shell.module.css";

const icons: Record<IconName, LucideIcon> = {
  calendar: CalendarDays,
  coaches: BadgeCheck,
  content: FileCheck2,
  course: ClipboardCheck,
  credential: ShieldCheck,
  dashboard: LayoutDashboard,
  home: Home,
  matching: ChartNoAxesCombined,
  message: MessageCircle,
  payment: CircleDollarSign,
  profile: UserRound,
  release: Settings2,
  schedule: CalendarRange,
  search: Search,
  training: ChartNoAxesCombined,
  users: UsersRound,
};

const areaMeta = {
  coach: { label: "教练工作台", short: "教练模式" },
  ops: { label: "运营工作台", short: "运营模式" },
  student: { label: "学员服务", short: "学员模式" },
} as const;

function getNavigation(area: Exclude<WebArea, "public">): NavItem[] {
  if (area === "coach") return coachNavigation;
  if (area === "ops") return opsNavigation;
  return studentNavigation;
}

export function WorkspaceShell({ area, children, session }: { area: Exclude<WebArea, "public">; children: React.ReactNode; session: WebSession }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = useMemo(() => getNavigation(area).filter((item) => session.permissions.includes(item.permission)), [area, session.permissions]);
  const active = navigation.find((item) => item.href === pathname) ?? [...navigation].sort((a, b) => b.href.length - a.href.length).find((item) => pathname.startsWith(`${item.href}/`)) ?? navigation[0];

  useEffect(() => {
    localStorage.setItem(`zhuguang:last-route:${area}`, pathname);
  }, [area, pathname]);

  if (area === "student") {
    return (
      <div className={styles.studentShell}>
        <header className={styles.studentHeader}><Brand compact /><nav aria-label="学员平台导航">{navigation.map((item) => <NavLink active={active?.id === item.id} item={item} key={item.id} />)}</nav><AccountMenu area={area} session={session} /></header>
        <main className={styles.studentMain} key={pathname}>{children}</main>
        <nav className={styles.studentMobileNav} aria-label="学员平台移动导航">{navigation.filter((item) => item.id !== "student-training").slice(0, 5).map((item) => <NavLink active={active?.id === item.id} item={item} key={item.id} />)}</nav>
      </div>
    );
  }

  return (
    <div className={`${styles.workspaceShell} ${area === "ops" ? styles.opsShell : styles.coachShell}`}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarTop}><Brand /><button aria-label="关闭菜单" className={styles.mobileClose} onClick={() => setMenuOpen(false)} type="button"><X aria-hidden size={20} /></button></div>
        <p className={styles.modeLabel}>{areaMeta[area].label}</p>
        <nav aria-label={`${areaMeta[area].label}导航`}>
          {[...new Set(navigation.map((item) => item.group))].map((group) => <section key={group}><p>{group}</p>{navigation.filter((item) => item.group === group).map((item) => <NavLink active={active?.id === item.id} item={item} key={item.id} onNavigate={() => setMenuOpen(false)} />)}</section>)}
        </nav>
        <div className={styles.sidebarTrust}><ShieldCheck aria-hidden size={18} /><span><strong>受保护工作区</strong><small>身份、角色与关键操作均由服务端校验</small></span></div>
      </aside>
      {menuOpen ? <button aria-label="关闭菜单遮罩" className={styles.scrim} onClick={() => setMenuOpen(false)} type="button" /> : null}
      <div className={styles.workspaceBody}>
        <header className={styles.workspaceTopbar}><button aria-label="打开菜单" className={styles.mobileMenuButton} onClick={() => setMenuOpen(true)} type="button"><Menu aria-hidden size={21} /></button><div><p>北京试点 / {active?.label}</p><strong>{active?.label}</strong></div><AccountMenu area={area} session={session} /></header>
        <main className={styles.workspaceMain} key={pathname}>{children}</main>
      </div>
    </div>
  );
}

function NavLink({ active, item, onNavigate }: { active: boolean; item: NavItem; onNavigate?: () => void }) {
  const Icon = icons[item.icon];
  return <Link aria-current={active ? "page" : undefined} className={active ? styles.activeNav : undefined} href={item.href} onClick={onNavigate}><Icon aria-hidden size={18} /><span>{item.label}</span>{item.badge ? <b>{item.badge}</b> : null}</Link>;
}

function AccountMenu({ area, session }: { area: Exclude<WebArea, "public">; session: WebSession }) {
  return (
    <details className={styles.accountMenu}>
      <summary><span className={styles.avatar}>{session.displayName.slice(0, 1)}</span><span className={styles.accountText}><strong>{session.displayName}</strong><small>{areaMeta[area].short}</small></span><ChevronDown aria-hidden size={16} /></summary>
      <div><p>切换工作模式</p>{session.availableAreas.includes("student") ? <Link href="/student"><Home aria-hidden size={16} />学员服务</Link> : null}{session.availableAreas.includes("coach") ? <Link href="/coach-workspace"><ClipboardCheck aria-hidden size={16} />教练工作台</Link> : null}{session.availableAreas.includes("ops") ? <Link href="/ops"><Settings2 aria-hidden size={16} />运营工作台</Link> : null}<Link href="/"><Search aria-hidden size={16} />返回官网</Link></div>
    </details>
  );
}
