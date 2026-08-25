import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  ClipboardCheck,
  MapPin,
  PlayCircle,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";
import { AppDownloadClient } from "./_components/app-download-client";
import { ServiceLeadForm } from "./_components/service-lead-form";
import { CoachSpotlightCarousel } from "./_components/coach-spotlight-carousel";
import { MotionCoordinator } from "./_components/motion-coordinator";
import { ProductFilm } from "./_components/product-film";
import { ProductFilmLink } from "./_components/product-film-link";
import styles from "./_components/public-site.module.css";
import { productFilm } from "./_lib/product-film";
import { loadPublicCoaches } from "./_lib/web-platform";
import { TRAINING_GOAL_OPTIONS } from "../shared/coach-catalog";

type HomePageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: HomePageProps) {
  const catalog = await loadPublicCoaches();
  const params = await searchParams;
  const requestedCoachId = Number(Array.isArray(params?.coach) ? params?.coach[0] : params?.coach);
  const requestedCoach = catalog.find((coach) => coach.id === requestedCoachId && coach.canConsult);
  const featuredCoaches = catalog.filter((item) => item.profileKind === "real").slice(0, 3);
  const productFilmEnabled = process.env.PRODUCT_FILM_ENABLED === "true";
  return (
    <>
      <PublicHeader />
      <main>
        <MotionCoordinator />
        <section className={styles.hero}>
          <picture className={styles.heroMedia}>
            <source srcSet="/images/hero-athletics-v2.avif" type="image/avif" />
            <source srcSet="/images/hero-athletics-v2.webp" type="image/webp" />
            <img alt="田径教练在起跑线上指导青少年运动员" fetchPriority="high" src="/images/hero-athletics-v2.webp" />
          </picture>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.heroKicker}>北京 · 专业运动训练服务</p>
              <h1>逐光运动教练<br />服务平台</h1>
              <p>认真核验教练资料，把选择、沟通、预约和训练记录放进同一条清晰的服务流程。</p>
              <div className={styles.heroActions}>
                <Link href="/coaches">寻找教练 <ArrowRight aria-hidden size={18} /></Link>
                {productFilmEnabled ? <ProductFilmLink>看看逐光如何工作 <PlayCircle aria-hidden size={18} /></ProductFilmLink> : null}
              </div>
              <div className={styles.heroTrust} aria-label="平台服务原则">
                <span><BadgeCheck aria-hidden size={18} />人工核验</span>
                <span><CalendarCheck2 aria-hidden size={18} />确认后生效</span>
                <span><ShieldCheck aria-hidden size={18} />隐私保护</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.discoveryBand} aria-labelledby="find-title" data-motion>
          <div>
            <p className="zg-eyebrow">从真实需求出发</p>
            <h2 id="find-title">先说明你要练什么</h2>
          </div>
          <form action="/coaches" className={styles.searchPanel}>
            <label><span>城市</span><select defaultValue="北京" name="city" aria-label="选择城市"><option>北京</option></select></label>
            <label><span>项目</span><select defaultValue="田径" name="sport" aria-label="选择运动项目"><option>田径</option><option>羽毛球</option><option>游泳</option><option>网球</option><option>篮球</option><option>体能</option></select></label>
            <label><span>目标</span><select defaultValue="中考体育" name="goal" aria-label="选择训练目标">{TRAINING_GOAL_OPTIONS.map((goal) => <option key={goal}>{goal}</option>)}</select></label>
            <button type="submit"><Search aria-hidden size={18} />查看匹配结果</button>
          </form>
        </section>

        <section className={styles.spotlightSection} data-motion>
          <div className={styles.spotlightHeading}>
            <div><p className="zg-eyebrow">北京试点教练</p><h2 className="zg-section-title">资料真实，比数字热闹更重要</h2></div>
            <p>平台只展示已经提供并可核验的信息。没有评价、课量或经营数据时，会如实说明。</p>
          </div>
          <CoachSpotlightCarousel count={featuredCoaches.length}>
            {featuredCoaches.map((coach) => (
              <article className={styles.spotlightCard} data-motion="card" key={coach.id}>
                <Link className={styles.spotlightCardMedia} href={`/coaches/${coach.id}`}>
                  <Image alt={`${coach.name}教练`} fill sizes="(max-width: 760px) 82vw, (max-width: 1100px) 46vw, 31vw" src={coach.media.cardUrl || coach.image} unoptimized />
                  <span><BadgeCheck aria-hidden size={15} />{coach.verificationLabel}</span>
                </Link>
                <div className={styles.spotlightCardBody}>
                  <div className={styles.spotlightCardIdentity}>
                    <div><h3>{coach.name}</h3><p>{coach.title}</p></div>
                    <strong>{coach.experience}年<small>执教</small></strong>
                  </div>
                  <p className={styles.coachLocation}><MapPin aria-hidden size={16} />{coach.district} · {coach.venue}</p>
                  <p className={styles.spotlightHonor}>{coach.honors.slice(0, 2).join(" · ")}</p>
                  <div className={styles.coachStrengths}>{coach.strengths.slice(0, 3).map((item) => <span key={item}><Check aria-hidden size={14} />{item}</span>)}</div>
                  <div className={styles.spotlightCardFooter}>
                    <span><small>常规课</small><strong>{coach.price === undefined ? "待发布" : `¥${coach.price}`}</strong></span>
                    <span><small>试课</small><strong>{coach.trialPrice === undefined ? "待发布" : `¥${coach.trialPrice}`}</strong></span>
                    <Link href={`/coaches/${coach.id}`} aria-label={`查看${coach.name}完整档案`}><ArrowRight aria-hidden size={19} /></Link>
                  </div>
                </div>
              </article>
            ))}
          </CoachSpotlightCarousel>
        </section>

        {productFilmEnabled ? (
          <section className={styles.filmSection} data-motion id="product-film">
            <div className={styles.filmHeading}>
              <div><p className="zg-eyebrow">逐光如何工作</p><h2 className="zg-section-title">从选择教练，到看见每一次进步</h2></div>
              <p>把真实需求、教练档案、服务确认和训练记录连在一起。不是一段广告，而是逐光正在使用的服务方式。</p>
            </div>
            <ProductFilm manifest={productFilm} />
          </section>
        ) : null}

        <section className={styles.processSection} data-motion>
          <div className={styles.processIntro}>
            <p className="zg-eyebrow">服务流程</p>
            <h2 className="zg-section-title">每一步有状态，<br />每个决定有依据</h2>
          </div>
          <ol className={styles.processList}>
            <li data-motion="process"><span>01</span><div><strong>明确训练需求</strong><p>项目、区域、时间、预算和训练目标进入同一份需求档案。</p></div></li>
            <li data-motion="process"><span>02</span><div><strong>比较教练档案</strong><p>查看经历、服务对象、训练方向、价格和接单状态。</p></div></li>
            <li data-motion="process"><span>03</span><div><strong>提交服务申请</strong><p>教练确认后预约生效，首版采用线下支付。</p></div></li>
            <li data-motion="process"><span>04</span><div><strong>沉淀训练记录</strong><p>课程状态、沟通与训练记录留在账号中持续可查。</p></div></li>
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
            <Link href="/coaches">按目标筛选教练 <ArrowRight aria-hidden size={17} /></Link>
          </div>
          <div className={styles.planRows}>
            <Link href="/coaches?goal=中考体育"><span>01</span><strong>中考体育</strong><p>围绕测试项目建立动作、体能和节奏计划。</p><ArrowRight aria-hidden size={19} /></Link>
            <Link href="/coaches?goal=短跑专项"><span>02</span><strong>短跑专项</strong><p>拆解起跑、加速、途中跑和冲刺技术。</p><ArrowRight aria-hidden size={19} /></Link>
            <Link href="/coaches?goal=跑姿纠正"><span>03</span><strong>跑姿纠正</strong><p>从动作评估开始改善效率与身体控制。</p><ArrowRight aria-hidden size={19} /></Link>
            <Link href="/coaches?goal=专项体能"><span>04</span><strong>专项体能</strong><p>结合训练目标安排力量、速度和恢复。</p><ArrowRight aria-hidden size={19} /></Link>
          </div>
        </section>

        <section className={styles.downloadBand} data-motion id="app-download" aria-label="下载逐光 Android App">
          <AppDownloadClient compact />
        </section>

        <section className={styles.cooperationSection} data-motion>
          <div><p className="zg-eyebrow">教练合作</p><h2>让真实的运动经历，转化为长期的专业服务</h2><p>逐光当前采用人工邀请与审核，不开放自助注册。审核通过的教练可用同一账号进入独立工作台。</p></div>
          <Link href="/coach-partnership">了解合作方式 <ArrowRight aria-hidden size={18} /></Link>
        </section>

        <section className={styles.inquirySection} data-motion id="service-inquiry">
          <div>
            <p className="zg-eyebrow">训练咨询</p>
            <h2>把需求说清楚，再决定是否预约</h2>
            <p>提交后只进入逐光运营工作台。资料或接单条件尚未完善的教练只提供咨询，不会生成虚假预约。</p>
          </div>
          <ServiceLeadForm coach={requestedCoach ? { id: requestedCoach.id, name: requestedCoach.name, sport: requestedCoach.sport } : undefined} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
