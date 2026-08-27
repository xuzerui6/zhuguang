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
          <span>更新日期：2026 年 8 月 27 日 · 生效日期：2026 年 8 月 27 日</span>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>01 / 信息范围</p><h2>账号、训练服务与安全信息</h2></div>
          <div className={styles.guaranteeCopy}><p>我们会处理邮箱或手机号、学员档案、预约与改期记录、训练总结、站内消息、收藏、反馈工单，以及保障账号和服务安全所需的设备标识、应用版本和请求日志。</p><p>教练提交的身份、经历、资质和媒体材料仅用于审核及经同意的公开展示；资质原件保存在受控存储中，不作为公共页面资源。</p></div>
        </section>
        <section className={styles.guaranteeBand}>
          <div><p>02 / 使用目的</p><h2>用于匹配、预约、履约和服务保障</h2></div>
          <div className={styles.guaranteeCopy}><p>相关信息用于登录验证、教练匹配、预约确认、消息沟通、训练记录、售后处理、风险控制和必要的版本更新。我们不会出售个人信息，也不会将训练档案用于与服务无关的广告画像。</p><p>账号凭据采用安全存储，敏感资料通过鉴权接口访问；只有完成对应业务所需的学员、教练和运营角色可以查看相应信息。</p></div>
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
          <div className={styles.guaranteeCopy}><p>资料在提供服务和履行法定义务所需期限内保存；站内沟通记录通常保留 90 天用于履约和争议处理，依法或因未结工单需要延长的除外。</p><p>你可以在“我的—账号与隐私”查看和更正资料，或通过站内工单申请导出、更正、删除和注销。注销申请会在核验账号及处理未完成预约后执行。</p></div>
        </section>
        <section className={styles.pageCta}><LockKeyhole aria-hidden size={28} /><div><h2>需要处理个人信息问题？</h2><p>登录后从账号设置提交隐私工单，运营处理过程会保留状态记录。</p></div><ShieldCheck aria-hidden size={24} /></section>
      </main>
      <PublicFooter />
    </>
  );
}
