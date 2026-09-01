import { LockKeyhole, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";
import styles from "../_components/public-pages.module.css";

export const metadata: Metadata = {
  description: "逐光运动教练服务平台隐私政策与未成年人信息保护说明。",
  title: "隐私政策 | 逐光",
};

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main className={styles.publicPage}>
        <section className={styles.pageIntro}>
          <p>隐私政策</p>
          <h1>只处理完成训练服务<br />真正需要的信息</h1>
          <span>更新日期：2026 年 9 月 1 日 · 生效日期：2026 年 9 月 1 日</span>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>01 / 信息范围</p><h2>账号、训练服务与安全信息</h2></div>
          <div className={styles.guaranteeCopy}><p>我们会处理账号昵称、头像、北京所在区、个性签名、邮箱或手机号、学员档案、预约与改期记录、训练总结、站内消息、收藏、反馈工单，以及保障账号和服务安全所需的设备标识、应用版本和请求日志。</p><p>访客提交训练咨询或教练合作意向时，可以提供手机号、微信号、可选邮箱、北京所在区、年龄段或年级、期望训练时间及需求说明。我们不通过咨询表单收集生日、身份证或精确住址。</p><p>账号头像不进入官网、教练目录或公开评价，仅向本人及已经建立咨询、预约或教练服务关系的相应用户展示；教练公开姓名和照片仍使用独立的审核档案。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>02 / 使用目的</p><h2>用于匹配、预约、履约和服务保障</h2></div>
          <div className={styles.guaranteeCopy}><p>相关信息用于登录验证、教练匹配、预约确认、消息沟通、训练记录、售后处理、风险控制和必要的版本更新。咨询中的年龄段或年级仅用于判断训练方案和服务对象是否合适，期望时间仅用于协调安排。</p><p>我们不会出售个人信息，也不会将训练档案用于与服务无关的广告画像。联系方式加密保存，运营列表默认只显示是否已留联系方式；仅最高权限运营人员在处理具体线索时可以单次查看，查看行为会形成审计记录。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>03 / 服务提供方</p><h2>仅向必要的基础服务传输最少信息</h2></div>
          <div className={styles.guaranteeCopy}><p>逐光使用 Cloudflare 提供网络、数据库和私有对象存储，使用腾讯云提供邮件验证；Android 用户同意后可使用极光推送。iOS 测试版本由 Apple TestFlight 分发，首版不启用原生推送。</p><p>上述服务仅获得完成其功能所需的数据，并受各自安全与隐私规则约束。我们不会公开教练资质原件、学员档案或私人消息。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>04 / 未成年人</p><h2>由监护人创建和管理训练档案</h2></div>
          <div className={styles.guaranteeCopy}><p>未成年学员应由监护人使用账号、提交预约并提供必要信息。锁屏通知和公共页面不展示未成年人姓名、联系方式或训练档案。</p><p>如发现未经监护人同意处理了未成年人信息，请通过站内售后工单联系我们，我们会核实并采取限制访问、更正或删除等措施。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>05 / 保存与权利</p><h2>可查询、更正、撤回授权或申请注销</h2></div>
          <div className={styles.guaranteeCopy}><p>昵称、头像、地区和签名在账号有效期间保存，用于账号识别和服务沟通；站内沟通记录通常保留 90 天用于履约和争议处理，依法或因未结工单需要延长的除外。咨询线索在完成跟进、关闭需求或不再需要后按运营规则清理或去标识化。</p><p>你可以在“我的—账号与隐私”随时更正或移除头像等资料。账号注销后头像对象会删除，账号展示信息会清除；依法需保留的历史履约数据会去标识化并按争议处理规则保存。</p></div>
        </section>
        <section className={styles.pageCta}><LockKeyhole aria-hidden size={28} /><div><h2>需要处理个人信息问题？</h2><p>登录后从账号设置提交隐私工单，运营处理过程会保留状态记录。</p></div><ShieldCheck aria-hidden size={24} /></section>
      </main>
      <PublicFooter />
    </>
  );
}
