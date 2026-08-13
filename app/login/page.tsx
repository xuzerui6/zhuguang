import { ArrowRight, BriefcaseBusiness, GraduationCap, LockKeyhole, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../_components/brand";
import styles from "../_components/public-pages.module.css";
import { chatGPTSignInPath } from "../chatgpt-auth";
import { getWebSession } from "../_lib/web-session";
import { EmailLoginForm } from "./email-login-form";

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
      <section className={styles.loginPanel}>
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
        ) : (
          <>
            {accessEnabled ? (
              <Link className={styles.secondaryLogin} href={requested}>使用邮箱验证码登录 <ArrowRight aria-hidden size={18} /></Link>
            ) : (
              <>
                <EmailLoginForm returnTo={requested} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
                <div className={styles.loginDivider}><span>或</span></div>
                <Link className={styles.secondaryLogin} href={chatGPTSignInPath(requested)}>使用已绑定身份登录 <ArrowRight aria-hidden size={18} /></Link>
              </>
            )}
          </>
        )}
        <p className={styles.loginNote}>登录代表你已阅读并同意服务协议和隐私说明。</p>
      </section>
    </main>
  );
}
