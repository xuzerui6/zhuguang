import { ArrowRight, BriefcaseBusiness, CheckCircle2, GraduationCap, LockKeyhole, Settings2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../_components/brand";
import styles from "../_components/public-pages.module.css";
import { getWebSession } from "../_lib/web-session";
import { EmailLoginForm } from "./email-login-form";

const productionTurnstileSiteKey = "0x4AAAAAAEM50c0fGqXTnUvL";

export const metadata: Metadata = {
  description: "登录逐光运动教练服务平台，进入学员、教练或运营工作台。",
  title: "登录 | 逐光",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/student";
  const session = await getWebSession();
  const accessEnabled = process.env.CF_ACCESS_ENABLED === "true";

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginHeader}><Brand /><Link href="/">返回官网</Link></div>
      <section className={styles.loginShell}>
        <aside className={styles.loginContext}>
          <span>逐光统一账号</span>
          <h1>一个账号，连接训练服务与工作台</h1>
          <p>学员、认证教练和运营人员使用同一邮箱身份，系统只展示当前账号被授权的功能。</p>
          <ul>
            <li><CheckCircle2 aria-hidden size={18} /><span><strong>身份统一</strong><small>无需为不同工作模式重复注册</small></span></li>
            <li><ShieldCheck aria-hidden size={18} /><span><strong>服务端鉴权</strong><small>菜单与业务接口执行同一权限规则</small></span></li>
          </ul>
        </aside>
        <div className={styles.loginPanel}>
          <div className={styles.loginIntro}>
          <LockKeyhole aria-hidden size={30} />
          <h1>{session.isAuthenticated ? "选择工作模式" : "登录逐光"}</h1>
          <p>{session.isAuthenticated ? "同一账号可在已授权的工作模式之间切换，无需重复登录。" : "浏览教练无需注册；收藏同步、咨询和预约时再登录。"}</p>
          {session.isAuthenticated ? <span>当前账号：{session.email || session.displayName}</span> : null}
          </div>
          {session.isAuthenticated ? (
          <div className={styles.modeChoices}>
            {session.availableAreas.includes("student") ? <Link href={requested.startsWith("/student") ? requested : "/student"}><GraduationCap aria-hidden size={22} /><span><strong>学员服务</strong><small>找教练、预约、消息与训练档案</small></span><ArrowRight aria-hidden size={18} /></Link> : null}
            {session.availableAreas.includes("coach") ? <Link href={requested.startsWith("/coach-workspace") ? requested : "/coach-workspace"}><BriefcaseBusiness aria-hidden size={22} /><span><strong>教练工作台</strong><small>预约、排期、课程与线下收款</small></span><ArrowRight aria-hidden size={18} /></Link> : null}
            {session.availableAreas.includes("ops") ? <Link href={requested.startsWith("/ops") ? requested : "/ops"}><Settings2 aria-hidden size={22} /><span><strong>运营工作台</strong><small>线索、履约、教练审核与平台管理</small></span><ArrowRight aria-hidden size={18} /></Link> : null}
          </div>
          ) : <EmailLoginForm returnTo={requested} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || productionTurnstileSiteKey} />}
          {!session.isAuthenticated && accessEnabled ? <details className={styles.loginFallback}><summary>登录遇到问题</summary><p>邮箱服务暂时不可用时，可通过受保护的应急通道验证身份。</p><Link href={`/access-recovery?next=${encodeURIComponent(requested)}`}>使用 Cloudflare Access 应急登录 <ArrowRight aria-hidden size={16} /></Link></details> : null}
          <p className={styles.loginNote}>登录代表你已阅读并同意服务协议和隐私说明。</p>
        </div>
      </section>
    </main>
  );
}
