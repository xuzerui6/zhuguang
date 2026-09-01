import Link from "next/link";
import { Brand } from "./brand";
import styles from "./public-site.module.css";

export function PublicFooter() {
  const publicDetails = [
    process.env.SITE_OPERATOR_NAME ? { label: "经营主体", value: process.env.SITE_OPERATOR_NAME } : null,
    process.env.SITE_SUPPORT_EMAIL ? { label: "客服邮箱", value: process.env.SITE_SUPPORT_EMAIL } : null,
    process.env.SITE_SUPPORT_PHONE ? { label: "客服电话", value: process.env.SITE_SUPPORT_PHONE } : null,
    process.env.SITE_COMPLAINT_CONTACT ? { label: "投诉联系", value: process.env.SITE_COMPLAINT_CONTACT } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const icpNumber = process.env.SITE_ICP_NUMBER?.trim();
  const publicSecurityNumber = process.env.SITE_PUBLIC_SECURITY_NUMBER?.trim();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div className={styles.footerBrand}>
          <Brand />
          <p>连接经过审核的专业教练与学员家庭，让训练选择更透明，让每一次课程都有记录。</p>
          <span>北京试点服务</span>
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
        {publicDetails.length ? <div className={styles.footerBusiness}>{publicDetails.map((item) => <span key={item.label}>{item.label}：{item.value}</span>)}</div> : null}
        {icpNumber || publicSecurityNumber ? <div className={styles.footerFilings}>{icpNumber ? <a href="https://beian.miit.gov.cn/" rel="noreferrer" target="_blank">{icpNumber}</a> : null}{publicSecurityNumber ? <span>{publicSecurityNumber}</span> : null}</div> : null}
      </div>
    </footer>
  );
}
