"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { coaches, pilotBookings } from "../_lib/web-platform";
import styles from "./coach-pages.module.css";

export type CoachSection = "home" | "bookings" | "schedule" | "messages" | "courses" | "payments" | "credentials";

type Booking = {
  id: string;
  learner: string;
  price: number;
  schedule: string;
  sport: string;
  status: string;
  tone: string;
  venue: string;
};

export function CoachPage({ section }: { section: CoachSection }) {
  const [bookings, setBookings] = useState<Booking[]>(pilotBookings.map((item) => ({ ...item })));
  const [notice, setNotice] = useState("");

  function updateBooking(id: string, status: string) {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status, tone: status === "已确认" || status === "已完成" ? "green" : status === "已拒绝" ? "gray" : "blue" } : booking));
    setNotice(`演示视图：预约 ${id} 已更新为“${status}”，未写入正式业务记录`);
    window.setTimeout(() => setNotice(""), 2200);
  }

  return (
    <>
      {section === "home" ? <CoachHome bookings={bookings} /> : null}
      {section === "bookings" ? <CoachBookings bookings={bookings} onUpdate={updateBooking} /> : null}
      {section === "schedule" ? <CoachSchedule /> : null}
      {section === "messages" ? <CoachMessages /> : null}
      {section === "courses" ? <CoachCourses bookings={bookings} onUpdate={updateBooking} /> : null}
      {section === "payments" ? <CoachPayments bookings={bookings} /> : null}
      {section === "credentials" ? <CoachCredentials /> : null}
      {notice ? <div className={styles.toast} role="status"><Check aria-hidden size={17} />{notice}</div> : null}
    </>
  );
}

function PageHeading({ copy, title, action }: { action?: React.ReactNode; copy: string; title: string }) {
  return <header className={styles.pageHeading}><div><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function CoachHome({ bookings }: { bookings: Booking[] }) {
  const pending = bookings.filter((item) => item.status === "待确认" || item.status === "申请改期").length;
  return (
    <div className={styles.coachPage}>
      <PageHeading action={<Link href="/coach-workspace/schedule"><Plus aria-hidden size={16} />发布可约时段</Link>} copy="优先处理待确认预约，再查看今天的课程与消息。" title="今天需要关注的工作" />
      <section className={styles.metrics}>
        <article><span className={styles.greenIcon}><Clock3 aria-hidden size={20} /></span><div><p>待处理预约</p><strong>{pending}</strong><small>建议 2 小时内处理</small></div></article>
        <article><span className={styles.blueIcon}><CalendarCheck2 aria-hidden size={20} /></span><div><p>今日课程</p><strong>2</strong><small>下一节 18:30 开始</small></div></article>
        <article><span className={styles.coralIcon}><MessageCircle aria-hidden size={20} /></span><div><p>未读消息</p><strong>2</strong><small>来自 2 位学员</small></div></article>
        <article><span className={styles.amberIcon}><CircleDollarSign aria-hidden size={20} /></span><div><p>待标记收款</p><strong>1</strong><small>课程完成后确认</small></div></article>
      </section>

      <div className={styles.homeColumns}>
        <section className={styles.workQueue}>
          <header><div><h2>优先处理</h2><p>需要你作出明确操作的预约与服务事项</p></div><Link href="/coach-workspace/bookings">全部预约 <ArrowRight aria-hidden size={15} /></Link></header>
          {bookings.filter((item) => item.status === "待确认" || item.status === "申请改期").map((booking) => <article key={booking.id}><span className={booking.status === "待确认" ? styles.statusAmber : styles.statusBlue}>{booking.status}</span><div><strong>{booking.learner} · {booking.sport}</strong><p>{booking.schedule} · {booking.venue}</p></div><Link href="/coach-workspace/bookings">立即处理 <ChevronRight aria-hidden size={16} /></Link></article>)}
          <article><span className={styles.statusCoral}>未读</span><div><strong>徐子轩家长发来消息</strong><p>想确认周四课程需要提前准备什么</p></div><Link href="/coach-workspace/messages">回复消息 <ChevronRight aria-hidden size={16} /></Link></article>
        </section>
        <aside className={styles.todaySchedule}>
          <header><h2>今日安排</h2><span>8月17日</span></header>
          <div><time>09:30</time><span /><article><strong>成人基础训练</strong><p>王思涵 · 朝阳体育中心</p><b>已完成</b></article></div>
          <div><time>18:30</time><span /><article><strong>青少年专项提升</strong><p>徐子轩 · 朝阳体育中心</p><b className={styles.upcoming}>待开始</b></article></div>
          <Link href="/coach-workspace/schedule">查看完整排期 <ArrowRight aria-hidden size={15} /></Link>
        </aside>
      </div>

      <section className={styles.operationBand}>
        <div><BadgeCheck aria-hidden size={21} /><span><strong>资料状态正常</strong><small>3 项资质均在有效期内</small></span><Link href="/coach-workspace/credentials">查看资质</Link></div>
        <div><CalendarDays aria-hidden size={21} /><span><strong>未来 7 天可约 9 个时段</strong><small>周六下午仍有 2 个空闲时段</small></span><Link href="/coach-workspace/schedule">管理排期</Link></div>
        <div><CircleDollarSign aria-hidden size={21} /><span><strong>本月完成 12 节课程</strong><small>线下收款记录 ¥3,360</small></span><Link href="/coach-workspace/payments">查看记录</Link></div>
      </section>
    </div>
  );
}

function CoachBookings({ bookings, onUpdate }: { bookings: Booking[]; onUpdate: (id: string, status: string) => void }) {
  const [filter, setFilter] = useState("待处理");
  const filtered = useMemo(() => {
    if (filter === "待处理") return bookings.filter((item) => item.status === "待确认" || item.status === "申请改期");
    if (filter === "已确认") return bookings.filter((item) => item.status === "已确认");
    return bookings;
  }, [bookings, filter]);
  return (
    <div className={styles.coachPage}>
      <PageHeading copy="确认、改期或拒绝后，学员会同步收到状态通知。" title="预约管理" />
      <section className={styles.tablePanel}>
        <header className={styles.tableTools}><div className={styles.tabs}>{["待处理", "已确认", "全部"].map((item) => <button aria-pressed={filter === item} key={item} onClick={() => setFilter(item)} type="button">{item}<span>{item === "待处理" ? bookings.filter((row) => row.status === "待确认" || row.status === "申请改期").length : ""}</span></button>)}</div><div className={styles.tableSelects}><select aria-label="筛选日期"><option>未来 30 天</option><option>本周</option></select><select aria-label="筛选场馆"><option>全部场馆</option><option>朝阳体育中心</option></select></div></header>
        <div className={styles.bookingTableHeader}><span>学员与项目</span><span>上课安排</span><span>费用</span><span>状态</span><span>操作</span></div>
        <div className={styles.bookingRows}>
          {filtered.map((booking) => <article key={booking.id}><div><span className={styles.learnerAvatar}>{booking.learner.slice(0, 1)}</span><span><strong>{booking.learner}</strong><small>{booking.sport} · 专项提升</small></span></div><div><strong>{booking.schedule}</strong><small>{booking.venue}</small></div><div><strong>¥{booking.price}</strong><small>线下待支付</small></div><div><span className={styles[`status${booking.tone[0].toUpperCase()}${booking.tone.slice(1)}`]}>{booking.status}</span><small>#{booking.id}</small></div><div className={styles.rowActions}>{booking.status === "待确认" || booking.status === "申请改期" ? <><button onClick={() => onUpdate(booking.id, "已确认")} type="button"><Check aria-hidden size={15} />确认</button><button onClick={() => onUpdate(booking.id, "申请改期")} type="button"><Clock3 aria-hidden size={15} />改期</button><button aria-label="拒绝预约" onClick={() => onUpdate(booking.id, "已拒绝")} title="拒绝" type="button"><X aria-hidden size={16} /></button></> : <button onClick={() => onUpdate(booking.id, "已完成")} type="button"><CheckCircle2 aria-hidden size={15} />完成课程</button>}</div></article>)}
          {!filtered.length ? <div className={styles.empty}><CheckCircle2 aria-hidden size={26} /><strong>当前队列已处理完成</strong><p>新的预约申请会显示在这里。</p></div> : null}
        </div>
      </section>
    </div>
  );
}

function CoachSchedule() {
  const initial = ["mon-18", "tue-18", "thu-18", "sat-10", "sat-14", "sun-09"];
  const [available, setAvailable] = useState(initial);
  const [weekOffset, setWeekOffset] = useState(0);
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const periods = ["09:00", "10:30", "14:00", "16:00", "18:00", "19:30"];
  const dates = days.map((_, index) => new Date(2026, 7, 17 + weekOffset * 7 + index));
  const rangeLabel = `${dates[0].getMonth() + 1}月${dates[0].getDate()}日–${dates[6].getMonth() + 1}月${dates[6].getDate()}日`;
  function toggle(dayIndex: number, period: string) {
    const key = `${["mon", "tue", "wed", "thu", "fri", "sat", "sun"][dayIndex]}-${period.slice(0, 2)}`;
    setAvailable((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }
  return (
    <div className={styles.coachPage}>
      <PageHeading action={<button className={styles.primaryAction} onClick={() => setAvailable(initial)} type="button"><Plus aria-hidden size={16} />恢复常用排期</button>} copy="点击时段切换可约状态，已产生预约的时段不能直接关闭。" title="排期与场馆" />
      <section className={styles.schedulePanel}>
        <header><div><button aria-label="上一周" onClick={() => setWeekOffset((current) => current - 1)} type="button">‹</button><strong>{rangeLabel}</strong><button aria-label="下一周" onClick={() => setWeekOffset((current) => current + 1)} type="button">›</button></div><p><span />可约 <span />已预约 <span />不可约</p></header>
        <div className={styles.scheduleGrid}>
          <div className={styles.timeColumn}><strong>时间</strong>{periods.map((period) => <span key={period}>{period}</span>)}</div>
          {days.map((day, dayIndex) => <div className={styles.dayColumn} key={day}><strong>{day}<small>{dates[dayIndex].getDate()}</small></strong>{periods.map((period) => { const key = `${["mon", "tue", "wed", "thu", "fri", "sat", "sun"][dayIndex]}-${period.slice(0, 2)}`; const booked = (dayIndex === 0 && period === "18:00") || (dayIndex === 3 && period === "18:00"); return <button aria-pressed={available.includes(key) || booked} className={booked ? styles.bookedSlot : available.includes(key) ? styles.availableSlot : ""} disabled={booked} key={period} onClick={() => toggle(dayIndex, period)} type="button">{booked ? "已预约" : available.includes(key) ? "可约" : "—"}</button>; })}</div>)}
        </div>
        <footer><MapPin aria-hidden size={17} /><div><strong>默认场馆：朝阳体育中心羽毛球馆</strong><p>北京市朝阳区安定路 1 号 · 可提前 24 小时修改</p></div><button disabled title="正式场馆资料接入后开放" type="button">场馆资料待接入</button></footer>
      </section>
    </div>
  );
}

function CoachMessages() {
  const contacts = [{ id: "xu", initial: "徐", name: "徐子轩家长", time: "10:24", preview: "想确认周四课程需要准备什么", unread: 2 }, { id: "wang", initial: "王", name: "王思涵", time: "昨天", preview: "谢谢教练，训练记录已收到", unread: 0 }];
  const [activeChat, setActiveChat] = useState(contacts[0].id);
  const [messages, setMessages] = useState([{ mine: false, body: "教练您好，想确认一下周四课程需要提前准备什么？", time: "10:18" }, { mine: true, body: "带好球拍和运动鞋即可，建议提前十分钟到场完成热身。", time: "10:24" }]);
  const activeContact = contacts.find((contact) => contact.id === activeChat) ?? contacts[0];
  function send(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const body = String(form.get("message") ?? "").trim(); if (!body) return; setMessages((current) => [...current, { mine: true, body, time: "刚刚" }]); event.currentTarget.reset(); }
  return (
    <div className={styles.coachPage}>
      <PageHeading copy="预约相关沟通统一留在站内，便于双方确认安排。" title="学员消息" />
      <section className={styles.coachMessages}>
        <aside><label><input placeholder="搜索学员" /></label>{contacts.map((contact) => <button className={activeChat === contact.id ? styles.activeChat : undefined} key={contact.id} onClick={() => setActiveChat(contact.id)} type="button"><span className={styles.learnerAvatar}>{contact.initial}</span><span><strong>{contact.name}<small>{contact.time}</small></strong><p>{contact.preview}</p></span>{contact.unread ? <b>{contact.unread}</b> : null}</button>)}</aside>
        <div><header><span className={styles.learnerAvatar}>{activeContact.initial}</span><div><h2>{activeContact.name}</h2><p>羽毛球专项提升 · 下一课周四 18:30</p></div><Link href="/coach-workspace/bookings">查看预约</Link></header><div className={styles.messageHistory}><time>今天</time>{messages.map((message, index) => <div className={message.mine ? styles.coachBubble : styles.learnerBubble} key={index}><p>{message.body}</p><small>{message.time}</small></div>)}</div><form onSubmit={send}><input aria-label="回复学员" name="message" placeholder="输入回复" /><button aria-label="发送回复" type="submit"><Send aria-hidden size={17} /></button></form></div>
      </section>
    </div>
  );
}

function CoachCourses({ bookings, onUpdate }: { bookings: Booking[]; onUpdate: (id: string, status: string) => void }) {
  const [notice, setNotice] = useState("");
  function inspect(booking: Booking) { setNotice(`${booking.learner}的课程详情待正式课程记录接入后开放`); window.setTimeout(() => setNotice(""), 2200); }
  return <div className={styles.coachPage}><PageHeading copy="记录课程重点、学员表现和下一步建议。" title="课程记录" /><section className={styles.courseList}><header><strong>近期课程</strong><span>共 {bookings.length} 条</span></header>{bookings.map((booking, index) => <article key={booking.id}><time>{index === 0 ? "今天" : index === 1 ? "明天" : "本周"}</time><span className={styles.learnerAvatar}>{booking.learner.slice(0, 1)}</span><div><h2>{booking.learner} · {booking.sport}</h2><p>{booking.schedule} · {booking.venue}</p><small>{booking.status === "已完成" ? "已生成训练记录" : "课程结束后补充训练反馈"}</small></div><span className={booking.status === "已完成" ? styles.statusGreen : styles.statusBlue}>{booking.status}</span>{booking.status === "已确认" ? <button onClick={() => onUpdate(booking.id, "已完成")} type="button">完成并记录</button> : <button onClick={() => inspect(booking)} type="button"><MoreHorizontal aria-hidden size={17} />查看</button>}</article>)}</section>{notice ? <div className={styles.toast} role="status"><Check aria-hidden size={17} />{notice}</div> : null}</div>;
}

function CoachPayments({ bookings }: { bookings: Booking[] }) {
  const [paid, setPaid] = useState<string[]>([bookings[3]?.id].filter(Boolean) as string[]);
  return <div className={styles.coachPage}><PageHeading copy="逐光首版采用线下支付，此处只记录双方确认的收款状态。" title="线下收款" /><section className={styles.paymentSummary}><div><p>本月已记录</p><strong>¥{paid.length * 280}</strong><span>{paid.length} 笔线下收款</span></div><div><p>待确认收款</p><strong>{bookings.filter((item) => item.status === "已确认" && !paid.includes(item.id)).length}</strong><span>完成课程后及时核对</span></div><div><ShieldCheck aria-hidden size={22} /><p><strong>平台不代收费用</strong><span>请勿在站内发送银行卡等敏感信息</span></p></div></section><section className={styles.paymentTable}><header><span>预约</span><span>课程时间</span><span>金额</span><span>收款状态</span><span>操作</span></header>{bookings.filter((item) => item.status === "已确认" || item.status === "已完成").map((booking) => <article key={booking.id}><span><strong>{booking.learner}</strong><small>{booking.sport} · #{booking.id}</small></span><span><strong>{booking.schedule}</strong><small>{booking.venue}</small></span><strong>¥{booking.price}</strong><span className={paid.includes(booking.id) ? styles.statusGreen : styles.statusAmber}>{paid.includes(booking.id) ? "已收款" : "待收款"}</span><button onClick={() => setPaid((current) => current.includes(booking.id) ? current.filter((id) => id !== booking.id) : [...current, booking.id])} type="button">{paid.includes(booking.id) ? "撤销标记" : "标记已收款"}</button></article>)}</section></div>;
}

function CoachCredentials() {
  const coach = coaches[0];
  return <div className={styles.coachPage}><PageHeading copy="公开页面只展示核验结论，资质原件仅限授权人员访问。" title="资质与资料" /><section className={styles.credentialProfile}><Image alt="周明教练" height={112} src={coach.image} unoptimized width={112} /><div><span><BadgeCheck aria-hidden size={15} />认证教练</span><h2>{coach.name}</h2><p>{coach.sport} · {coach.title}</p><small>资料状态以运营复核记录为准</small></div><button disabled title="资料变更服务接入后开放" type="button">资料变更待接入</button></section><section className={styles.credentialList}><header><h2>已核验材料</h2><span>按已完成核验材料展示</span></header>{coach.credentials.map((credential) => <article key={credential}><FileCheck2 aria-hidden size={22} /><div><strong>{credential}</strong><p>平台人工复核记录</p></div><span><CheckCircle2 aria-hidden size={15} />已核验</span><button disabled title="核验记录服务接入后开放" type="button">核验记录待接入</button></article>)}</section><section className={styles.credentialNotice}><ShieldCheck aria-hidden size={22} /><div><strong>资料保护说明</strong><p>身份证明和资质原件不会出现在公开页面。运营人员每次访问均记录用途与时间。</p></div></section></div>;
}
