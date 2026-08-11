import { ArrowRight, BriefcaseBusiness, GraduationCap, LockKeyhole, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../_components/brand";
import styles from "../_components/public-pages.module.css";
import { chatGPTSignInPath } from "../chatgpt-auth";
import { getWebSession } from "../_lib/web-session";

export const metadata: Metadata = {
  description: "登录逐光运动教练服务平台，进入学员、教练或运营工作台。",
  title: "登录 | 逐光",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/student";
  const session = await getWebSession();
  const signedIn = session.isAuthenticated;

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginHeader}><Brand /><Link href="/">返回官网</Link></div>
      <section className={styles.loginPanel}>
        <div className={styles.loginIntro}>
          <LockKeyhole aria-hidden size={30} />
          <h1>{signedIn ? "选择工作模式" : "登录逐光"}</h1>
          <p>{signedIn ? "同一账号可在已授权的工作模式之间切换，无需重复登录。" : "官网内容可直接浏览；登录后根据账号权限进入学员服务或工作台。"}</p>
          {signedIn ? <span>当前账号：{session.email}</span> : null}
        </div>
        {signedIn ? (
          <div className={styles.modeChoices}>
            {session.availableAreas.includes("student") ? <Link href={requested.startsWith("/student") ? requested : "/student"}><GraduationCap aria-hidden size={22} /><span><strong>学员服务</strong><small>找教练、预约、消息与训练档案</small></span><ArrowRight aria-hidden size={18} /></Link> : null}
            {session.availableAreas.includes("coach") ? <Link href={requested.startsWith("/coach-workspace") ? requested : "/coach-workspace"}><BriefcaseBusiness aria-hidden size={22} /><span><strong>教练工作台</strong><small>预约、排期、课程与线下收款</small></span><ArrowRight aria-hidden size={18} /></Link> : null}
            {session.availableAreas.includes("ops") ? <Link href={requested.startsWith("/ops") ? requested : "/ops"}><Settings2 aria-hidden size={22} /><span><strong>运营工作台</strong><small>匹配、履约、教练审核与平台管理</small></span><ArrowRight aria-hidden size={18} /></Link> : null}
          </div>
        ) : (
          <Link className={styles.primaryLogin} href={chatGPTSignInPath(requested)}>验证身份并登录 <ArrowRight aria-hidden size={18} /></Link>
        )}
        <p className={styles.loginNote}>登录代表你已阅读并同意服务协议和隐私说明。</p>
      </section>
    </main>
  );
}
