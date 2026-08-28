"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Heart,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BEIJING_DISTRICTS, SPORT_OPTIONS, TRAINING_GOAL_OPTIONS } from "../../shared/coach-catalog";
import { calculateDurationPriceFen } from "../../shared/pricing";
import { formatBeijingDateTimeLocal, parseBeijingDateTimeLocal } from "../../shared/scheduling";
import { REVIEW_TAGS } from "../../shared/reviews";
import type { AccountProfile, BookingOptions, LearnerProfile, MobileBooking, MobileCoach, MobileConversation } from "../mobile/types";
import { coaches as fallbackCoaches } from "../_lib/web-platform";
import { CoachDirectory } from "./coach-directory";
import { describeBookingOptionsFailure, formatBeijingDate, formatFen, PlatformRequestError, platformRequest, platformUploadAvatar, trackProductEvent } from "./platform-client";
import styles from "./platform-pages.module.css";
import { LoadingState as SharedLoadingState } from "./async-states";

export type StudentSection = "home" | "coaches" | "bookings" | "messages" | "training" | "profile";

type BootstrapData = {
  accountProfile?: AccountProfile;
  bookings: MobileBooking[];
  coaches: MobileCoach[];
  conversations: MobileConversation[];
  favoriteCoachIds: number[];
  learnerProfiles: LearnerProfile[];
};

async function cropAvatarToWebp(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.height = 512;
  canvas.width = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器暂不支持头像处理");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("头像处理失败，请更换图片重试");
  if (blob.size > 1024 * 1024) throw new Error("头像处理后仍超过 1MB，请更换图片");
  return blob;
}

type TrainingRecord = {
  id: string;
  summary: string;
  coach_notes?: string;
  coach_name?: string;
  sport?: string;
  published_at?: number;
  created_at?: number;
};

type SupportTicket = { id: string; subject?: string; category?: string; status?: string; latest_message?: string; updated_at?: number; created_at?: number };
type RescheduleProposal = { id: string; booking_id: string; status: string; note?: string; starts_at?: number; ends_at?: number; venue_name?: string; venue_address?: string; created_at?: number };

const statusCopy: Record<MobileBooking["status"], string> = {
  cancelled_by_coach: "教练已取消",
  cancelled_by_student: "已取消",
  completed: "已完成",
  confirmed: "已确认",
  pending_coach: "等待教练确认",
  rejected: "未被接受",
  expired: "申请已失效",
  reschedule_requested: "教练申请改期",
};

function statusTone(status: MobileBooking["status"]) {
  if (status === "confirmed" || status === "completed") return "green";
  if (status === "pending_coach" || status === "reschedule_requested") return "amber";
  return "gray";
}

function useStudentBootstrap() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const hasData = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    try {
      setData(await platformRequest<BootstrapData>("/api/v1/bootstrap")); hasData.current = true;
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "暂时无法读取学员数据");
    } finally {
      setLoading(false);
    }
  }, []);
  const refresh = useCallback(async () => {
    try { setData(await platformRequest<BootstrapData>("/api/v1/bootstrap")); setError(""); }
    catch { /* Keep the last successfully loaded workspace state. */ }
  }, []);
  useEffect(() => {
    let active = true;
    void platformRequest<BootstrapData>("/api/v1/bootstrap")
      .then((result) => { if (active) { setData(result); hasData.current = true; setError(""); } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "暂时无法读取学员数据"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { data, error, load, loading, refresh, setData };
}

export function StudentPage({ initialCoachId, initialSlotId, section }: { initialCoachId?: number; initialSlotId?: string; section: StudentSection }) {
  if (section === "coaches") return <div className={styles.page}><CoachDirectory embedded /></div>;
  return <StudentDataPage initialCoachId={initialCoachId} initialSlotId={initialSlotId} section={section} />;
}

function StudentDataPage({ initialCoachId, initialSlotId, section }: { initialCoachId?: number; initialSlotId?: string; section: Exclude<StudentSection, "coaches"> }) {
  const state = useStudentBootstrap();
  if (state.loading) return <LoadingState label="正在读取你的服务记录" />;
  if (!state.data) return <ErrorState message={state.error} onRetry={state.load} />;
  if (section === "bookings") return <BookingsPage data={state.data} initialCoachId={initialCoachId} initialSlotId={initialSlotId} reload={state.load} />;
  if (section === "messages") return <MessagesPage conversations={state.data.conversations} reload={state.refresh} />;
  if (section === "training") return <TrainingPage data={state.data} />;
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
          ) : <EmptyState action={<Link className={styles.primary} href="/student/coaches">查看教练</Link>} copy="目前没有进行中的预约。选择已上线教练后，可以直接指定希望的训练时间与地点。" title="从一次清晰的训练需求开始" />}
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

function BookingsPage({ data, initialCoachId, initialSlotId, reload }: { data: BootstrapData; initialCoachId?: number; initialSlotId?: string; reload: () => Promise<void> }) {
  const selectedCoach = data.coaches.find((coach) => coach.id === initialCoachId) ?? (initialCoachId ? undefined : data.coaches[0]);
  const hasPriorEffectiveBooking = selectedCoach ? data.bookings.some((booking) => booking.coachId === selectedCoach.id && !["rejected", "cancelled_by_student", "cancelled_by_coach"].includes(booking.status)) : false;
  const bookingPriceLabel = hasPriorEffectiveBooking ? "常规课" : "首次试课";
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(Boolean(selectedCoach));
  const [optionsError, setOptionsError] = useState<unknown>(null);
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [busy, setBusy] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState(data.learnerProfiles[0]?.id || "");
  const [bookingNote, setBookingNote] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<60 | 90 | 120>(60);
  const [locationType, setLocationType] = useState<"venue" | "custom">("venue");
  const [venueId, setVenueId] = useState("");
  const [customDistrict, setCustomDistrict] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [customLocationNote, setCustomLocationNote] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [proposals, setProposals] = useState<RescheduleProposal[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `web-booking-${crypto.randomUUID()}`);
  const loadProposals = useCallback(async () => { try { setProposals(await platformRequest<RescheduleProposal[]>("/api/v1/reschedule-proposals")); } catch { setProposals([]); } }, []);
  useEffect(() => { queueMicrotask(() => void loadProposals()); }, [loadProposals]);
  useEffect(() => {
    if (!selectedCoach) return;
    let active = true;
    queueMicrotask(() => { setOptionsLoading(true); setOptionsError(null); setError(""); });
    void platformRequest<BookingOptions>(`/api/v1/coaches/${selectedCoach.id}/booking-options`).then((value) => {
      if (!active) return;
      setOptions(value);
      setOptionsError(null);
      setVenueId(value.venues[0]?.id || "");
      setStartsAt(formatBeijingDateTimeLocal(value.earliestStartsAt + 5 * 60_000));
    }).catch((loadError: unknown) => {
      if (active) { setOptions(null); setOptionsError(loadError); }
    }).finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [initialSlotId, optionsReloadKey, selectedCoach]);
  useEffect(() => {
    if (!selectedLearnerId && data.learnerProfiles[0]?.id) queueMicrotask(() => setSelectedLearnerId(data.learnerProfiles[0].id));
  }, [data.learnerProfiles, selectedLearnerId]);

  async function cancel(id: string) {
    setBusy(id);
    try {
      await platformRequest(`/api/v1/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      setNotice("预约已取消，本次时间申请已关闭");
      await reload();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "取消失败");
    } finally { setBusy(""); }
  }

  async function book() {
    if (!selectedLearnerId || !selectedCoach || !options || !agreementAccepted) return;
    const requestedStartsAt = parseBeijingDateTimeLocal(startsAt);
    if (!Number.isFinite(requestedStartsAt)) { setError("请选择有效的北京时间"); return; }
    if (locationType === "venue" && !venueId) { setError("请选择训练场馆"); return; }
    if (locationType === "custom" && (!customDistrict.trim() || !customAddress.trim())) { setError("请填写期望区域和详细地点"); return; }
    setBusy("submit");
    setError("");
    trackProductEvent({ flow: "booking", outcome: "started", role: "student", step: "submit" });
    try {
      await platformRequest("/api/v1/bookings", {
        body: { coachId: selectedCoach.id, customAddress, customDistrict, customLocationNote, durationMinutes, learnerId: selectedLearnerId, locationType, note: bookingNote, startsAt: requestedStartsAt, venueId: locationType === "venue" ? venueId : undefined },
        idempotencyKey,
        method: "POST",
      });
      setNotice("时间申请已提交，教练将在失效前确认或提出新方案");
      trackProductEvent({ flow: "booking", outcome: "success", role: "student", step: "submitted" });
      setIdempotencyKey(`web-booking-${crypto.randomUUID()}`);
      setAgreementAccepted(false);
      await reload();
    } catch (actionError) {
      trackProductEvent({ errorCode: actionError instanceof PlatformRequestError ? actionError.code : undefined, flow: "booking", outcome: "error", role: "student", step: "submitted" });
      setError(actionError instanceof Error ? actionError.message : "预约提交失败");
    } finally { setBusy(""); }
  }

  async function createLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCoach) return;
    const form = new FormData(event.currentTarget);
    setProfileBusy(true);
    setError("");
    try {
      const saved = await platformRequest<LearnerProfile>("/api/v1/learner-profiles", {
        body: {
          age: Number(form.get("age")),
          gender: String(form.get("gender")),
          goal: String(form.get("goal")),
          level: String(form.get("level")),
          name: String(form.get("name")),
          relation: String(form.get("relation")),
          sport: String(form.get("sport")),
        },
        method: "POST",
      });
      setSelectedLearnerId(saved.id);
      setNotice("学员档案已建立，可以继续提交当前预约");
      await reload();
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "学员档案创建失败");
    } finally { setProfileBusy(false); }
  }

  async function respondToReschedule(id: string, decision: "accepted" | "rejected") {
    setBusy(id);
    try { await platformRequest(`/api/v1/reschedule-proposals/${encodeURIComponent(id)}/respond`, { body: { decision }, method: "POST" }); setNotice(decision === "accepted" ? "已接受新方案，预约已确认" : "已拒绝新方案，原预约状态已恢复"); setError(""); await Promise.all([reload(), loadProposals()]); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "改期处理失败"); }
    finally { setBusy(""); }
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>预约</p><h1>我的训练安排</h1><p>费用快照、状态变化和取消结果均来自正式业务记录。</p></div><Link className={styles.primary} href="/student/coaches">选择教练</Link></header>
      {error ? <div className={styles.error} role="alert"><strong>操作没有完成</strong><p>{error}</p></div> : null}
      {!selectedCoach && initialCoachId ? <section className={styles.panel}><EmptyState action={<Link className={styles.primary} href="/student/coaches">重新选择教练</Link>} copy="该教练可能已下线、暂停接单或不再公开展示。" title="当前教练不可预约" /></section> : null}
      {selectedCoach ? <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>向{selectedCoach.name}教练申请训练时间</h2><p>{selectedCoach.sport} · {selectedCoach.district || "北京"} · 自主选择北京时间 · 教练确认后生效</p></div><Link className={styles.secondary} href={`/coaches/${selectedCoach.id}`}>查看教练档案</Link></header>
        {!data.learnerProfiles.length ? <form className={styles.quickProfile} onSubmit={createLearner}><header><div><h3>先建立学员档案</h3><p>只填写本次预约所需信息，创建后会自动继续当前流程。</p></div><UserRound aria-hidden size={22} /></header><div className={styles.formGrid}><label className={styles.field}><span>学员姓名</span><input maxLength={40} name="name" required /></label><label className={styles.field}><span>身份关系</span><select defaultValue="self" name="relation"><option value="self">本人</option><option value="child">子女</option></select></label><label className={styles.field}><span>年龄</span><input max={100} min={1} name="age" required type="number" /></label><label className={styles.field}><span>性别</span><select defaultValue="unspecified" name="gender"><option value="unspecified">暂不填写</option><option value="male">男</option><option value="female">女</option></select></label><label className={styles.field}><span>运动项目</span><select defaultValue={selectedCoach.sport} name="sport">{SPORT_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.field}><span>训练基础</span><select defaultValue="初学" name="level"><option>初学</option><option>有一定基础</option><option>校队或专项训练</option></select></label><label className={styles.field}><span>训练目标</span><select defaultValue={selectedCoach.goals[0] || TRAINING_GOAL_OPTIONS[0]} name="goal">{Array.from(new Set([...TRAINING_GOAL_OPTIONS, ...selectedCoach.goals])).map((item) => <option key={item}>{item}</option>)}</select></label></div><button className={styles.primary} disabled={profileBusy} type="submit">{profileBusy ? "创建中" : "建立档案并继续"}</button></form> : null}
        {optionsLoading ? <LoadingState label="正在读取预约配置" /> : options ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void book(); }}>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>训练学员</span><select onChange={(event) => setSelectedLearnerId(event.target.value)} value={selectedLearnerId}><option value="">请选择学员档案</option>{data.learnerProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.goal}</option>)}</select></label>
            <label className={styles.field}><span>开始时间（北京时间）</span><input max={formatBeijingDateTimeLocal(options.latestStartsAt)} min={formatBeijingDateTimeLocal(options.earliestStartsAt)} onChange={(event) => { setStartsAt(event.target.value); setIdempotencyKey(`web-booking-${crypto.randomUUID()}`); }} required type="datetime-local" value={startsAt} /></label>
          </div>
          <div className={styles.durationOptions} aria-label="训练时长"><span>训练时长</span>{options.durationMinutes.map((minutes) => <button aria-pressed={durationMinutes === minutes} className={durationMinutes === minutes ? styles.selectedOption : undefined} key={minutes} onClick={() => { setDurationMinutes(minutes); setIdempotencyKey(`web-booking-${crypto.randomUUID()}`); }} type="button">{minutes}分钟</button>)}</div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>地点方式</span><select onChange={(event) => setLocationType(event.target.value as "venue" | "custom")} value={locationType}><option value="venue">教练已审核场馆</option><option value="custom">填写期望地点</option></select></label>
            {locationType === "venue" ? <label className={styles.field}><span>训练场馆</span><select onChange={(event) => setVenueId(event.target.value)} value={venueId}><option value="">请选择场馆</option>{options.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} · {venue.district}</option>)}</select></label> : <label className={styles.field}><span>期望区域</span><input maxLength={40} onChange={(event) => setCustomDistrict(event.target.value)} placeholder="例如：通州区" value={customDistrict} /></label>}
          </div>
          {locationType === "custom" ? <div className={styles.formGrid}><label className={styles.field}><span>详细地点</span><input maxLength={240} onChange={(event) => setCustomAddress(event.target.value)} placeholder="仅预约双方与运营可见" value={customAddress} /></label><label className={styles.field}><span>地点补充说明</span><input maxLength={300} onChange={(event) => setCustomLocationNote(event.target.value)} placeholder="集合点、交通或场地要求" value={customLocationNote} /></label></div> : null}
          <label className={styles.field}><span>训练需求说明</span><textarea maxLength={500} onChange={(event) => setBookingNote(event.target.value)} placeholder="需要教练提前了解的训练目标、基础或伤病情况" rows={3} value={bookingNote} /></label>
          <section className={styles.bookingSummary}><span><strong>{bookingPriceLabel} · {durationMinutes}分钟</strong><small>申请提交后价格生成快照，教练不能修改</small></span><b>{formatFen(calculateDurationPriceFen(hasPriorEffectiveBooking ? options.regularBasePriceFen : options.trialBasePriceFen, durationMinutes))}</b></section>
          <label className={styles.consentRow}><input checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} type="checkbox" /><span>我已阅读服务与取消规则。申请需教练确认后生效，24小时未处理或到达训练开始时间会自动失效，采用线下支付。</span></label>
          <button className={styles.primary} disabled={busy === "submit" || !selectedLearnerId || !agreementAccepted || (locationType === "venue" ? !venueId : !customDistrict.trim() || !customAddress.trim())} type="submit">{busy === "submit" ? "正在提交" : "提交时间申请"}</button>
        </form> : (() => {
          const failure = describeBookingOptionsFailure(optionsError, selectedCoach.unavailableReason);
          const action = failure.action === "retry"
            ? <button className={styles.primary} onClick={() => setOptionsReloadKey((value) => value + 1)} type="button"><RefreshCw aria-hidden size={17} />重新加载</button>
            : failure.action === "login"
              ? <Link className={styles.primary} href={`/login?next=${encodeURIComponent(`/student/bookings?coach=${selectedCoach.id}`)}`}>重新登录</Link>
              : failure.action === "choose"
                ? <Link className={styles.primary} href="/student/coaches">重新选择教练</Link>
                : undefined;
          return <EmptyState action={action} copy={failure.copy} title={failure.title} />;
        })()}
      </section> : null}
      {proposals.some((item) => item.status === "pending") ? <section className={styles.panel}><header className={styles.panelHeader}><div><h2>待确认改期</h2><p>确认前请核对新时间和场馆</p></div></header><div className={styles.list}>{proposals.filter((item) => item.status === "pending").map((proposal) => <article className={styles.listItem} key={proposal.id}><span className={styles.listIcon}><Clock3 aria-hidden size={19} /></span><div><h3>{formatBeijingDate(proposal.starts_at)}</h3><p>{proposal.venue_name || "训练场馆"} · {proposal.note || "教练提出新的训练时间"}</p></div><span className={styles.rowActions}><button className={styles.danger} disabled={busy === proposal.id} onClick={() => void respondToReschedule(proposal.id, "rejected")} type="button">拒绝</button><button className={styles.primary} disabled={busy === proposal.id} onClick={() => void respondToReschedule(proposal.id, "accepted")} type="button">接受改期</button></span></article>)}</div></section> : null}
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>预约记录</h2><p>共 {data.bookings.length} 条真实记录</p></div></header>
        {data.bookings.length ? <div className={styles.table}>
          <div className={styles.tableHead}><span>教练</span><span>训练时间</span><span>费用</span><span>状态</span><span>操作</span></div>
          {data.bookings.map((booking) => {
            const coach = data.coaches.find((item) => item.id === booking.coachId);
            const cancellable = ["pending_coach", "confirmed", "reschedule_requested"].includes(booking.status);
            return <article className={styles.tableRow} key={booking.id}><span><strong>{coach?.name || "教练"}</strong><small>{coach?.sport || "专项训练"}</small></span><span><strong>{booking.dateLabel} {booking.date}</strong><small>{booking.time}–{booking.endTime}</small></span><span><strong>{formatFen(booking.feeFen)}</strong><small>{booking.paymentStatus === "offline_paid" ? "已标记线下收款" : "线下待支付"}</small></span><span><em className={styles.status} data-tone={statusTone(booking.status)}>{statusCopy[booking.status]}</em></span><span className={styles.rowActions}>{cancellable ? <button className={styles.danger} disabled={busy === booking.id} onClick={() => void cancel(booking.id)} type="button">取消预约</button> : <Link className={styles.secondary} href="/student/training">查看记录</Link>}</span></article>;
          })}
        </div> : <EmptyState copy="你提交的时间申请和已经确认的课程会出现在这里。" title="还没有预约记录" />}
      </section>
      {notice ? <div className={styles.notice} role="status"><CheckCircle2 aria-hidden size={17} />{notice}</div> : null}
    </div>
  );
}

function MessagesPage({ conversations, reload }: { conversations: MobileConversation[]; reload: () => Promise<void> }) {
  const searchParams = useSearchParams();
  const requestedCoachId = Number(searchParams.get("coach"));
  const [activeId, setActiveId] = useState(conversations[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  useEffect(() => { const timer = window.setInterval(() => void reload(), 15_000); return () => window.clearInterval(timer); }, [reload]);
  useEffect(() => {
    if (!Number.isInteger(requestedCoachId) || requestedCoachId <= 0) return;
    const existing = conversations.find((item) => item.coachId === requestedCoachId);
    if (existing) { queueMicrotask(() => setActiveId(existing.id)); return; }
    let activeRequest = true;
    void platformRequest<MobileConversation>("/api/v1/conversations", { body: { coachId: requestedCoachId }, method: "POST" })
      .then(async (created) => { if (activeRequest) { setActiveId(created.id); await reload(); } })
      .catch((cause: unknown) => { if (activeRequest) setError(cause instanceof Error ? cause.message : "咨询会话创建失败"); });
    return () => { activeRequest = false; };
  }, [conversations, reload, requestedCoachId]);
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

function TrainingPage({ data }: { data: BootstrapData }) {
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const completed = data.bookings.filter((booking) => booking.status === "completed");
  useEffect(() => {
    let active = true;
    void platformRequest<TrainingRecord[]>("/api/v1/training-records")
      .then((result) => { if (active) { setRecords(result); setError(""); } })
      .catch((loadError: unknown) => { if (active) { setError(loadError instanceof Error ? loadError.message : "训练记录暂时不可用"); setRecords([]); } });
    return () => { active = false; };
  }, []);
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    try { await platformRequest("/api/v1/reviews", { body: { bookingId: form.get("bookingId"), body: form.get("body"), rating: Number(form.get("rating")), tags: form.getAll("tags") }, method: "POST" }); setNotice("评价已提交，运营审核通过后公开"); setError(""); event.currentTarget.reset(); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : "评价提交失败"); }
    finally { setBusy(false); }
  }
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>训练档案</p><h1>每次训练都留下清晰记录</h1><p>只有已完成课程且由教练发布的记录才会展示。</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>课程记录</h2><p>{records ? `${records.length} 条已发布记录` : "正在读取"}</p></div></header>
      {records === null ? <LoadingState label="读取训练记录" /> : records.length ? <div className={styles.timeline}>{records.map((record) => <article key={record.id}><time>{formatBeijingDate(record.published_at ?? record.created_at)}</time><h3>{record.sport || "专项训练"} · {record.coach_name || "教练记录"}</h3><p>{record.summary}</p>{record.coach_notes ? <p>{record.coach_notes}</p> : null}</article>)}</div> : <EmptyState copy={error || "完成课程后，教练发布的训练总结会按时间排列在这里。"} title="暂无训练记录" />}
    </section>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>课程评价</h2><p>每个已完成预约只能提交一次，审核后才公开</p></div></header>{completed.length ? <form className={styles.form} onSubmit={submitReview}><div className={styles.formGrid}><label className={styles.field}><span>选择课程</span><select name="bookingId" required>{completed.map((booking) => <option key={booking.id} value={booking.id}>{booking.dateLabel} {booking.date} · #{booking.id.slice(-8)}</option>)}</select></label><label className={styles.field}><span>总体评分</span><select defaultValue="5" name="rating"><option value="5">5 分 · 非常满意</option><option value="4">4 分 · 满意</option><option value="3">3 分 · 符合预期</option><option value="2">2 分 · 有待改善</option><option value="1">1 分 · 不满意</option></select></label></div><fieldset className={styles.reviewTags} onChange={(event) => { const current = event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'); if (current.length > 3 && event.target instanceof HTMLInputElement) { event.target.checked = false; setError("体验标签最多选择3项"); } }}><legend>体验标签（最多选择3项）</legend>{REVIEW_TAGS.map((tag) => <label key={tag}><input name="tags" type="checkbox" value={tag} /><span>{tag}</span></label>)}</fieldset><label className={styles.field}><span>真实体验</span><textarea maxLength={1000} minLength={20} name="body" placeholder="请描述训练内容、沟通和实际感受，至少20字" required /></label><div className={styles.formActions}>{error ? <p role="alert">{error}</p> : notice ? <p role="status">{notice}</p> : <p>评价将匿名展示，请勿填写未成年人姓名和联系方式。</p>}<button className={styles.primary} disabled={busy} type="submit">{busy ? "提交中" : "提交评价"}</button></div></form> : <EmptyState copy="完成真实课程后30天内可以提交一次评价。" title="暂无可评价课程" />}</section>
  </div>;
}

function ProfilePage({ data, reload }: { data: BootstrapData; reload: () => Promise<void> }) {
  const [selectedProfileId, setSelectedProfileId] = useState(data.learnerProfiles[0]?.id || "");
  const current = data.learnerProfiles.find((profile) => profile.id === selectedProfileId);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactKind, setContactKind] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [contactChallengeId, setContactChallengeId] = useState("");
  const [contactCode, setContactCode] = useState("");
  const accountProfile = data.accountProfile;
  const loadTickets = useCallback(async () => { try { setTickets(await platformRequest<SupportTicket[]>("/api/v1/support-tickets")); } catch { setTickets([]); } }, []);
  useEffect(() => { queueMicrotask(() => void loadTickets()); }, [loadTickets]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const saved = await platformRequest<LearnerProfile>("/api/v1/learner-profiles", { body: {
        age: Number(form.get("age")) || undefined,
        gender: form.get("gender"), goal: form.get("goal"), id: current?.id,
        level: form.get("level"), name: form.get("name"), relation: form.get("relation"), sport: form.get("sport"),
      }, method: current ? "PUT" : "POST" });
      setSelectedProfileId(saved.id); setNotice("学员档案已保存"); setError(""); await reload();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "档案保存失败"); }
    finally { setBusy(false); }
  }
  async function saveAccountProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await platformRequest<AccountProfile>("/api/v1/me/profile", { body: { bio: form.get("bio"), district: form.get("district"), nickname: form.get("nickname") }, method: "PATCH" });
      setNotice("账号资料已更新"); await reload();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "账号资料保存失败"); }
    finally { setBusy(false); }
  }
  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      await platformUploadAvatar(await cropAvatarToWebp(file));
      setNotice("头像已更新，仅在账号与服务关系中展示"); await reload();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "头像上传失败"); }
    finally { setBusy(false); }
  }
  async function removeAvatar() {
    setBusy(true); setError("");
    try { await platformRequest("/api/v1/me/avatar", { method: "DELETE" }); setNotice("头像已移除"); await reload(); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : "头像移除失败"); }
    finally { setBusy(false); }
  }
  async function requestContactCode() {
    setBusy(true); setError("");
    try { const result = await platformRequest<{ challengeId: string }>("/api/v1/me/contact-challenges", { body: { kind: contactKind, value: contactValue }, method: "POST" }); setContactChallengeId(result.challengeId); setNotice("验证码已发送，5 分钟内有效"); }
    catch (contactError) { setError(contactError instanceof Error ? contactError.message : "验证码发送失败"); }
    finally { setBusy(false); }
  }
  async function verifyContactCode() {
    setBusy(true); setError("");
    try { const result = await platformRequest<{ mergeRequired: boolean }>(`/api/v1/me/contact-challenges/${encodeURIComponent(contactChallengeId)}/verify`, { body: { code: contactCode }, method: "POST" }); setNotice(result.mergeRequired ? "该联系方式已属于其他账号，已创建人工合并工单" : "联系方式已验证并更新"); setContactChallengeId(""); setContactCode(""); setContactValue(""); await reload(); }
    catch (contactError) { setError(contactError instanceof Error ? contactError.message : "验证码校验失败"); }
    finally { setBusy(false); }
  }
  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    try { await platformRequest("/api/v1/support-tickets", { body: { bookingId: form.get("bookingId") || undefined, body: form.get("body"), category: form.get("category"), subject: form.get("subject") }, method: "POST" }); setNotice("售后工单已创建，运营回复会保留在站内"); setError(""); event.currentTarget.reset(); await loadTickets(); }
    catch (ticketError) { setError(ticketError instanceof Error ? ticketError.message : "工单创建失败"); }
    finally { setBusy(false); }
  }
  async function deleteAccount() {
    setBusy(true);
    try { await platformRequest("/api/v1/me", { method: "DELETE" }); window.location.assign("/"); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "账号注销失败"); setDeleteOpen(false); setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/email/logout", { method: "POST" });
      if (!response.ok) throw new Error("退出登录失败，请稍后重试");
      window.location.assign("/login");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "退出登录失败，请稍后重试");
      setBusy(false);
    }
  }
  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>账号与档案</p><h1>把必要信息交给正确的人</h1><p>敏感资料不会出现在公开教练目录中，仅用于已确认的服务。</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>账号资料</h2><p>昵称与头像不会替代学员真实姓名，也不会出现在公开评价中</p></div><span className={styles.status} data-tone={accountProfile?.completed ? "green" : "amber"}>{accountProfile?.completed ? "资料已完善" : "待完善"}</span></header>
      <div className={styles.accountProfileLayout}>
        <div className={styles.avatarEditor}>
          <span className={styles.accountAvatar}>{accountProfile?.avatarUrl ? <Image alt="账号头像" height={96} src={accountProfile.avatarUrl} unoptimized width={96} /> : (accountProfile?.nickname || "逐").slice(0, 1)}</span>
          <div><strong>个人头像</strong><p>上传后自动居中裁切为 1:1 WebP，仅在账号与服务关系中可见。</p><div className={styles.toolbar}><label className={styles.secondary}>选择图片<input accept="image/jpeg,image/png,image/webp" disabled={busy} hidden onChange={(event) => void uploadAvatar(event.target.files?.[0])} type="file" /></label>{accountProfile?.avatarUrl ? <button className={styles.secondary} disabled={busy} onClick={() => void removeAvatar()} type="button">移除头像</button> : null}</div></div>
        </div>
        <form className={styles.form} onSubmit={saveAccountProfile}>
          <div className={styles.formGrid}><label className={styles.field}><span>昵称</span><input defaultValue={accountProfile?.nickname || ""} maxLength={20} minLength={2} name="nickname" placeholder="2 至 20 个字" required /></label><label className={styles.field}><span>北京所在区</span><select defaultValue={accountProfile?.district || ""} name="district"><option value="">暂不填写</option>{BEIJING_DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}</select></label></div>
          <label className={styles.field}><span>个性签名</span><textarea defaultValue={accountProfile?.bio || ""} maxLength={80} name="bio" placeholder="最多 80 个字" /></label>
          <div className={styles.contactSummary}><span><strong>邮箱</strong><small>{accountProfile?.contact.emailMasked || "未绑定"}</small></span><span><strong>手机号</strong><small>{accountProfile?.contact.phoneMasked || "未绑定"}</small></span></div>
          <div className={styles.contactBinding}><select aria-label="联系方式类型" disabled={Boolean(contactChallengeId)} onChange={(event) => setContactKind(event.target.value as "email" | "phone")} value={contactKind}><option value="email">邮箱</option><option value="phone">手机号</option></select>{contactChallengeId ? <input aria-label="验证码" autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setContactCode(event.target.value.replace(/\D/gu, "").slice(0,6))} placeholder="6 位验证码" value={contactCode} /> : <input aria-label="新联系方式" autoComplete={contactKind === "email" ? "email" : "tel"} inputMode={contactKind === "email" ? "email" : "tel"} onChange={(event) => setContactValue(event.target.value)} placeholder={contactKind === "email" ? "新邮箱地址" : "新手机号"} value={contactValue} />}<button className={styles.secondary} disabled={busy || (contactChallengeId ? contactCode.length !== 6 : !contactValue.trim())} onClick={() => void (contactChallengeId ? verifyContactCode() : requestContactCode())} type="button">{contactChallengeId ? "确认绑定" : "发送验证码"}</button></div>
          <div className={styles.formActions}>{error ? <p role="alert">{error}</p> : notice ? <p role="status">{notice}</p> : <p>昵称完成后才能咨询、预约或发送消息。</p>}<button className={styles.primary} disabled={busy} type="submit">{busy ? "保存中" : "保存账号资料"}</button></div>
        </form>
      </div>
    </section>
    <div className={styles.split}>
      <section className={styles.panel}><header className={styles.panelHeader}><div><h2>学员档案</h2><p>可为本人或孩子分别建立档案</p></div><button className={styles.secondary} onClick={() => setSelectedProfileId("")} type="button">新增档案</button></header>{data.learnerProfiles.length ? <div className={styles.toolbar}>{data.learnerProfiles.map((profile) => <button aria-pressed={profile.id === selectedProfileId} className={profile.id === selectedProfileId ? styles.primary : styles.secondary} key={profile.id} onClick={() => setSelectedProfileId(profile.id)} type="button">{profile.name}</button>)}</div> : null}<form className={styles.form} key={current?.id || "new-profile"} onSubmit={save}>
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
        <div className={styles.listItem}><span className={styles.listIcon}><UserRound aria-hidden size={19} /></span><div><h3>登录状态</h3><p>退出后公开教练目录仍可浏览</p></div><button className={styles.secondary} disabled={busy} onClick={() => void logout()} type="button">{busy ? "正在退出" : "退出登录"}</button></div>
        <div className={styles.listItem}><span className={styles.listIcon}><CircleAlert aria-hidden size={19} /></span><div><h3>注销账号</h3><p>最高权限账号受保护，其他账号可提交注销</p></div><button className={styles.danger} onClick={() => setDeleteOpen(true)} type="button">注销</button></div>
      </div></aside>
    </div>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>售后与服务工单</h2><p>围绕预约、线下支付、隐私或安全问题联系运营</p></div></header><div className={styles.split}><form className={styles.form} onSubmit={createTicket}><label className={styles.field}><span>问题主题</span><input maxLength={120} name="subject" required /></label><div className={styles.formGrid}><label className={styles.field}><span>问题类型</span><select name="category"><option value="service">服务体验</option><option value="booking">预约安排</option><option value="payment">线下支付</option><option value="safety">安全问题</option><option value="privacy">隐私问题</option><option value="other">其他</option></select></label><label className={styles.field}><span>关联预约</span><select name="bookingId"><option value="">不关联预约</option>{data.bookings.map((booking) => <option key={booking.id} value={booking.id}>#{booking.id.slice(-8)} · {booking.dateLabel}</option>)}</select></label></div><label className={styles.field}><span>问题说明</span><textarea maxLength={3000} name="body" required /></label><button className={styles.primary} disabled={busy} type="submit">提交工单</button></form><div className={styles.list}>{tickets.length ? tickets.map((ticket) => <article className={styles.listItem} key={ticket.id}><span className={styles.listIcon}><FileText aria-hidden size={19} /></span><div><h3>{ticket.subject || `工单 #${ticket.id.slice(-8)}`}</h3><p>{ticket.latest_message || "等待运营处理"} · {formatBeijingDate(ticket.updated_at || ticket.created_at)}</p></div><em className={styles.status} data-tone={ticket.status === "resolved" || ticket.status === "closed" ? "green" : "amber"}>{ticket.status === "resolved" ? "已解决" : ticket.status === "closed" ? "已关闭" : ticket.status === "waiting_user" ? "等待回复" : "处理中"}</em></article>) : <EmptyState copy="需要帮助时可创建第一条站内工单。" title="暂无售后工单" />}</div></div></section>
    {deleteOpen ? <div className={styles.confirmOverlay} role="presentation" onClick={() => setDeleteOpen(false)}><section aria-modal="true" onClick={(event) => event.stopPropagation()} role="dialog"><h2>确认注销账号</h2><p>登录会话、收藏和通知会被清除；争议处理所需的历史履约记录按规则保留。此操作不能在网页内撤销。</p><div><button className={styles.secondary} onClick={() => setDeleteOpen(false)} type="button">取消</button><button className={styles.danger} disabled={busy} onClick={() => void deleteAccount()} type="button">确认注销</button></div></section></div> : null}
  </div>;
}

function EmptyState({ action, copy, title }: { action?: React.ReactNode; copy: string; title: string }) {
  return <div className={styles.empty}><Sparkles aria-hidden size={28} /><strong>{title}</strong><p>{copy}</p>{action}</div>;
}

function LoadingState({ label }: { label: string }) {
  return <SharedLoadingState label={label} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return <div className={styles.page}><div className={styles.error}><CircleAlert aria-hidden size={28} /><strong>服务数据暂时没有加载成功</strong><p>{message}</p><button className={styles.secondary} onClick={() => void onRetry()} type="button"><RefreshCw aria-hidden size={16} />重新加载</button></div></div>;
}
