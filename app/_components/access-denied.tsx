"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { refreshPlatformSession } from "./platform-client";
import { Brand } from "./brand";
import styles from "./access-denied.module.css";

const areaLabels = {
  coach: "教练工作台",
  ops: "运营工作台",
  student: "学员平台",
} as const;

export function AccessDenied({ area, authenticated, unavailable = false, recoverable = false }: { area: keyof typeof areaLabels; authenticated: boolean; unavailable?: boolean; recoverable?: boolean }) {
  const router = useRouter();
  const attempted = useRef(false);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  useEffect(() => {
    if (!recoverable || attempted.current) return;
    attempted.current = true;
    void refreshPlatformSession().then((ok) => { setRecoveryFailed(true); if (ok) router.refresh(); });
  }, [recoverable, router]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const requestedPath = `${pathname}${query ? `?${query}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(requestedPath)}`;

  if (unavailable || recoverable) return <main className={styles.page}><header><Brand /></header><section>
    <span className={styles.icon}><LockKeyhole aria-hidden size={26} /></span>
    <h1>{unavailable ? "暂时无法连接身份服务" : recoveryFailed ? "登录状态需要重试" : "正在恢复登录状态"}</h1>
    <p role="status">{unavailable ? "登录信息已保留，请稍后重试。" : recoveryFailed ? "未能恢复页面，可以重试或重新登录。" : "正在安全续期，原页面和操作选择会保留。"}</p>
    <div><button className={styles.primary} onClick={() => window.location.reload()} type="button">重新加载</button><Link href={loginHref}>重新登录</Link><Link href="/">返回官网</Link></div>
  </section></main>;

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
