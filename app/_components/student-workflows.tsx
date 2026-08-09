"use client";

import { BadgeCheck, CalendarDays, CheckCircle2, ChevronRight, MapPin, MessageCircle, Send, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { coaches } from "../_lib/web-platform";
import styles from "./student-pages.module.css";

const initialBookings = [
  { coach: 1, date: "8月20日 周四", id: "ZG240798", status: "已确认", time: "18:30–20:00", venue: "朝阳体育中心羽毛球馆" },
  { coach: 1, date: "8月27日 周四", id: "ZG240801", status: "待教练确认", time: "18:30–20:00", venue: "朝阳体育中心羽毛球馆" },
  { coach: 2, date: "7月18日 周六", id: "ZG240655", status: "已完成", time: "09:30–10:30", venue: "海淀全民健身中心游泳馆" },
];

export function StudentBookings({ initialCoachId }: { initialCoachId?: number }) {
  const selectedCoach = coaches.find((coach) => coach.id === initialCoachId) ?? coaches[0];
  const [tab, setTab] = useState(initialCoachId ? "new" : "bookings");
  const [agreement, setAgreement] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookings, setBookings] = useState(initialBookings);
  const [statusFilter, setStatusFilter] = useState("全部");
  const visibleBookings = useMemo(() => bookings.filter((booking) => {
    if (statusFilter === "全部") return true;
    if (statusFilter === "待确认") return booking.status === "待教练确认";
    return booking.status === statusFilter;
  }), [bookings, statusFilter]);

  function cancelBooking(id: string) {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status: "已取消" } : booking));
  }

  function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreement) return;
    setSubmitted(true);
  }

  return (
    <div className={styles.studentPage}>
      <header className={styles.pageTitle}>
        <div><p>预约</p><h1>管理训练安排</h1></div>
        <div className={styles.pageTabs} role="tablist">
          <button aria-selected={tab === "bookings"} onClick={() => setTab("bookings")} role="tab" type="button">我的预约</button>
          <button aria-selected={tab === "new"} onClick={() => setTab("new")} role="tab" type="button">预约试课</button>
        </div>
      </header>
      {tab === "bookings" ? (
        <section className={styles.bookingListPage}>
          <div className={styles.listFilters}>{["全部", "待确认", "已确认", "已完成"].map((item) => <button aria-pressed={statusFilter === item} className={statusFilter === item ? styles.activeFilter : undefined} key={item} onClick={() => setStatusFilter(item)} type="button">{item}</button>)}</div>
          {visibleBookings.map((booking) => {
            const coach = coaches.find((item) => item.id === booking.coach) ?? coaches[0];
            return (
              <article className={styles.bookingRecord} key={booking.id}>
                <Image alt={`${coach.name}教练`} height={66} src={coach.image} unoptimized width={66} />
                <div><span className={booking.status === "待教练确认" ? styles.pendingStatus : booking.status === "已取消" ? styles.cancelledStatus : styles.confirmedStatus}>{booking.status}</span><h2>{coach.sport} · {coach.name}教练</h2><p><CalendarDays aria-hidden size={14} />{booking.date} {booking.time}</p><p><MapPin aria-hidden size={14} />{booking.venue}</p></div>
                <div className={styles.bookingPrice}><strong>¥{coach.price}</strong><span>线下支付</span></div>
                <div className={styles.recordActions}><Link href="/student/messages">联系教练</Link>{booking.status !== "已完成" && booking.status !== "已取消" ? <button onClick={() => cancelBooking(booking.id)} type="button">取消预约</button> : <Link href="/student/training">查看记录</Link>}</div>
              </article>
            );
          })}
          {!visibleBookings.length ? <div className={styles.bookingEmpty}><CheckCircle2 aria-hidden size={28} /><strong>当前分类暂无预约</strong><p>新的预约状态会在这里同步更新。</p></div> : null}
        </section>
      ) : !selectedCoach.bookable ? (
        <section className={styles.bookingUnavailable}>
          <Image alt={`${selectedCoach.name}教练`} height={96} src={selectedCoach.image} unoptimized width={96} />
          <span><BadgeCheck aria-hidden size={15} />{selectedCoach.verificationLabel}</span>
          <h2>{selectedCoach.name}教练的时段正在准备中</h2>
          <p>当前可以收藏或咨询训练方向。运营人员发布真实场馆和可约时段后，这里会自动开放预约。</p>
          <div><strong>{selectedCoach.sport} · {selectedCoach.district}</strong><small>{selectedCoach.venue}</small><b>试课 ¥{selectedCoach.trialPrice} · 线下支付</b></div>
          <Link href={`/student/messages?coach=${selectedCoach.id}`}><MessageCircle aria-hidden size={17} />先咨询训练安排</Link>
        </section>
      ) : submitted ? (
        <section className={styles.bookingSuccess}>
          <CheckCircle2 aria-hidden size={34} />
          <h2>预约申请已提交</h2>
          <p>教练确认后预约生效。状态变化会同步到预约和消息页面。</p>
          <div><strong>{selectedCoach.name}教练 · {selectedCoach.sport}</strong><span>周六 10:00–11:30 · {selectedCoach.venue}</span><b>试课 ¥{selectedCoach.trialPrice} · 线下支付</b></div>
          <button onClick={() => setTab("bookings")} type="button">查看我的预约</button>
        </section>
      ) : (
        <form className={styles.bookingForm} onSubmit={submitBooking}>
          <section>
            <header><span>1</span><div><h2>确认教练</h2><p>价格和服务信息会作为本次预约快照保存</p></div><Link href="/student/coaches">更换教练</Link></header>
            <div className={styles.formCoach}><Image alt={`${selectedCoach.name}教练`} height={72} src={selectedCoach.image} unoptimized width={72} /><div><h3>{selectedCoach.name}<BadgeCheck aria-hidden size={15} /></h3><p>{selectedCoach.sport} · {selectedCoach.title}</p><span>{selectedCoach.venue}</span></div><strong>试课 ¥{selectedCoach.trialPrice}</strong></div>
          </section>
          <section>
            <header><span>2</span><div><h2>选择安排</h2><p>可约时间以教练确认后的预约结果为准</p></div></header>
            <div className={styles.bookingFields}>
              <label><span>学员</span><select defaultValue="徐子轩"><option>徐子轩 · 12岁</option></select></label>
              <label><span>训练场地</span><select defaultValue={selectedCoach.venue}><option>{selectedCoach.venue}</option></select></label>
              <label><span>日期</span><select defaultValue="周六"><option>周六 8月22日</option><option>周日 8月23日</option></select></label>
              <label><span>时间</span><select defaultValue="10:00"><option>10:00–11:30</option><option>14:00–15:30</option></select></label>
            </div>
          </section>
          <section>
            <header><span>3</span><div><h2>训练需求</h2><p>帮助教练提前准备本次试课</p></div></header>
            <textarea aria-label="训练需求说明" defaultValue="希望重点评估后场移动和反手高远球，近期没有运动损伤。" rows={4} />
          </section>
          <aside className={styles.feeSummary}>
            <div><span>试课费用</span><strong>¥{selectedCoach.trialPrice}</strong></div><p><ShieldCheck aria-hidden size={16} />教练确认后生效，费用线下支付</p>
            <label><input checked={agreement} onChange={(event) => setAgreement(event.target.checked)} type="checkbox" />我已阅读并同意预约、取消和隐私说明</label>
            <button disabled={!agreement} type="submit">提交预约申请</button>
          </aside>
        </form>
      )}
    </div>
  );
}

const conversations = [
  { coach: 1, id: "conversation-1", preview: "收到，周四提前十分钟到场即可。", time: "10:24", unread: 2 },
  { coach: 2, id: "conversation-2", preview: "第一次试课会先做基础动作评估。", time: "昨天", unread: 0 },
];

export function StudentMessages() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [messages, setMessages] = useState([
    { body: "教练您好，想确认一下周四课程需要提前准备什么？", mine: true, time: "10:18" },
    { body: "带好球拍和运动鞋即可，场馆有饮水。课前我会先做五分钟热身评估。", mine: false, time: "10:21" },
    { body: "收到，周四提前十分钟到场即可。", mine: false, time: "10:24" },
  ]);
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const coach = coaches.find((item) => item.id === active.coach) ?? coaches[0];

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get("message") ?? "").trim();
    if (!body) return;
    setMessages((current) => [...current, { body, mine: true, time: "刚刚" }]);
    event.currentTarget.reset();
  }

  return (
    <div className={styles.messagePage}>
      <aside className={styles.conversationList}>
        <header><div><p>消息</p><h1>教练沟通</h1></div><MessageCircle aria-hidden size={21} /></header>
        <label><span className={styles.visuallyHidden}>搜索会话</span><input placeholder="搜索教练或课程" /></label>
        <div>
          {conversations.map((conversation) => {
            const itemCoach = coaches.find((item) => item.id === conversation.coach) ?? coaches[0];
            return <button className={activeId === conversation.id ? styles.activeConversation : ""} key={conversation.id} onClick={() => setActiveId(conversation.id)} type="button"><Image alt="" height={48} src={itemCoach.image} unoptimized width={48} /><span><strong>{itemCoach.name}教练<small>{conversation.time}</small></strong><p>{conversation.preview}</p></span>{conversation.unread ? <b>{conversation.unread}</b> : null}</button>;
          })}
        </div>
      </aside>
      <section className={styles.chatPanel}>
        <header><Image alt="" height={42} src={coach.image} unoptimized width={42} /><div><h2>{coach.name}教练 <BadgeCheck aria-hidden size={14} /></h2><p>{coach.sport} · {coach.venue}</p></div><Link href="/student/bookings">查看预约 <ChevronRight aria-hidden size={16} /></Link></header>
        <div className={styles.chatNotice}><ShieldCheck aria-hidden size={15} />请勿在沟通中发送身份证、银行卡等敏感信息</div>
        <div className={styles.messages}>
          <time>今天</time>
          {messages.map((message, index) => <div className={message.mine ? styles.myMessage : styles.coachMessage} key={`${message.time}-${index}`}>{!message.mine ? <Image alt="" height={34} src={coach.image} unoptimized width={34} /> : null}<span><p>{message.body}</p><small>{message.time}</small></span></div>)}
        </div>
        <form className={styles.messageComposer} onSubmit={sendMessage}><input aria-label="输入消息" autoComplete="off" name="message" placeholder="输入消息，按发送提交" /><button aria-label="发送消息" type="submit"><Send aria-hidden size={18} /></button></form>
      </section>
    </div>
  );
}
