import Link from "next/link";
import { Brand } from "./brand";
import styles from "./public-site.module.css";

export function PublicFooter() {
  const publicDetails = [
    detail("经营主体", process.env.SITE_OPERATOR_NAME),
    detail("客服邮箱", process.env.SITE_SUPPORT_EMAIL, "email"),
    detail("客服电话", process.env.SITE_SUPPORT_PHONE, "phone"),
    detail("投诉联系", process.env.SITE_COMPLAINT_CONTACT),
  ].filter((item): item is { href?: string; label: string; value: string } => Boolean(item));
  const icpNumber = process.env.SITE_ICP_NUMBER?.trim();
  const publicSecurityNumber = process.env.SITE_PUBLIC_SECURITY_NUMBER?.trim();
  const publicSecurityUrl = safeHttpsUrl(process.env.SITE_PUBLIC_SECURITY_URL);
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div className={styles.footerBrand}>
          <Brand />
          <p>连接经过审核的专业教练与学员家庭，让训练选择更透明，让每一次课程都有记录。</p>
          <span>北京、吉林长春服务</span>
        </div>
        <div>
          <strong>寻找服务</strong>
          <Link href="/coaches">浏览教练</Link>
          <Link href="/#training-plans">训练方案</Link>
          <Link href="/service-guarantee">服务保障</Link>
          <Link href="/download">下载 Android App</Link>
        </div>
        <div>
          <strong>平台合作</strong>
          <Link href="/coach-partnership">教练合作</Link>
          <Link href="/login">教练工作台</Link>
          <Link href="/login">运营工作台</Link>
        </div>
        <div>
          <strong>服务说明</strong>
          <Link href="/privacy">隐私政策</Link>
          <Link href="/terms">用户服务协议</Link>
          <Link href="/service-guarantee#booking">预约与取消规则</Link>
          <Link href="/service-guarantee#feedback">意见反馈</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <div><span>© 2026 逐光运动教练服务平台</span><span>官网公开浏览 · 平台登录使用</span></div>
        {publicDetails.length ? <div className={styles.footerBusiness}>{publicDetails.map((item) => <span key={item.label}>{item.label}：{item.href ? <a href={item.href}>{item.value}</a> : item.value}</span>)}</div> : null}
        {icpNumber || publicSecurityNumber ? <div className={styles.footerFilings}>{icpNumber ? <a href="https://beian.miit.gov.cn/" rel="noreferrer" target="_blank">{icpNumber}</a> : null}{publicSecurityNumber ? publicSecurityUrl ? <a href={publicSecurityUrl} rel="noreferrer" target="_blank">{publicSecurityNumber}</a> : <span>{publicSecurityNumber}</span> : null}</div> : null}
      </div>
    </footer>
  );
}

function detail(label: string, input: string | undefined, kind?: "email" | "phone") {
  const value = input?.trim();
  if (!value) return null;
  if (kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) ? { href: `mailto:${value}`, label, value } : null;
  if (kind === "phone") return /^[+\d][\d\s()-]{5,30}$/u.test(value) ? { href: `tel:${value.replace(/[^+\d]/gu, "")}`, label, value } : null;
  return { label, value };
}

function safeHttpsUrl(input: string | undefined) {
  if (!input?.trim()) return undefined;
  try {
    const url = new URL(input);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
