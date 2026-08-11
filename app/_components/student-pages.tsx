"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Heart,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { BookingSlot, LearnerProfile, MobileBooking, MobileCoach, MobileConversation } from "../mobile/types";
import { coaches as fallbackCoaches } from "../_lib/web-platform";
import { CoachDirectory } from "./coach-directory";
import { formatBeijingDate, formatFen, platformRequest } from "./platform-client";
import styles from "./platform-pages.module.css";

export type StudentSection = "home" | "coaches" | "bookings" | "messages" | "training" | "profile";

type BootstrapData = {
  bookings: MobileBooking[];
  coaches: MobileCoach[];
  conversations: MobileConversation[];
  favoriteCoachIds: number[];
  learnerProfiles: LearnerProfile[];
};

type TrainingRecord = {
  id: string;
  summary: string;
  coach_notes?: string;
  coach_name?: string;
  sport?: string;
  published_at?: number;
  created_at?: number;
};

const statusCopy: Record<MobileBooking["status"], string> = {
  cancelled_by_coach: "教练已取消",
  cancelled_by_student: "已取消",
  completed: "已完成",
  confirmed: "已确认",
  pending_coach: "等待教练确认",
  rejected: "未被接受",
  reschedule_requested: "教练申请改期",
};

function statusTone(status: MobileBooking["status"]) {
  if (status === "confirmed" || status === "completed") return "green";
  if (status === "pending_coach" || status === "reschedule_requested") return "amber";
  return "gray";
}

function useStudentBootstrap() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await platformRequest<BootstrapData>("/api/v1/bootstrap"));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "暂时无法读取学员数据");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void platformRequest<BootstrapData>("/api/v1/bootstrap")
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "暂时无法读取学员数据"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { data, error, load, loading, setData };
}

export function StudentPage({ initialCoachId, section }: { initialCoachId?: number; section: StudentSection }) {
  if (section === "coaches") return <div className={styles.page}><CoachDirectory embedded /></div>;
  return <StudentDataPage initialCoachId={initialCoachId} section={section} />;
}

function StudentDataPage({ initialCoachId, section }: { initialCoachId?: number; section: Exclude<StudentSection, "coaches"> }) {
  const state = useStudentBootstrap();
  if (state.loading) return <LoadingState label="正在读取你的服务记录" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  if (section === "bookings") return <BookingsPage data={state.data} initialCoachId={initialCoachId} reload={state.load} />;
  if (section === "messages") return <MessagesPage conversations={state.data.conversations} reload={state.load} />;
  if (section === "training") return <TrainingPage />;
  if (section === "profile") return <ProfilePage data={state.data} reload={state.load} />;
  return <StudentHome data={state.data} />;
}

function StudentHome({ data }: { data: BootstrapData }) {
  const active = data.bookings.find((booking) => !["completed", "cancelled_by_coach", "cancelled_by_student", "rejected"].includes(booking.status));
  const coach = active ? data.coaches.find((item) => item.id === active.coachId) : undefined;
  const unread = data.conversations.reduce((total, item) => total + item.unreadCount, 0);
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>北京学员服务</p><h1>把训练安排在真正合适的位置</h1><p>预约、沟通和训练记录都以服务端数据为准，不展示虚构课量或进度。</p></div>
        <Link className={styles.primary} href="/student/coaches">继续找教练 <ArrowRight aria-hidden size={17} /></Link>
      </header>
      <section className={styles.metrics}>
        <article><span>进行中预约</span><strong>{data.bookings.filter((item) => ["pending_coach", "confirmed", "reschedule_requested"].includes(item.status)).length}</strong><small>等待确认或履约</small></article>
        <article><span>已完成课程</span><strong>{data.bookings.filter((item) => item.status === "completed").length}</strong><small>可沉淀训练记录</small></article>
        <article><span>收藏教练</span><strong>{data.favoriteCoachIds.length}</strong><small>同步至当前账号</small></article>
        <article><span>未读消息</span><strong>{unread}</strong><small>来自教练或服务通知</small></article>
      </section>
      <div className={styles.split}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>最近安排</h2><p>教练确认后预约才会生效，费用在线下支付。</p></div><Link className={styles.secondary} href="/student/bookings">全部预约</Link></header>
          {active && coach ? (
            <div className={styles.list}>
              <article className={styles.listItem}>
                <div className={styles.coachIdentity}>
                  <Image alt={`${coach.name}教练`} height={56} src={coach.avatarUrl || fallbackCoaches[0]?.image || "/brand/icon-192.png"} unoptimized width={56} />
                </div>
                <div><h3>{coach.name} · {coach.sport}</h3><p>{active.dateLabel} {active.date}，{active.time}–{active.endTime} · {formatFen(active.feeFen)} 线下支付</p></div>
                <em className={styles.status} data-tone={statusTone(active.status)}>{statusCopy[active.status]}</em>
              </article>
            </div>
          ) : <EmptyState action={<Link className={styles.primary} href="/student/coaches">查看教练</Link>} copy="目前没有进行中的预约。选择教练后，可先咨询训练方向；只有真实时段发布后才能提交预约。" title="从一次清晰的训练需求开始" />}
        </section>
        <aside className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>账号准备度</h2><p>完善档案能让教练更准确地准备课程。</p></div></header>
          <div className={styles.list}>
            <Link className={styles.listItem} href="/student/profile"><span className={styles.listIcon}><UserRound aria-hidden size={19} /></span><div><h3>学员档案</h3><p>{data.learnerProfiles.length ? `${data.learnerProfiles.length} 份档案已保存` : "还没有建立学员档案"}</p></div><ArrowRight aria-hidden size={17} /></Link>
            <Link className={styles.listItem} href="/student/messages"><span className={styles.listIcon}><MessageCircle aria-hidden size={19} /></span><div><h3>服务沟通</h3><p>{unread ? `${unread} 条消息等待查看` : "暂无未读消息"}</p></div><ArrowRight aria-hidden size={17} /></Link>
            <Link className={styles.listItem} href="/student/training"><span className={styles.listIcon}><FileText aria-hidden size={19} /></span><div><h3>训练档案</h3><p>由已完成课程和教练记录生成</p></div><ArrowRight aria-hidden size={17} /></Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BookingsPage({ data, initialCoachId, reload }: { data: BootstrapData; initialCoachId?: number; reload: () => Promise<void> }) {
  const selectedCoach = data.coaches.find((coach) => coach.id === initialCoachId) ?? (initialCoachId ? undefined : data.coaches[0]);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!selectedCoach) return;
    void platformRequest<BookingSlot[]>(`/api/v1/coaches/${selectedCoach.id}/slots`).then(setSlots).catch(() => setSlots([]));
  }, [selectedCoach]);

  async function cancel(id: string) {
    setBusy(id);
    try {
      await platformRequest(`/api/v1/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      setNotice("预约已取消，原时段已释放");
      await reload();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "取消失败");
    } finally { setBusy(""); }
  }

  async function book(slot: BookingSlot) {
    if (!data.learnerProfiles[0] || !slot.venueId || !selectedCoach) return;
    setBusy(slot.id);
    try {
      await platformRequest("/api/v1/bookings", {
        body: { coachId: selectedCoach.id, learnerId: data.learnerProfiles[0].id, note: "请教练根据学员档案准备试课。", slotId: slot.id, venueId: slot.venueId },
        method: "POST",
      });
      setNotice("预约申请已提交，教练确认后生效");
      await reload();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "预约提交失败");
    } finally { setBusy(""); }
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>预约</p><h1>我的训练安排</h1><p>费用快照、状态变化和取消结果均来自正式业务记录。</p></div><Link className={styles.primary} href="/student/coaches">选择教练</Link></header>
      {error ? <div className={styles.error} role="alert"><strong>操作没有完成</strong><p>{error}</p></div> : null}
      {selectedCoach ? <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>{selectedCoach.name}教练的可约时间</h2><p>{selectedCoach.sport} · {selectedCoach.district || "北京"} · 试课 ¥{selectedCoach.trialPrice}</p></div></header>
        {slots.length ? <div className={styles.list}>{slots.map((slot) => <article className={styles.listItem} key={slot.id}><span className={styles.listIcon}><Clock3 aria-hidden size={19} /></span><div><h3>{slot.dateLabel} {slot.date}</h3><p>{slot.time}–{slot.endTime} · 教练确认后生效</p></div><button className={styles.primary} disabled={!slot.venueId || busy === slot.id || !data.learnerProfiles.length} onClick={() => void book(slot)} type="button">{busy === slot.id ? "提交中" : "提交预约"}</button></article>)}</div> : <EmptyState copy="教练尚未发布真实场馆与可约时段。你仍可收藏或发起咨询，发布后这里会自动开放。" title="暂无可约时间" />}
      </section> : null}
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>预约记录</h2><p>共 {data.bookings.length} 条真实记录</p></div></header>
        {data.bookings.length ? <div className={styles.table}>
          <div className={styles.tableHead}><span>教练</span><span>训练时间</span><span>费用</span><span>状态</span><span>操作</span></div>
          {data.bookings.map((booking) => {
            const coach = data.coaches.find((item) => item.id === booking.coachId);
            const cancellable = ["pending_coach", "confirmed", "reschedule_requested"].includes(booking.status);
            return <article className={styles.tableRow} key={booking.id}><span><strong>{coach?.name || "教练"}</strong><small>{coach?.sport || "专项训练"}</small></span><span><strong>{booking.dateLabel} {booking.date}</strong><small>{booking.time}–{booking.endTime}</small></span><span><strong>{formatFen(booking.feeFen)}</strong><small>{booking.paymentStatus === "offline_paid" ? "已标记线下收款" : "线下待支付"}</small></span><span><em className={styles.status} data-tone={statusTone(booking.status)}>{statusCopy[booking.status]}</em></span><span className={styles.rowActions}>{cancellable ? <button className={styles.danger} disabled={busy === booking.id} onClick={() => void cancel(booking.id)} type="button">取消预约</button> : <Link className={styles.secondary} href="/student/training">查看记录</Link>}</span></article>;
          })}
        </div> : <EmptyState copy="提交的预约会出现在这里。没有真实时段时，平台不会生成示例预约。" title="还没有预约记录" />}
      </section>
      {notice ? <div className={styles.notice} role="status"><CheckCircle2 aria-hidden size={17} />{notice}</div> : null}
    </div>
  );
}

function MessagesPage({ conversations, reload }: { conversations: MobileConversation[]; reload: () => Promise<void> }) {
  const [activeId, setActiveId] = useState(conversations[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const form = new FormData(event.currentTarget);
    const body = String(form.get("message") || "").trim();
    if (!body) return;
    setBusy(true);
    try {
      await platformRequest(`/api/v1/conversations/${encodeURIComponent(active.id)}/messages`, { body: { body }, method: "POST" });
      event.currentTarget.reset();
      setError("");
      await reload();
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "消息发送失败"); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>消息</p><h1>服务沟通</h1><p>预约相关沟通保留在站内，方便双方确认安排。</p></div></header>
    <section className={styles.panel}>
      {conversations.length && active ? <div className={styles.conversation}>
        <aside className={styles.conversationList}>{conversations.map((conversation) => <button aria-pressed={conversation.id === active.id} key={conversation.id} onClick={() => setActiveId(conversation.id)} type="button"><strong>{conversation.title}</strong><span>{conversation.subtitle || "暂无消息"}</span></button>)}</aside>
        <div className={styles.messagePane}><header><h2>{active.title}</h2></header><div className={styles.messages}>{active.messages.length ? active.messages.map((message) => <div className={styles.bubble} data-mine={message.sender === "student"} key={message.id}>{message.body}<small>{message.createdAt}</small></div>) : <EmptyState copy="发出第一条消息，说明训练目标或希望了解的服务安排。" title="还没有消息" />}</div><form className={styles.compose} onSubmit={send}><input aria-label="输入消息" maxLength={1000} name="message" placeholder="输入消息" /><button className={styles.primary} disabled={busy} type="submit"><Send aria-hidden size={16} />发送</button></form></div>
      </div> : <EmptyState action={<Link className={styles.primary} href="/student/coaches">找教练并咨询</Link>} copy="选择教练后可以建立站内会话。平台不会展示虚构聊天记录。" title="暂无会话" />}
    </section>
    {error ? <div className={styles.notice} role="alert"><CircleAlert aria-hidden size={17} />{error}</div> : null}
  </div>;
}

function TrainingPage() {
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void platformRequest<TrainingRecord[]>("/api/v1/training-records")
      .then((result) => { if (active) { setRecords(result); setError(""); } })
      .catch((loadError: unknown) => { if (active) { setError(loadError instanceof Error ? loadError.message : "训练记录暂时不可用"); setRecords([]); } });
    return () => { active = false; };
  }, []);
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>训练档案</p><h1>每次训练都留下清晰记录</h1><p>只有已完成课程且由教练发布的记录才会展示。</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>课程记录</h2><p>{records ? `${records.length} 条已发布记录` : "正在读取"}</p></div></header>
      {records === null ? <LoadingState label="读取训练记录" /> : records.length ? <div className={styles.timeline}>{records.map((record) => <article key={record.id}><time>{formatBeijingDate(record.published_at ?? record.created_at)}</time><h3>{record.sport || "专项训练"} · {record.coach_name || "教练记录"}</h3><p>{record.summary}</p>{record.coach_notes ? <p>{record.coach_notes}</p> : null}</article>)}</div> : <EmptyState copy={error || "完成课程后，教练发布的训练总结会按时间排列在这里。"} title="暂无训练记录" />}
    </section>
  </div>;
}

function ProfilePage({ data, reload }: { data: BootstrapData; reload: () => Promise<void> }) {
  const current = data.learnerProfiles[0];
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await platformRequest("/api/v1/learner-profiles", { body: {
        age: Number(form.get("age")) || undefined,
        gender: form.get("gender"), goal: form.get("goal"), id: current?.id,
        level: form.get("level"), name: form.get("name"), relation: form.get("relation"), sport: form.get("sport"),
      }, method: current ? "PUT" : "POST" });
      setNotice("学员档案已保存"); setError(""); await reload();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "档案保存失败"); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>账号与档案</p><h1>把必要信息交给正确的人</h1><p>敏感资料不会出现在公开教练目录中，仅用于已确认的服务。</p></div></header>
    <div className={styles.split}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>学员档案</h2><p>用于匹配与课前准备</p></div></header><form className={styles.form} onSubmit={save}>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>姓名或称呼</span><input defaultValue={current?.name || ""} maxLength={40} name="name" required /></label>
          <label className={styles.field}><span>服务关系</span><select defaultValue={current?.relation || "self"} name="relation"><option value="self">本人</option><option value="child">孩子</option></select></label>
          <label className={styles.field}><span>年龄</span><input defaultValue={current?.age || ""} max={100} min={3} name="age" type="number" /></label>
          <label className={styles.field}><span>性别</span><select defaultValue={current?.gender || "unspecified"} name="gender"><option value="unspecified">不填写</option><option value="female">女</option><option value="male">男</option></select></label>
          <label className={styles.field}><span>运动项目</span><input defaultValue={current?.sport || "田径"} maxLength={40} name="sport" required /></label>
          <label className={styles.field}><span>当前水平</span><input defaultValue={current?.level || "待评估"} maxLength={80} name="level" required /></label>
        </div>
        <label className={styles.field}><span>训练目标</span><textarea defaultValue={current?.goal || ""} maxLength={500} name="goal" required /></label>
        <div className={styles.formActions}>{error ? <p role="alert">{error}</p> : notice ? <p role="status">{notice}</p> : <p>修改后将用于后续匹配与预约。</p>}<button className={styles.primary} disabled={busy} type="submit">{busy ? "保存中" : "保存档案"}</button></div>
      </form></section>
      <aside className={styles.panel}><header className={styles.panelHeader}><div><h2>账号管理</h2><p>隐私、收藏和服务记录</p></div></header><div className={styles.list}>
        <div className={styles.listItem}><span className={styles.listIcon}><Heart aria-hidden size={19} /></span><div><h3>我的收藏</h3><p>{data.favoriteCoachIds.length} 位教练已同步</p></div></div>
        <Link className={styles.listItem} href="/service-guarantee"><span className={styles.listIcon}><ShieldCheck aria-hidden size={19} /></span><div><h3>协议与隐私</h3><p>查看服务保障与个人信息规则</p></div><ArrowRight aria-hidden size={17} /></Link>
        <form action="/api/auth/email/logout" method="post" className={styles.listItem}><span className={styles.listIcon}><UserRound aria-hidden size={19} /></span><div><h3>登录状态</h3><p>退出后公开教练目录仍可浏览</p></div><button className={styles.secondary} type="submit">退出登录</button></form>
      </div></aside>
    </div>
  </div>;
}

function EmptyState({ action, copy, title }: { action?: React.ReactNode; copy: string; title: string }) {
  return <div className={styles.empty}><Sparkles aria-hidden size={28} /><strong>{title}</strong><p>{copy}</p>{action}</div>;
}

function LoadingState({ label }: { label: string }) {
  return <div className={styles.loading}><LoaderCircle aria-hidden size={27} /><span>{label}</span></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>服务数据暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>;
}
