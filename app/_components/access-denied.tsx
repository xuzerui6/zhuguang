"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Brand } from "./brand";
import styles from "./access-denied.module.css";

const areaLabels = {
  coach: "教练工作台",
  ops: "运营工作台",
  student: "学员平台",
} as const;

export function AccessDenied({ area, authenticated }: { area: keyof typeof areaLabels; authenticated: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const requestedPath = `${pathname}${query ? `?${query}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(requestedPath)}`;

  return (
    <main className={styles.page}>
      <header><Brand /></header>
      <section>
        <span className={styles.icon}><LockKeyhole aria-hidden size={26} /></span>
        <p>{authenticated ? "访问权限" : "需要登录"}</p>
        <h1>{authenticated ? `当前账号暂不能进入${areaLabels[area]}` : `登录后进入${areaLabels[area]}`}</h1>
        <p>{authenticated ? "工作台内容仅向已授权账号开放。教练资格暂停或角色发生变化时，系统也会自动收回入口。" : "公开页面可以直接浏览，预约、消息与工作台内容需要完成身份登录。"}</p>
        <div>
          <Link className={styles.primary} href={authenticated ? "/student" : loginHref}>{authenticated ? "返回学员平台" : "登录并继续"}</Link>
          <Link href={authenticated ? loginHref : "/"}><ArrowLeft aria-hidden size={16} />{authenticated ? "切换账号" : "返回官网"}</Link>
        </div>
      </section>
    </main>
  );
}
