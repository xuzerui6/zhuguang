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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => dialog.querySelector<HTMLAnchorElement>("a")?.focus());
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Brand />
        <nav className={styles.desktopNav} aria-label="官网导航">
          {links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.enterButton} href="/login?next=/student">学员入口 <ArrowRight aria-hidden size={16} /></Link>
        </div>
        <div className={styles.mobileMenu}>
          <button ref={triggerRef} aria-expanded={open} aria-label={open ? "关闭导航" : "打开导航"} aria-controls="mobile-public-navigation" onClick={() => setOpen((current) => !current)} type="button"><Menu aria-hidden size={22} /></button>
          <dialog className={styles.mobileMenuDialog} onCancel={(event) => { event.preventDefault(); closeMenu(); }} onClose={() => setOpen(false)} onMouseDown={(event) => { if (event.currentTarget === event.target) closeMenu(); }} ref={dialogRef}>
            <nav aria-label="移动端官网导航" id="mobile-public-navigation">
              {links.map((item) => <Link href={item.href} key={item.href} onClick={closeMenu}>{item.label}</Link>)}
              <Link href="/login?next=/student" onClick={closeMenu}>学员入口</Link>
              <p>认证教练登录后可切换到教练工作台</p>
            </nav>
          </dialog>
        </div>
      </div>
    </header>
  );
}
