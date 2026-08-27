import Link from "next/link";
import { Brand } from "./brand";
import styles from "./public-site.module.css";

export function PublicFooter() {
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
        <span>© 2026 逐光运动教练服务平台</span>
        <span>官网公开浏览 · 平台登录使用</span>
      </div>
    </footer>
  );
}
