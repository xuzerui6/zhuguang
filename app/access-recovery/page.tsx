import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "../_components/brand";
import styles from "../_components/public-pages.module.css";
import { getWebSession } from "../_lib/web-session";

export const metadata = { title: "应急登录 | 逐光" };

export default async function AccessRecoveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/student";
  const session = await getWebSession();
  if (session.isAuthenticated) redirect(next);
  return <main className={styles.loginPage}><div className={styles.loginHeader}><Brand /><Link href="/login">返回登录</Link></div><section className={styles.recoveryMessage}><h1>应急身份验证未完成</h1><p>请重新进入应急登录，或返回邮箱验证码登录。</p><Link href={`/login?next=${encodeURIComponent(next)}`}>返回登录页</Link></section></main>;
}
