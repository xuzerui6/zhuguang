import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ChevronRight,
  ClipboardList,
  LocateFixed,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";
import styles from "./_components/public-site.module.css";
import { coaches } from "./_lib/web-platform";

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <picture className={styles.heroMedia}>
            <source srcSet="/images/hero-coaching.avif" type="image/avif" />
            <source srcSet="/images/hero-coaching.webp" type="image/webp" />
            <img alt="" fetchPriority="high" src="/images/hero-coaching.webp" />
          </picture>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1>专业运动教练<br />服务平台</h1>
              <p>连接经过资料核验的退役运动员教练，为学员家庭提供透明、可预约、可持续的训练服务。</p>
              <form action="/coaches" className={styles.searchPanel}>
                <label>
                  <MapPin aria-hidden size={18} />
                  <span>城市</span>
                  <select defaultValue="北京" name="city" aria-label="选择城市">
                    <option>北京</option>
                  </select>
                </label>
                <label>
                  <LocateFixed aria-hidden size={18} />
                  <span>运动项目</span>
                  <select defaultValue="羽毛球" name="sport" aria-label="选择运动项目">
                    <option>羽毛球</option>
                    <option>游泳</option>
                    <option>篮球</option>
                    <option>体能</option>
                  </select>
                </label>
                <label>
                  <Sparkles aria-hidden size={18} />
                  <span>训练目标</span>
                  <select defaultValue="专项提升" name="goal" aria-label="选择训练目标">
                    <option>专项提升</option>
                    <option>兴趣培养</option>
                    <option>体能强化</option>
                    <option>比赛备战</option>
                  </select>
                </label>
                <button type="submit"><Search aria-hidden size={18} />查找教练</button>
              </form>
              <Link className={styles.guaranteeLink} href="/service-guarantee">
                了解服务保障 <ArrowRight aria-hidden size={16} />
              </Link>
              <div className={styles.heroTrust} aria-label="平台保障">
                <span><BadgeCheck aria-hidden size={20} />身份与履历人工核验</span>
                <span><ClipboardList aria-hidden size={20} />匹配理由透明</span>
                <span><CalendarCheck2 aria-hidden size={20} />教练确认后生效</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.coachSection}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="zg-eyebrow">北京私有试点</p>
              <h2 className="zg-section-title">值得认真了解的教练</h2>
              <p className="zg-section-copy">先看清经历、专长、场馆和可约时间，再决定是否开始试课。</p>
            </div>
            <Link href="/coaches">查看全部教练 <ArrowRight aria-hidden size={17} /></Link>
          </div>
          <div className={styles.coachGrid}>
            {coaches.slice(0, 3).map((coach) => (
              <Link className={styles.coachCard} href={`/coaches/${coach.id}`} key={coach.id}>
                <div className={styles.coachImage}>
                  <Image alt={`${coach.name}教练`} fill sizes="(max-width: 767px) 42vw, 300px" src={coach.image} unoptimized />
                </div>
                <div className={styles.coachInfo}>
                  <div className={styles.coachNameRow}>
                    <h3>{coach.name}</h3>
                    <span><BadgeCheck aria-hidden size={15} />资料已核验</span>
                  </div>
                  <p>{coach.sport} · {coach.title}</p>
                  <p><MapPin aria-hidden size={14} />{coach.district} · {coach.venue}</p>
                  <div className={styles.coachMeta}>
                    <span><Star aria-hidden fill="currentColor" size={14} />{coach.rating}</span>
                    <span>最近可约 {coach.nextSlot}</span>
                  </div>
                </div>
                <ChevronRight aria-hidden className={styles.cardArrow} size={20} />
              </Link>
            ))}
          </div>
          <p className={styles.dataNote}>教练履历与资质状态将在服务前持续复核。</p>
        </section>

        <section className={styles.processSection}>
          <div className={styles.processIntro}>
            <p className="zg-eyebrow">从选择到上课</p>
            <h2 className="zg-section-title">每一步都清楚，选择才更踏实</h2>
          </div>
          <ol className={styles.processList}>
            <li><span>01</span><div><strong>说明训练需求</strong><p>选择项目、区域、时间、预算和训练目标。</p></div></li>
            <li><span>02</span><div><strong>比较真实档案</strong><p>查看资质、经历、场馆、价格与可约时段。</p></div></li>
            <li><span>03</span><div><strong>提交试课预约</strong><p>确认学员档案、场地和费用快照后提交。</p></div></li>
            <li><span>04</span><div><strong>教练确认后上课</strong><p>双方在站内沟通，课程完成后形成训练记录。</p></div></li>
          </ol>
        </section>

        <section className={styles.trustSection}>
          <div className={styles.trustMedia}>
            <Image alt="教练在篮球场指导青少年训练" fill sizes="(max-width: 820px) 100vw, 50vw" src="/coach-visual-v23.webp" unoptimized />
          </div>
          <div className={styles.trustCopy}>
            <p className="zg-eyebrow">服务保障</p>
            <h2 className="zg-section-title">不只帮你找到教练，也把服务过程说明白</h2>
            <p className="zg-section-copy">逐光把身份核验、预约确认、线下付款说明和课程记录放进同一条服务流程。</p>
            <div className={styles.trustRows}>
              <article><ShieldCheck aria-hidden size={24} /><div><strong>资质与经历核验</strong><p>平台人工复核身份、运动经历、教练资质和服务场地。</p></div></article>
              <article><CalendarCheck2 aria-hidden size={24} /><div><strong>预约状态可追踪</strong><p>提交、确认、改期、取消和完成都有明确状态与通知。</p></div></article>
              <article><UsersRound aria-hidden size={24} /><div><strong>未成年人信息保护</strong><p>只收集完成服务所需信息，敏感资料限制访问和展示。</p></div></article>
            </div>
            <Link className={styles.textButton} href="/service-guarantee">查看完整保障说明 <ArrowRight aria-hidden size={17} /></Link>
          </div>
        </section>

        <section className={styles.plansSection} id="training-plans">
          <div className={styles.sectionHeading}>
            <div>
              <p className="zg-eyebrow">训练方案</p>
              <h2 className="zg-section-title">目标不同，训练路径也应该不同</h2>
            </div>
            <Link href="/coaches">按目标筛选教练 <ArrowRight aria-hidden size={17} /></Link>
          </div>
          <div className={styles.planRows}>
            <Link href="/coaches?goal=兴趣培养"><span>01</span><strong>兴趣培养</strong><p>建立运动习惯、基础动作和安全意识</p><ArrowRight aria-hidden size={19} /></Link>
            <Link href="/coaches?goal=专项提升"><span>02</span><strong>专项提升</strong><p>针对技术短板进行结构化训练与复盘</p><ArrowRight aria-hidden size={19} /></Link>
            <Link href="/coaches?goal=体能强化"><span>03</span><strong>体能强化</strong><p>改善力量、耐力、协调和动作质量</p><ArrowRight aria-hidden size={19} /></Link>
            <Link href="/coaches?goal=比赛备战"><span>04</span><strong>比赛备战</strong><p>围绕赛程设计训练周期和实战策略</p><ArrowRight aria-hidden size={19} /></Link>
          </div>
        </section>

        <section className={styles.cooperationSection}>
          <div>
            <p className="zg-eyebrow">教练合作</p>
            <h2>让真正专业的运动经历，被需要它的人看见</h2>
            <p>逐光当前采用人工邀请与审核，不开放自助注册。审核通过的教练可使用同一账号进入独立工作台。</p>
          </div>
          <Link href="/coach-partnership">了解合作方式 <ArrowRight aria-hidden size={18} /></Link>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
