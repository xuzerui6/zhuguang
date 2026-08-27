import { FileCheck2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import styles from "../_components/public-pages.module.css";

export const metadata: Metadata = {
  description: "逐光运动教练服务平台用户服务协议。",
  title: "用户服务协议 | 逐光",
};

export default function TermsPage() {
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <section className={styles.pageIntro}>
          <p>用户服务协议</p>
          <h1>预约之前，先把平台与<br />训练服务边界说清楚</h1>
          <span>更新日期：2026 年 8 月 27 日 · 生效日期：2026 年 8 月 27 日</span>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>01 / 平台服务</p><h2>逐光提供信息核验和预约协作工具</h2></div>
          <div className={styles.guaranteeCopy}><p>逐光帮助学员查找经过平台审核并处于上线状态的教练，提交训练时间与地点申请，记录确认、改期、取消、完成和售后过程。</p><p>平台展示的经历、荣誉和资质来自教练提交并经人工核验的材料。训练效果会受到身体条件、训练投入和方案执行等因素影响，平台与教练均不得承诺确定成绩。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>02 / 账号与身份</p><h2>使用真实、可联系的账号信息</h2></div>
          <div className={styles.guaranteeCopy}><p>用户应妥善保管验证码和登录设备，不得转让账号或冒用他人身份。教练工作台仅向人工审核并完成账号绑定的教练开放。</p><p>涉及未成年学员时，应由监护人负责创建档案、确认训练安排并评估身体状况。请勿在公共资料或无关消息中提交身份证件、病历等不必要信息。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>03 / 预约与费用</p><h2>教练确认后生效，费用采用线下支付</h2></div>
          <div className={styles.guaranteeCopy}><p>学员选择未来时间、时长与地点后提交申请；教练确认，或双方确认改期方案后，预约才正式生效。提交时生成的费用快照不受之后价格调整影响。</p><p>当前平台不代收训练费用。取消、退款或补课以预约确认页、双方确认记录和当时有效的服务规则为准；争议可通过关联预约的售后工单处理。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>04 / 安全与行为</p><h2>身体安全优先于训练计划</h2></div>
          <div className={styles.guaranteeCopy}><p>学员应如实说明影响训练安全的重要情况，并在不适时立即停止训练。教练应在资质和能力范围内提供服务，不得实施危险、侮辱、歧视或与训练无关的不当行为。</p><p>禁止发布虚假资料、骚扰他人、绕过权限、破坏系统或利用平台从事违法活动。平台可对风险账号限制功能、下线教练或暂停服务，并保留必要审计记录。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>05 / 变更与联系</p><h2>重要规则变更会提供明确提示</h2></div>
          <div className={styles.guaranteeCopy}><p>协议更新会记录版本和生效日期；涉及主要权利义务的变化会通过站内方式提示。继续使用前，你可以查看新版本并决定是否接受。</p><p>服务、隐私或安全问题可登录后提交站内工单。个人信息处理规则请查看<Link href="/privacy">《隐私政策》</Link>。</p></div>
        </section>
        <section className={styles.pageCta}><FileCheck2 aria-hidden size={28} /><div><h2>记录清楚，协作才更可靠</h2><p>预约、改期和售后处理均以平台状态与双方确认记录为依据。</p></div><ShieldCheck aria-hidden size={24} /></section>
      </main>
      <PublicFooter />
    </>
  );
}
