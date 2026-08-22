"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Brand } from "./brand";
import styles from "./public-site.module.css";

const links = [
  { href: "/coaches", label: "找教练" },
  { href: "/service-guarantee", label: "服务保障" },
  { href: "/#training-plans", label: "训练方案" },
  { href: "/coach-partnership", label: "教练合作" },
  { href: "/download", label: "下载 App" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Brand />
        <nav className={styles.desktopNav} aria-label="官网导航">
          {links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.loginLink} href="/login">登录</Link>
          <Link className={styles.enterButton} href="/login">进入平台 <ArrowRight aria-hidden size={16} /></Link>
        </div>
        <div className={styles.mobileMenu} ref={menuRef}>
          <button aria-expanded={open} aria-label={open ? "关闭导航" : "打开导航"} aria-controls="mobile-public-navigation" onClick={() => setOpen((current) => !current)} type="button"><Menu aria-hidden size={22} /></button>
          {open ? <nav aria-label="移动端官网导航" id="mobile-public-navigation">
            {links.map((item) => <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}
            <Link href="/login" onClick={() => setOpen(false)}>登录 / 进入平台</Link>
          </nav> : null}
        </div>
      </div>
    </header>
  );
}
