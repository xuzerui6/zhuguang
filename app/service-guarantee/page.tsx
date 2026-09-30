import { ArrowRight, CalendarCheck2, FileCheck2, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import styles from "../_components/public-pages.module.css";

export const metadata: Metadata = {
  description: "了解逐光的教练核验、预约确认、隐私保护和服务反馈机制。",
  title: "服务保障 | 逐光",
};

export default function ServiceGuaranteePage() {
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <section className={styles.pageIntro}>
          <p>服务保障</p>
          <h1>把选择依据和服务边界<br />在预约前说清楚</h1>
          <span>逐光提供信息核验和履约记录，但训练效果仍取决于教练方案、学员投入与身体条件。</span>
        </section>
        <section className={styles.principles}>
          <article><UserRoundCheck aria-hidden size={26} /><strong>身份可确认</strong><p>审核教练身份、运动经历、资质材料与服务场地。</p></article>
          <article><FileCheck2 aria-hidden size={26} /><strong>信息有依据</strong><p>价格、时长、训练地点和接单状态在提交前明确展示。</p></article>
          <article><CalendarCheck2 aria-hidden size={26} /><strong>状态可追踪</strong><p>预约、确认、改期、取消和完成均形成服务记录。</p></article>
          <article><LockKeyhole aria-hidden size={26} /><strong>隐私有边界</strong><p>敏感资料只对履约所需角色开放，锁屏通知不展示未成年人姓名。</p></article>
        </section>
        <section className={styles.guaranteeBand} id="booking">
          <div><p>01 / 预约与履约</p><h2>教练确认后，预约才正式生效</h2></div>
          <div className={styles.guaranteeCopy}>
            <p>学员提交预约时会看到场地、时间、费用快照和取消规则。教练确认后双方收到状态通知；如需改期，必须由另一方重新确认。</p>
            <p>首版采用线下支付，平台不代收训练费用。教练完成课程后标记履约和收款，学员可查看训练记录。</p>
          </div>
        </section>
        <section className={styles.guaranteeBand} id="privacy">
          <div><p>02 / 隐私与安全</p><h2>只收集完成服务所必需的信息</h2></div>
          <div className={styles.guaranteeCopy}>
            <p>手机号用于账号验证和关键状态通知；学员档案用于教练了解训练目标与必要健康提示，不用于公开展示。</p>
            <p>教练资质原件限制访问，公开页面只展示核验结论。涉及未成年人的沟通与课程信息采用更严格的最小展示原则。</p>
          </div>
        </section>
        <section className={styles.guaranteeBand} id="feedback">
          <div><p>03 / 反馈与处理</p><h2>问题进入记录，不靠口头承诺消失</h2></div>
          <div className={styles.guaranteeCopy}>
            <p>学员和教练可在消息与订单中提交情况说明。运营人员按预约事件、沟通记录和双方材料核实处理。</p>
            <p>北京与吉林长春服务期间，服务异常由运营团队人工跟进，涉及安全风险时立即暂停相关教练的新增预约。</p>
          </div>
        </section>
        <section className={styles.guaranteeBand} id="verification">
          <div><p>04 / 教练核验</p><h2>公开核验结论，不公开敏感原件</h2></div>
          <div className={styles.guaranteeCopy}>
            <p>平台根据教练实际提供的身份、运动经历、证书资质和训练场地材料进行人工核对。公开页面只展示已经确认的信息和核验状态，资质原件通过受控接口保存。</p>
            <p>学员对公开信息存在疑问时，可以通过咨询或售后工单申请复核；资料发生变更时，公开版本必须经过运营审核后才会更新。</p>
          </div>
        </section>
        <section className={styles.guaranteeBand} id="training-safety">
          <div><p>05 / 训练安全</p><h2>场地、身体状态和监护责任需要共同确认</h2></div>
          <div className={styles.guaranteeCopy}>
            <p>学员可选择已审核合作场馆或提出期望地点，最终训练地点由双方确认。非平台管理场地的开放条件、设施安全和使用规则由场地方及使用人共同核对。</p>
            <p>未成年学员建议由监护人陪同。出现疼痛、眩晕、呼吸困难或其他身体不适时应立即停止训练，并根据实际情况寻求专业医疗帮助。</p>
          </div>
        </section>
        <section className={styles.pageCta}>
          <ShieldCheck aria-hidden size={28} />
          <div><h2>准备好开始选择教练了吗？</h2><p>先浏览完整档案，再为适合的时间提交试课申请。</p></div>
          <Link href="/coaches">查看北京教练 <ArrowRight aria-hidden size={17} /></Link>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
