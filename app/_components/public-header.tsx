import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import styles from "./public-site.module.css";

const links = [
  { href: "/coaches", label: "找教练" },
  { href: "/service-guarantee", label: "服务保障" },
  { href: "/#training-plans", label: "训练方案" },
  { href: "/coach-partnership", label: "教练合作" },
];

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Brand />
        <nav className={styles.desktopNav} aria-label="官网导航">
          {links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.loginLink} href="/login">登录</Link>
          <Link className={styles.enterButton} href="/login">
            进入平台 <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="打开导航"><Menu aria-hidden size={22} /></summary>
          <nav aria-label="移动端官网导航">
            {links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
            <Link href="/login">登录 / 进入平台</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

