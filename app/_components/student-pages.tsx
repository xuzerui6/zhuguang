import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck2,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CoachDirectory } from "./coach-directory";
import { StudentBookings, StudentMessages } from "./student-workflows";
import { coaches } from "../_lib/web-platform";
import styles from "./student-pages.module.css";

export type StudentSection = "home" | "coaches" | "bookings" | "messages" | "training" | "profile";

export function StudentPage({ initialCoachId, section }: { initialCoachId?: number; section: StudentSection }) {
  if (section === "coaches") return <div className={styles.directoryWrap}><CoachDirectory embedded /></div>;
  if (section === "bookings") return <StudentBookings initialCoachId={initialCoachId} />;
  if (section === "messages") return <StudentMessages />;
  if (section === "training") return <TrainingPage />;
  if (section === "profile") return <ProfilePage />;
  return <StudentHome />;
}

function StudentHome() {
  const coach = coaches[0];
  return (
    <div className={styles.studentPage}>
      <header className={styles.welcome}>
        <div><p>北京 · 周一</p><h1>下午好，继续按计划训练</h1><span>你的下一次羽毛球专项课已确认，课前可以直接联系教练。</span></div>
        <Link href="/student/coaches">继续找教练 <ArrowRight aria-hidden size={17} /></Link>
      </header>

      <section className={styles.nextBooking}>
        <div className={styles.bookingDate}><strong>20</strong><span>8月 / 周四</span></div>
        <div className={styles.bookingMain}>
          <span><CircleCheckBig aria-hidden size={15} />预约已确认</span>
          <h2>羽毛球 · 专项提升训练</h2>
          <p><Clock3 aria-hidden size={15} />18:30–20:00 <MapPin aria-hidden size={15} />朝阳体育中心羽毛球馆</p>
        </div>
        <div className={styles.bookingCoach}>
          <Image alt="周明教练" height={54} src={coach.image} unoptimized width={54} />
          <span><strong>{coach.name}教练</strong><small>{coach.title}</small></span>
        </div>
        <div className={styles.bookingActions}><Link href="/student/messages">联系教练</Link><Link href="/student/bookings">查看预约</Link></div>
      </section>

      <div className={styles.homeGrid}>
        <section className={styles.trainingPlan}>
          <header><div><p>本阶段计划</p><h2>单打步伐与后场稳定性</h2></div><span>第 3 / 8 课</span></header>
          <div className={styles.progress}><i style={{ width: "38%" }} /></div>
          <div className={styles.goalRows}>
            <article><Target aria-hidden size={19} /><div><strong>本周重点</strong><p>启动节奏、回中位置、反手高远球</p></div></article>
            <article><TrendingUp aria-hidden size={19} /><div><strong>最近变化</strong><p>连续多拍稳定性提升，后场移动仍需巩固</p></div></article>
            <article><BookOpenCheck aria-hidden size={19} /><div><strong>课前准备</strong><p>提前 10 分钟到场，完成踝膝热身</p></div></article>
          </div>
          <Link href="/student/training">查看完整训练档案 <ArrowRight aria-hidden size={16} /></Link>
        </section>

        <aside className={styles.activityPanel}>
          <header><h2>需要处理</h2><span>2 项</span></header>
          <Link href="/student/messages"><MessageCircle aria-hidden size={19} /><span><strong>教练发来课前提醒</strong><small>请确认本周四的到场时间</small></span><ChevronRight aria-hidden size={17} /></Link>
          <Link href="/student/profile"><UserRound aria-hidden size={19} /><span><strong>补充学员档案</strong><small>完善伤病与训练经历信息</small></span><ChevronRight aria-hidden size={17} /></Link>
        </aside>
      </div>

      <section className={styles.recommendations}>
        <header><div><p>基于你的训练目标</p><h2>也可以比较这些教练</h2></div><Link href="/student/coaches">查看全部</Link></header>
        <div>
          {coaches.slice(1, 4).map((item) => (
            <Link href={`/coaches/${item.id}`} key={item.id}>
              <Image alt={`${item.name}教练`} height={76} src={item.image} unoptimized width={76} />
              <span><strong>{item.name}<small><BadgeCheck aria-hidden size={13} />已认证</small></strong><p>{item.sport} · {item.title}</p><b>{item.district} · ¥{item.price}/课时</b></span>
              <ChevronRight aria-hidden size={18} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrainingPage() {
  return (
    <div className={styles.studentPage}>
      <header className={styles.pageTitle}><div><p>训练档案</p><h1>看见持续训练带来的变化</h1></div><span>数据由已完成课程记录生成</span></header>
      <section className={styles.trainingSummary}>
        <article><span>已完成课程</span><strong>12</strong><small>累计 16.5 小时</small></article>
        <article><span>连续训练</span><strong>6<small>周</small></strong><small>当前最长连续记录</small></article>
        <article><span>本阶段进度</span><strong>38<small>%</small></strong><small>专项提升 · 第 3 / 8 课</small></article>
        <article><span>教练反馈</span><strong>9</strong><small>3 条标记为重点</small></article>
      </section>
      <div className={styles.trainingLayout}>
        <section className={styles.timelinePanel}>
          <header><h2>课程记录</h2><span>最近 90 天</span></header>
          <div className={styles.trainingTimeline}>
            <article><time>8月13日</time><span /><div><strong>后场步伐与反手高远球</strong><p>多拍稳定性提升，启动时重心仍偏高。下次继续加强交叉步衔接。</p><small>周明教练 · 朝阳体育中心</small></div></article>
            <article><time>8月6日</time><span /><div><strong>单打发接发与前三拍</strong><p>发球落点更稳定，接发后回中意识需要通过对抗训练强化。</p><small>周明教练 · 朝阳体育中心</small></div></article>
            <article><time>7月30日</time><span /><div><strong>专项能力初始评估</strong><p>完成基础动作、移动与体能测试，建立八课专项提升计划。</p><small>周明教练 · 朝阳体育中心</small></div></article>
          </div>
        </section>
        <aside className={styles.skillPanel}>
          <header><h2>能力观察</h2><span>教练记录</span></header>
          {[{ label: "移动与回中", value: 68 }, { label: "击球稳定性", value: 74 }, { label: "落点控制", value: 62 }, { label: "比赛意识", value: 58 }].map((item) => <div key={item.label}><p><strong>{item.label}</strong><span>{item.value}</span></p><i><b style={{ width: `${item.value}%` }} /></i></div>)}
          <p className={styles.skillNote}>能力值用于记录阶段变化，不代表专业等级认证。</p>
        </aside>
      </div>
    </div>
  );
}

function ProfilePage() {
  const items = [
    { icon: UserRound, title: "学员档案", copy: "训练目标、运动经历与必要健康提示", status: "待完善" },
    { icon: Heart, title: "我的收藏", copy: "已收藏 1 位教练", status: "查看" },
    { icon: CalendarCheck2, title: "预约与训练记录", copy: "管理历史预约和已完成课程", status: "12 节" },
    { icon: ShieldCheck, title: "协议与隐私", copy: "服务协议、隐私说明和未成年人保护", status: "已阅读" },
    { icon: MessageCircle, title: "帮助与反馈", copy: "提交服务问题或意见建议", status: "进入" },
  ];
  return (
    <div className={styles.studentPage}>
      <header className={styles.profileHeader}>
        <span>徐</span><div><p>学员账号</p><h1>徐子轩家长</h1><small>手机号已验证 · 北京</small></div><Link href="/login">切换工作模式</Link>
      </header>
      <section className={styles.profileCompletion}><div><Sparkles aria-hidden size={20} /><span><strong>档案完成度 72%</strong><small>补充训练经历和健康提示，教练能更准确地准备试课。</small></span></div><Link href="/student/profile#learner-profile">继续完善</Link></section>
      <section className={styles.profileSections} id="learner-profile">
        {items.map((item) => {
          const Icon = item.icon;
          return <details key={item.title}><summary><Icon aria-hidden size={20} /><span><strong>{item.title}</strong><small>{item.copy}</small></span><b>{item.status}</b><ChevronRight aria-hidden size={17} /></summary><div><p>{item.title === "学员档案" ? "当前训练目标为羽毛球专项提升，服务对象为青少年。隐私信息仅在预约确认后向对应教练开放。" : `${item.copy}。详细设置将在当前试点账号中保存。`}</p></div></details>;
        })}
      </section>
      <section className={styles.accountSecurity}><div><ShieldCheck aria-hidden size={22} /><span><strong>账号安全</strong><small>会话受私有访问保护，敏感信息不会在公开页面展示。</small></span></div><Link href="/">退出当前模式</Link></section>
    </div>
  );
}
