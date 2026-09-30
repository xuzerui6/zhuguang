"use client";

import { Check, ChevronRight, Headphones, LocateFixed, LockKeyhole, Mail, MessageCircle, Plus, ShieldCheck, Smartphone, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { removeTurnstileWidget } from "../_lib/turnstile";
import { AUDIENCE_OPTIONS, TRAINING_GOAL_OPTIONS } from "../../shared/coach-catalog";
import type { ServiceCatalog } from '../../shared/service-catalog';
import { SERVICE_AREAS, SERVICE_CITIES, SUPPORTED_SPORTS, type ServiceCityId } from "../../shared/service-cities";
import { REVIEW_TAGS } from "../../shared/reviews";
import { mobileApi } from './api-client';
import type { LegalDocument } from '../../shared/legal-documents';
import { CoachAvatar, EmptyState, Sheet } from "./components";
import type { AccountProfile, LearnerProfile, MatchPreferences, MobileBooking, MobileCoach, MobileNotification, MobileSession } from "./types";

export function ReviewSheet({ booking, coachName, onClose, onSubmit }: {
  booking: MobileBooking;
  coachName: string;
  onClose: () => void;
  onSubmit: (input: { body: string; rating: number; tags: string[] }) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(booking.review.rejectionReason || "");
  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 3 ? [...current, tag] : current);
  return <Sheet onClose={onClose} title={booking.review.canResubmit ? "修改并重提评价" : `评价${coachName}教练`}><div className="zg-review-sheet">
    <p>评价审核后匿名展示，不公开账号昵称、头像或学员真实姓名。</p>
    {booking.review.canResubmit ? <div className="zg-review-rejection"><strong>审核意见</strong><span>{booking.review.rejectionReason}</span></div> : null}
    <fieldset><legend>总体评分</legend><div className="zg-review-stars">{[1,2,3,4,5].map((value) => <button aria-label={`${value}星`} aria-pressed={rating === value} key={value} onClick={() => setRating(value)} type="button"><Star aria-hidden fill={value <= rating ? "currentColor" : "none"} /></button>)}</div></fieldset>
    <fieldset><legend>体验标签（最多3项）</legend><div className="zg-review-tag-grid">{REVIEW_TAGS.map((tag) => <button aria-pressed={tags.includes(tag)} key={tag} onClick={() => toggleTag(tag)} type="button">{tag}</button>)}</div></fieldset>
    <label><span>真实体验</span><textarea maxLength={1000} minLength={20} onChange={(event) => setBody(event.target.value)} placeholder="请描述训练内容、沟通和实际感受，至少20字" value={body} /></label>
    {error ? <p className="zg-auth-error" role="alert">{error}</p> : null}
    <button className="zg-sheet-primary" disabled={busy || body.trim().length < 20} onClick={() => { setBusy(true); setError(""); void onSubmit({ body: body.trim(), rating, tags }).then(onClose).catch((reason) => setError(reason instanceof Error ? reason.message : "评价提交失败")).finally(() => setBusy(false)); }} type="button">{busy ? "提交中" : "提交审核"}</button>
  </div></Sheet>;
}

async function mobileAvatarWebp(file: File) {
  const image = await createImageBitmap(file);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备暂不支持头像处理");
  context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 512, 512);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .86));
  if (!blob || blob.size > 1024 * 1024) throw new Error("头像处理失败，请选择另一张图片");
  return blob;
}

export function AccountProfileSheet({ onClose, onDeleteAvatar, onSave, onUploadAvatar, profile }: {
  onClose: () => void;
  onDeleteAvatar: () => Promise<void>;
  onSave: (input: { bio: string; nickname: string; serviceArea: string; serviceCityId: ServiceCityId }) => Promise<void>;
  onUploadAvatar: (blob: Blob) => Promise<void>;
  profile?: AccountProfile;
}) {
  const [nickname, setNickname] = useState(profile?.nickname || "");
  const [serviceCityId, setServiceCityId] = useState<ServiceCityId>(profile?.serviceCityId || "beijing");
  const [serviceArea, setServiceArea] = useState(profile?.serviceArea || profile?.district || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contactKind, setContactKind] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [contactCode, setContactCode] = useState("");
  async function run(task: () => Promise<void>) { setBusy(true); setError(""); try { await task(); } catch (reason) { setError(reason instanceof Error ? reason.message : "操作失败，请重试"); } finally { setBusy(false); } }
  return <Sheet onClose={onClose} title="编辑账号资料"><div className="zg-account-profile-sheet">
    <div className="zg-account-avatar-editor"><span>{profile?.avatarUrl ? <Image alt="账号头像" height={72} src={profile.avatarUrl} unoptimized width={72} /> : (nickname || "逐").slice(0,1)}</span><div><strong>账号头像</strong><small>仅在账号与服务关系中展示</small><label>选择图片<input accept="image/jpeg,image/png,image/webp" disabled={busy} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(async () => onUploadAvatar(await mobileAvatarWebp(file))); }} type="file" /></label>{profile?.avatarUrl ? <button disabled={busy} onClick={() => void run(onDeleteAvatar)} type="button">移除</button> : null}</div></div>
    <label><span>昵称</span><input maxLength={20} minLength={2} onChange={(event) => setNickname(event.target.value)} placeholder="2 至 20 个字" value={nickname} /></label>
    <label><span>服务城市</span><select onChange={(event) => { setServiceCityId(event.target.value as ServiceCityId); setServiceArea(""); }} value={serviceCityId}>{SERVICE_CITIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span>所在区域</span><select onChange={(event) => setServiceArea(event.target.value)} value={serviceArea}><option value="">暂不填写</option>{SERVICE_AREAS[serviceCityId].map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span>个性签名</span><textarea maxLength={80} onChange={(event) => setBio(event.target.value)} placeholder="最多 80 个字" value={bio} /></label>
    <div className="zg-account-contact"><span><strong>邮箱</strong><small>{profile?.contact.emailMasked || "未绑定"}</small></span><span><strong>手机号</strong><small>{profile?.contact.phoneMasked || "未绑定"}</small></span></div>
    <div className="zg-account-contact-form"><select disabled={Boolean(challengeId)} onChange={(event) => setContactKind(event.target.value as "email" | "phone")} value={contactKind}><option value="email">邮箱</option><option value="phone">手机号</option></select>{challengeId ? <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setContactCode(event.target.value.replace(/\D/gu, "").slice(0,6))} placeholder="6 位验证码" value={contactCode} /> : <input inputMode={contactKind === "email" ? "email" : "tel"} onChange={(event) => setContactValue(event.target.value)} placeholder={contactKind === "email" ? "新邮箱地址" : "新手机号"} value={contactValue} />}<button disabled={busy || (challengeId ? contactCode.length !== 6 : !contactValue.trim())} onClick={() => void run(async () => { const { mobileApi } = await import("./api-client"); if (!challengeId) { const result = await mobileApi.requestContactChallenge(contactKind, contactValue); setChallengeId(result.challengeId); return; } const result = await mobileApi.verifyContactChallenge(challengeId, contactCode); if (result.mergeRequired) throw new Error("该联系方式已属于其他账号，已创建人工合并工单"); setChallengeId(""); setContactCode(""); setContactValue(""); })} type="button">{challengeId ? "确认绑定" : "发送验证码"}</button></div>
    {error ? <p className="zg-auth-error" role="alert">{error}</p> : null}
    <button className="zg-sheet-primary" disabled={busy || nickname.trim().length < 2} onClick={() => void run(async () => { await onSave({ bio, nickname, serviceArea, serviceCityId }); onClose(); })} type="button">{busy ? "保存中..." : "保存资料"}</button>
  </div></Sheet>;
}

export function FilterSheet({
  catalog,
  onChange,
  onClose,
  resultCount,
  value,
}: {
  onChange: (value: MatchPreferences) => void;
  onClose: () => void;
  resultCount: number;
  catalog: ServiceCatalog;
  value: MatchPreferences;
}) {
  const update = <K extends keyof MatchPreferences>(key: K, next: MatchPreferences[K]) => onChange({ ...value, [key]: next });
  return (
    <Sheet onClose={onClose} title="筛选合适的教练">
      <div className="zg-filter-sheet">
        <FilterGroup label="运动项目" options={["全部项目", ...catalog.sports.map(item=>item.name)]} selected={value.sport} onSelect={(item) => update("sport", item)} />
        <FilterGroup label={`${catalog.city}区域`} options={[`全${catalog.city}`, ...catalog.regions.map(item=>item.name)]} selected={value.district} onSelect={(item) => update("district", item)} />
        <FilterGroup label="训练目标" options={["全部目标", ...TRAINING_GOAL_OPTIONS]} selected={value.goal} onSelect={(item) => update("goal", item)} />
        <FilterGroup label="服务对象" options={["全部人群", ...AUDIENCE_OPTIONS]} selected={value.audience} onSelect={(item) => update("audience", item)} />
        <FilterGroup label="希望时段" options={["不限", "工作日", "周末", "晚间"]} selected={value.desiredTime} onSelect={(item) => update("desiredTime", item as MatchPreferences["desiredTime"])} />
        <label className="zg-budget-control">
          <span><strong>课时预算</strong><b>不高于 ¥{value.budget}</b></span>
          <input max="1000" min="200" onChange={(event) => update("budget", Number(event.target.value))} step="20" type="range" value={value.budget} />
          <small><span>¥200</span><span>¥1000+</span></small>
        </label>
        <button className="zg-sheet-primary" onClick={onClose} type="button">查看 {resultCount} 位教练</button>
      </div>
    </Sheet>
  );
}

function FilterGroup({
  label,
  onSelect,
  options,
  selected,
}: {
  label: string;
  onSelect: (item: string) => void;
  options: string[];
  selected: string;
}) {
  return (
    <section className="zg-filter-group">
      <strong>{label}</strong>
      <div>{options.map((item) => <button aria-pressed={selected === item} className={selected === item ? "is-active" : ""} key={item} onClick={() => onSelect(item)} type="button">{item}</button>)}</div>
    </section>
  );
}

export function CitySheet({ catalog, cityId, district, onClose, onCity, onDistrict, onLocate }: { catalog:ServiceCatalog; cityId:ServiceCityId; district: string; onClose: () => void; onCity: (city:ServiceCityId) => Promise<void>; onDistrict: (district: string) => void; onLocate: () => Promise<void> }) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const run=async(action:()=>Promise<void>)=>{ if(busy)return; setBusy(true);setError("");try{await action();onClose();}catch(reason){setError(reason instanceof Error?reason.message:"城市切换失败");}finally{setBusy(false);} };
  return (
    <Sheet onClose={onClose} title="选择服务城市">
      <div className="zg-city-sheet">
        <p>支持北京、吉林长春。定位只判断城市，不保存坐标。</p>
        <button disabled={busy} onClick={()=>void run(onLocate)} type="button"><LocateFixed aria-hidden size={20}/><span><strong>{busy?"正在切换城市":"定位城市"}</strong><small>仅在点击后使用一次模糊位置</small></span></button>
        {SERVICE_CITIES.map(city=><button disabled={busy} className={cityId===city.id?"is-active":""} key={city.id} onClick={()=>void run(()=>onCity(city.id))} type="button"><span><strong>{city.name}</strong><small>{city.province}</small></span>{cityId===city.id?<Check aria-hidden size={18}/>:<ChevronRight aria-hidden size={17}/>}</button>)}
        {error?<p className="zg-auth-error" role="alert">{error}</p>:null}
        <p>{catalog.city}服务区域</p>
        {[`全${catalog.city}`, ...catalog.regions.map(item=>item.name)].map((item) => (
          <button className={district === item ? "is-active" : ""} key={item} onClick={() => { onDistrict(item); onClose(); }} type="button">
            <span><strong>{item}</strong><small>{item.startsWith("全") ? "查看当前城市已核验教练" : "优先展示可就近训练的教练"}</small></span>
            {district === item ? <Check aria-hidden size={18} /> : <ChevronRight aria-hidden size={17} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function NotificationsSheet({ notifications, onClose }: { notifications: MobileNotification[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} title="通知">
      <div className="zg-notification-list">
        {notifications.map((notification) => (
          <article key={notification.id}>
            <span>{notification.type === "coach_message" ? <MessageCircle size={20} /> : notification.type === "credential" ? <ShieldCheck size={20} /> : <Smartphone size={20} />}</span>
            <div><strong>{notification.title}</strong><p>{notification.body}</p><small>{typeof notification.createdAt === "string" ? notification.createdAt : new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(notification.createdAt)}</small></div>
            {!notification.read ? <b /> : null}
          </article>
        ))}
        {notifications.length ? <p>已显示最近 30 天通知</p> : <EmptyState description="预约确认、改期和教练消息会出现在这里。" icon="message" title="暂无新通知" />}
      </div>
    </Sheet>
  );
}

export function AuthSheet({
  challengeSent,
  code,
  email,
  error,
  loading,
  onChangeCode,
  onChangeEmail,
  onChangeTurnstileToken,
  onClose,
  onRequestCode,
  onVerify,
  nativeSecurity,
  showLocalCode,
  turnstileSiteKey,
  turnstileToken,
}: {
  challengeSent: boolean;
  code: string;
  email: string;
  error: string;
  loading: boolean;
  onChangeCode: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangeTurnstileToken: (value: string) => void;
  onClose: () => void;
  onRequestCode: () => void;
  onVerify: () => void;
  nativeSecurity: boolean;
  showLocalCode: boolean;
  turnstileSiteKey: string;
  turnstileToken: string;
}) {
  const turnstileHost = useRef<HTMLDivElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = challengeSent ? codeInput.current : emailInput.current;
    const frame = window.requestAnimationFrame(() => {
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [challengeSent]);

  useEffect(() => {
    if (challengeSent || nativeSecurity || showLocalCode || !turnstileSiteKey) return;
    let active = true;
    let widgetId = "";
    const mount = () => {
      if (!active || !window.turnstile || !turnstileHost.current || widgetId) return;
      widgetId = window.turnstile.render(turnstileHost.current, {
        action: "mobile_email_login",
        appearance: "interaction-only",
        callback: (token: string) => onChangeTurnstileToken(token),
        "error-callback": () => onChangeTurnstileToken(""),
        sitekey: turnstileSiteKey,
        theme: "light",
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-zg-turnstile="true"]');
    if (existing) mount();
    else {
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.dataset.zgTurnstile = "true";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.addEventListener("load", mount, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      active = false;
      removeTurnstileWidget(window.turnstile, widgetId || null);
      onChangeTurnstileToken("");
    };
  }, [challengeSent, nativeSecurity, onChangeTurnstileToken, showLocalCode, turnstileSiteKey]);

  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
  const securityReady = nativeSecurity || showLocalCode || Boolean(turnstileToken);
  return (
    <Sheet onClose={onClose} title="验证邮箱后继续">
      <div className="zg-auth-sheet">
        <span className="zg-auth-icon"><Mail aria-hidden size={29} /></span>
        <h3>用于同步收藏与预约进度</h3>
        <p>仅在提交预约和同步个人服务记录时需要登录，浏览教练无需注册。</p>
        <label><span>邮箱地址</span><input autoCapitalize="none" autoComplete="email" data-sheet-autofocus={!challengeSent ? "true" : undefined} enterKeyHint="next" inputMode="email" maxLength={254} onChange={(event) => onChangeEmail(event.target.value.trim())} placeholder="name@example.com" ref={emailInput} value={email} /></label>
        {!challengeSent && !nativeSecurity && !showLocalCode ? <div className="zg-turnstile-host" ref={turnstileHost} /> : null}
        {challengeSent ? <label><span>验证码</span><input autoComplete="one-time-code" data-sheet-autofocus="true" enterKeyHint="done" inputMode="numeric" maxLength={6} onChange={(event) => onChangeCode(event.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]*" placeholder="请输入 6 位验证码" ref={codeInput} value={code} /></label> : null}
        {error ? <p className="zg-auth-error">{error}</p> : null}
        <button className="zg-sheet-primary" disabled={loading || !emailReady || (!challengeSent && !securityReady) || (challengeSent && code.length !== 6)} onClick={challengeSent ? onVerify : onRequestCode} type="button">
          {loading ? "请稍候..." : challengeSent ? "验证并继续" : "获取验证码"}
        </button>
        <small><LockKeyhole aria-hidden size={14} />邮箱经加密存储，不会向教练公开。{nativeSecurity ? " 验证码请求受设备识别与频率限制保护。" : showLocalCode ? " 本地测试验证码为 888888。" : ""}</small>
        {!nativeSecurity && !showLocalCode && !turnstileSiteKey ? <p className="zg-auth-error">安全验证服务正在配置，暂时无法发送验证码。</p> : null}
      </div>
    </Sheet>
  );
}

export function BookingSuccessSheet({ coach, onClose, onViewBooking }: { coach: MobileCoach; onClose: () => void; onViewBooking: () => void }) {
  return (
    <Sheet onClose={onClose} title="预约申请已提交">
      <div className="zg-success-sheet">
        <span><Check aria-hidden size={30} /></span>
        <h3>等待 {coach.name} 教练确认</h3>
        <p>教练将在 24 小时内处理。确认、拒绝或改期都会通过站内消息同步。</p>
        <button className="zg-sheet-primary" onClick={onViewBooking} type="button">查看预约进度</button>
        <button onClick={onClose} type="button">继续浏览教练</button>
      </div>
    </Sheet>
  );
}

export function CancelBookingSheet({ onCancel, onClose }: { onCancel: () => void; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} title="取消预约申请">
      <div className="zg-danger-sheet">
        <span><Trash2 aria-hidden size={27} /></span>
        <h3>确认取消这次预约？</h3>
        <p>取消规则以预约确认页及已发布的服务协议为准；如有争议可提交站内工单。</p>
        <div><button onClick={onClose} type="button">保留预约</button><button onClick={onCancel} type="button">确认取消</button></div>
      </div>
    </Sheet>
  );
}

export function FavoritesSheet({ coaches, onClose, onOpen }: { coaches: MobileCoach[]; onClose: () => void; onOpen: (coach: MobileCoach) => void }) {
  return (
    <Sheet onClose={onClose} title="收藏与对比">
      {coaches.length ? <div className="zg-favorites-sheet">{coaches.map((coach) => <button key={coach.id} onClick={() => onOpen(coach)} type="button"><CoachAvatar coach={coach} size="medium" /><span><strong>{coach.name}</strong><small>{coach.sport} · {coach.level}</small></span><b>{coach.price === undefined ? "价格待发布" : `¥${coach.price}/节`}</b><ChevronRight size={17} /></button>)}</div> : <EmptyState description="收藏感兴趣的教练后，可以在这里快速比较。" icon="search" title="还没有收藏教练" />}
    </Sheet>
  );
}

export function LearnerSheet({ learner, learners, onClose, onSave, onSelect }: { learner: LearnerProfile; learners:LearnerProfile[]; onClose: () => void; onSave: (learner: LearnerProfile) => Promise<LearnerProfile>; onSelect:(learner:LearnerProfile)=>void }) {
  const [draft, setDraft] = useState(learner);
  const [mode,setMode]=useState<"list"|"detail"|"edit">(learners.length?"list":"edit");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const update = <K extends keyof LearnerProfile>(key: K, value: LearnerProfile[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save=async()=>{if(busy)return;setBusy(true);setError("");try{const saved=await onSave(draft);setDraft(saved);setMode("detail");}catch(reason){setError(reason instanceof Error?reason.message:"档案保存失败，请重试");}finally{setBusy(false);}};
  const create=()=>{setDraft({...learner,id:"",name:"",age:0,goal:"",relation:"self",gender:"unspecified"});setError("");setMode("edit");};
  return (
    <Sheet onClose={onClose} title={mode==="list"?"学员档案":mode==="detail"?"档案详情":draft.id?"编辑学员档案":"新增学员档案"}>
      <div className="zg-learner-sheet">
        {mode==="list"?<><div className="zg-favorites-sheet">{learners.map(item=><button key={item.id} onClick={()=>{setDraft(item);setMode("detail");}} type="button"><span><strong>{item.name}</strong><small>{item.relation==="child"?"子女":"本人"} · {item.sport} · {item.goal}</small></span><ChevronRight aria-hidden size={18}/></button>)}</div><button className="zg-sheet-primary" onClick={create} type="button"><Plus aria-hidden size={18}/>新增学员档案</button></>:<>
        {learners.length?<button className="zg-text-action" onClick={()=>setMode("list")} type="button">返回档案列表</button>:null}
        <header><span>{draft.name.slice(-1) || "学"}</span><div><h3>{draft.name || "我的学员"}</h3><p>{draft.age ? `${draft.age} 岁 · ` : ""}{draft.sport} {draft.level}</p></div></header>
        {mode==="detail"?<><p>训练目标：{draft.goal}</p><p>{draft.relation==="child"?"子女档案":"本人档案"} · {draft.gender==="male"?"男":draft.gender==="female"?"女":"未填写性别"}</p><button className="zg-sheet-primary" onClick={()=>{onSelect(draft);onClose();}} type="button">选择此学员</button><button className="zg-sheet-primary is-secondary" onClick={()=>setMode("edit")} type="button">编辑档案</button></>:<>
        <div className="zg-learner-form">
          <label><span>姓名或称呼</span><input maxLength={20} onChange={(event) => update("name", event.target.value)} value={draft.name} /></label>
          <label><span>档案关系</span><select onChange={event=>update("relation",event.target.value as LearnerProfile["relation"])} value={draft.relation}><option value="self">本人</option><option value="child">子女</option></select></label>
          <label><span>性别（可选）</span><select onChange={event=>update("gender",event.target.value as LearnerProfile["gender"])} value={draft.gender}><option value="unspecified">不填写</option><option value="male">男</option><option value="female">女</option></select></label>
          <label><span>年龄</span><input max={100} min={0} onChange={(event) => update("age", Number(event.target.value))} type="number" value={draft.age || ""} /></label>
          <label><span>运动项目</span><select onChange={(event) => update("sport", event.target.value)} value={draft.sport}>{SUPPORTED_SPORTS.map(sport=><option key={sport}>{sport}</option>)}</select></label>
          <label><span>当前水平</span><select onChange={(event) => update("level", event.target.value)} value={draft.level}><option>待完善</option><option>零基础</option><option>入门</option><option>进阶</option><option>竞赛</option></select></label>
          <label className="is-wide"><span>训练目标</span><input maxLength={80} onChange={(event) => update("goal", event.target.value)} value={draft.goal} /></label>
        </div>
        <p>档案仅用于匹配教练与制定训练计划，不向无关人员公开。</p>
        {error?<p className="zg-auth-error" role="alert">{error}</p>:null}
        <button className="zg-sheet-primary" disabled={busy || !draft.name.trim() || !draft.goal.trim()} onClick={()=>void save()} type="button">{busy?"正在保存":"保存档案"}</button>
        </>}
        </>}
      </div>
    </Sheet>
  );
}

export function AccountSheet({ onClose, onDelete, onLogout, session }: { onClose: () => void; onDelete: () => void; onLogout: () => void; session: MobileSession | null }) {
  const [policy, setPolicy] = useState<"privacy" | "terms" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!policy) return;
    let active = true;
    void mobileApi.legalDocuments().then(data => { if (active) { setDocuments(data); setError(''); } }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '协议读取失败，请重试'); });
    return () => { active = false; };
  }, [policy, retry]);
  return (
    <Sheet onClose={onClose} title="账号与隐私">
      <div className="zg-account-sheet">
        <section><strong>登录状态</strong><p>{session ? `${session.contactMasked || session.phoneMasked} 已验证` : "当前为匿名浏览，提交预约时再验证邮箱。"}</p></section>
        <section><strong>隐私与数据</strong><p>可查看并管理个人资料授权、训练档案、消息记录与账号注销。</p></section>
        <button onClick={() => setPolicy(policy === "privacy" ? null : "privacy")} type="button">隐私政策<ChevronRight size={17} /></button>
        {policy === "privacy" ? <div>{documents.find(item => item.slug === "privacy")?.body.split(/\n\s*\n/u).map((text, index) => <p key={index}>{text}</p>) || <p>正在读取隐私政策</p>}</div> : null}
        <button onClick={() => setPolicy(policy === "terms" ? null : "terms")} type="button">用户协议<ChevronRight size={17} /></button>
        {policy === "terms" ? <div>{documents.find(item => item.slug === "terms")?.body.split(/\n\s*\n/u).map((text, index) => <p key={index}>{text}</p>) || <p>正在读取服务协议</p>}</div> : null}{policy && error ? <p role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>重试</button></p> : null}
        {session && !confirmingDelete ? <button onClick={() => setConfirmingDelete(true)} type="button">申请注销账号<ChevronRight size={17} /></button> : null}
        {confirmingDelete ? <section><strong>确认注销账号？</strong><p>邮箱与学员资料会去标识化，履约争议所需记录按实际需要保留。</p><button className="is-danger" onClick={onDelete} type="button">确认注销</button><button onClick={() => setConfirmingDelete(false)} type="button">暂不注销</button></section> : null}
        {session ? <button className="is-danger" onClick={onLogout} type="button">退出登录</button> : null}
      </div>
    </Sheet>
  );
}

export function SupportSheet({
  mode,
  onClose,
  onSubmit,
}: {
  mode: "assurance" | "feedback";
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const assurance = mode === "assurance";
  return (
    <Sheet onClose={onClose} title={assurance ? "服务保障" : "帮助与反馈"}>
      <div className="zg-support-sheet">
        <span>{assurance ? <ShieldCheck aria-hidden size={28} /> : <Headphones aria-hidden size={28} />}</span>
        <h3>{assurance ? "每一次预约都有清晰记录" : "告诉我们哪里还能做得更好"}</h3>
        {assurance ? (
          <>
            <ul>
              <li><strong>教练履历核验</strong><small>试点教练需通过人工审核后展示。</small></li>
              <li><strong>预约过程留痕</strong><small>确认、改期、取消和完成均记录状态变化。</small></li>
              <li><strong>先确认后生效</strong><small>教练确认后预约生效，首版在线下支付。</small></li>
              <li><strong>争议协助</strong><small>消息与履约记录按实际服务及争议处理需要保存。</small></li>
            </ul>
            <button className="zg-sheet-primary" onClick={onClose} type="button">我知道了</button>
          </>
        ) : (
          <>
            <label><span>问题或建议</span><textarea maxLength={500} onChange={(event) => setMessage(event.target.value)} placeholder="请描述遇到的问题、发生页面和期望结果" rows={5} value={message} /></label>
            <small>{message.length}/500 · 请勿填写身份证号等敏感信息</small>
            {error ? <p className="zg-auth-error" role="alert">{error}</p> : null}
            <button className="zg-sheet-primary" disabled={!message.trim() || submitting} onClick={() => { setSubmitting(true); setError(""); void onSubmit(message.trim()).then(onClose).catch((reason) => setError(reason instanceof Error ? reason.message : "反馈提交失败，请稍后重试")).finally(() => setSubmitting(false)); }} type="button">{submitting ? "提交中..." : "提交反馈"}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
