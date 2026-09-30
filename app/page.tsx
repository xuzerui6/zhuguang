import {
  ArrowRight,
  ClipboardCheck,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "./_components/public-footer";
import { AppDownloadClient } from "./_components/app-download-client";
import { HomeCityProvider, HomeHeroCopy, HomeSearchBand, HomeSpotlight, HomeInquiryForm, HomeCityLink, HomePublicHeader } from './_components/home-city-content';
import { MotionCoordinator } from "./_components/motion-coordinator";
import styles from "./_components/public-site.module.css";
import { loadPublicCoaches, loadPublicServiceCatalog } from "./_lib/web-platform";
import { resolveServiceCity } from "../shared/service-cities";

type HomePageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const cityId=resolveServiceCity(typeof params?.city==="string"?params.city:undefined);
  const [catalog, serviceCatalog] = await Promise.all([loadPublicCoaches(cityId),loadPublicServiceCatalog(cityId)]);
  const requestedCoachId = Number(Array.isArray(params?.coach) ? params?.coach[0] : params?.coach);
  return (
    <>
      <HomeCityProvider key={`${cityId}:${requestedCoachId || ''}`} initial={{ cityId, coaches: catalog, catalog: serviceCatalog }} initialCoachId={requestedCoachId || undefined}>
      <HomePublicHeader />
      <main>
        <MotionCoordinator />
        <section className={styles.hero}>
          <picture className={styles.heroMedia}>
            <source srcSet="/images/hero-athletics-v2.avif" type="image/avif" />
            <source srcSet="/images/hero-athletics-v2.webp" type="image/webp" />
            <img alt="田径教练在起跑线上指导青少年运动员" fetchPriority="high" src="/images/hero-athletics-v2.webp" />
          </picture>
          <div className={styles.heroInner}>
            <HomeHeroCopy />
          </div>
        </section>

        <HomeSearchBand />
        <HomeSpotlight />

        <section className={styles.processSection} data-motion>
          <div className={styles.processIntro}>
            <p className="zg-eyebrow">服务流程</p>
            <h2 className="zg-section-title">每一步有状态，<br />每个决定有依据</h2>
          </div>
          <ol className={styles.processList}>
            <li data-motion="process"><span>01</span><div><strong>告诉我们训练目标</strong><p>选择项目、区域和目标，也可以先提交需求让运营协助梳理。</p></div></li>
            <li data-motion="process"><span>02</span><div><strong>比较已核验教练</strong><p>查看经历、服务对象、训练方向、价格和当前接单状态。</p></div></li>
            <li data-motion="process"><span>03</span><div><strong>提出时间与地点</strong><p>选择合作场馆或填写期望地点，由教练确认或提出调整方案。</p></div></li>
            <li data-motion="process"><span>04</span><div><strong>确认后开始训练</strong><p>预约、沟通、线下支付状态和训练记录都在账号中持续可查。</p></div></li>
          </ol>
        </section>

        <section className={styles.trustSection} data-motion>
          <div className={styles.trustMedia}><Image alt="专业教练在球场指导训练" fill sizes="(max-width: 820px) 100vw, 50vw" src="/coach-visual-v23.webp" unoptimized /></div>
          <div className={styles.trustCopy}>
            <p className="zg-eyebrow">服务保障</p>
            <h2 className="zg-section-title">把专业能力与服务责任放在一起</h2>
            <p className="zg-section-copy">身份和履历核验只是开始。逐光继续记录预约确认、课程状态、沟通与资料变更，让服务过程可追溯。</p>
            <div className={styles.trustRows}>
              <article><ClipboardCheck aria-hidden size={24} /><div><strong>资料人工复核</strong><p>公开内容只使用教练提供且平台确认过的信息。</p></div></article>
              <article><UsersRound aria-hidden size={24} /><div><strong>未成年人信息克制展示</strong><p>只收集履约所需信息，锁屏通知不显示未成年人姓名。</p></div></article>
              <article><ShieldCheck aria-hidden size={24} /><div><strong>敏感资料受控访问</strong><p>资质原件和账户信息不通过公开存储地址暴露。</p></div></article>
            </div>
            <Link className={styles.textButton} href="/service-guarantee">查看完整保障说明 <ArrowRight aria-hidden size={17} /></Link>
          </div>
        </section>

        <section className={styles.plansSection} data-motion id="training-plans">
          <div className={styles.sectionHeading}>
            <div><p className="zg-eyebrow">训练方案</p><h2 className="zg-section-title">目标不同，路径也应该不同</h2></div>
            <HomeCityLink href="/coaches">按目标筛选教练 <ArrowRight aria-hidden size={17} /></HomeCityLink>
          </div>
          <div className={styles.planRows}>
            <HomeCityLink href="/coaches?goal=中考体育"><span>01</span><strong>中考体育</strong><p>围绕测试项目建立动作、体能和节奏计划。</p><ArrowRight aria-hidden size={19} /></HomeCityLink>
            <HomeCityLink href="/coaches?goal=短跑专项"><span>02</span><strong>短跑专项</strong><p>拆解起跑、加速、途中跑和冲刺技术。</p><ArrowRight aria-hidden size={19} /></HomeCityLink>
            <HomeCityLink href="/coaches?goal=跑姿纠正"><span>03</span><strong>跑姿纠正</strong><p>从动作评估开始改善效率与身体控制。</p><ArrowRight aria-hidden size={19} /></HomeCityLink>
            <HomeCityLink href="/coaches?goal=专项体能"><span>04</span><strong>专项体能</strong><p>结合训练目标安排力量、速度和恢复。</p><ArrowRight aria-hidden size={19} /></HomeCityLink>
          </div>
        </section>

        <section className={styles.cooperationSection} data-motion>
          <div><p className="zg-eyebrow">教练合作</p><h2>让真实的运动经历，转化为长期的专业服务</h2><p>教练可在 Android App 或微信小程序提交完整入驻申请。运营核验通过后，同一账号即可进入教练工作台。</p></div>
          <Link href="/coach-partnership">了解合作方式 <ArrowRight aria-hidden size={18} /></Link>
        </section>

        <section className={styles.inquirySection} data-motion id="service-inquiry">
          <div>
            <p className="zg-eyebrow">训练咨询</p>
            <h2>把需求说清楚，再决定是否预约</h2>
            <p>咨询不收费，也不会自动生成预约。提交后只进入逐光运营工作台，运营核对需求后通过你留下的手机号或微信联系。</p>
          </div>
          <HomeInquiryForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </section>

        <section className={styles.downloadBand} data-motion id="app-download" aria-label="下载逐光 Android App">
          <AppDownloadClient compact />
        </section>
      </main>
      </HomeCityProvider>
      <PublicFooter />
    </>
  );
}
