"use client";

import { Check, ChevronRight, Headphones, LockKeyhole, Mail, MessageCircle, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { removeTurnstileWidget } from "../_lib/turnstile";
import { CoachAvatar, EmptyState, Sheet } from "./components";
import type { LearnerProfile, MatchPreferences, MobileCoach, MobileNotification, MobileSession } from "./types";

export function FilterSheet({
  onChange,
  onClose,
  resultCount,
  value,
}: {
  onChange: (value: MatchPreferences) => void;
  onClose: () => void;
  resultCount: number;
  value: MatchPreferences;
}) {
  const update = <K extends keyof MatchPreferences>(key: K, next: MatchPreferences[K]) => onChange({ ...value, [key]: next });
  return (
    <Sheet onClose={onClose} title="筛选合适的教练">
      <div className="zg-filter-sheet">
        <FilterGroup label="运动项目" options={["全部项目", "田径", "羽毛球", "游泳", "网球", "篮球"]} selected={value.sport} onSelect={(item) => update("sport", item)} />
        <FilterGroup label="北京区域" options={["全北京", "通州区", "朝阳区", "海淀区", "东城区"]} selected={value.district} onSelect={(item) => update("district", item)} />
        <FilterGroup label="训练目标" options={["全部目标", "兴趣入门", "专项提升", "比赛备战", "动作纠错", "校队选拔"]} selected={value.goal} onSelect={(item) => update("goal", item)} />
        <FilterGroup label="服务对象" options={["全部人群", "儿童", "青少年", "成人", "亲子"]} selected={value.audience} onSelect={(item) => update("audience", item)} />
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

export function CitySheet({ district, onClose, onDistrict }: { district: string; onClose: () => void; onDistrict: (district: string) => void }) {
  return (
    <Sheet onClose={onClose} title="选择北京服务区域">
      <div className="zg-city-sheet">
        <p>北京为首个运营试点城市，后续将根据教练供给逐步开放更多城市。</p>
        {["全北京", "朝阳区", "海淀区", "东城区"].map((item) => (
          <button className={district === item ? "is-active" : ""} key={item} onClick={() => { onDistrict(item); onClose(); }} type="button">
            <span><strong>{item}</strong><small>{item === "全北京" ? "查看全部已核验教练" : "优先展示可就近训练的教练"}</small></span>
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
  showLocalCode: boolean;
  turnstileSiteKey: string;
  turnstileToken: string;
}) {
  const turnstileHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (challengeSent || showLocalCode || !turnstileSiteKey) return;
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
  }, [challengeSent, onChangeTurnstileToken, showLocalCode, turnstileSiteKey]);

  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
  const securityReady = showLocalCode || Boolean(turnstileToken);
  return (
    <Sheet onClose={onClose} title="验证邮箱后继续">
      <div className="zg-auth-sheet">
        <span className="zg-auth-icon"><Mail aria-hidden size={29} /></span>
        <h3>用于同步收藏与预约进度</h3>
        <p>仅在提交预约和同步个人服务记录时需要登录，浏览教练无需注册。</p>
        <label><span>邮箱地址</span><input autoCapitalize="none" autoComplete="email" inputMode="email" maxLength={254} onChange={(event) => onChangeEmail(event.target.value.trim())} placeholder="name@example.com" value={email} /></label>
        {!challengeSent && !showLocalCode ? <div className="zg-turnstile-host" ref={turnstileHost} /> : null}
        {challengeSent ? <label><span>验证码</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => onChangeCode(event.target.value.replace(/\D/g, ""))} placeholder="请输入 6 位验证码" value={code} /></label> : null}
        {error ? <p className="zg-auth-error">{error}</p> : null}
        <button className="zg-sheet-primary" disabled={loading || !emailReady || (!challengeSent && !securityReady) || (challengeSent && code.length !== 6)} onClick={challengeSent ? onVerify : onRequestCode} type="button">
          {loading ? "请稍候..." : challengeSent ? "验证并继续" : "获取验证码"}
        </button>
        <small><LockKeyhole aria-hidden size={14} />邮箱经加密存储，不会向教练公开。{showLocalCode ? " 本地测试验证码为 888888。" : ""}</small>
        {!showLocalCode && !turnstileSiteKey ? <p className="zg-auth-error">安全验证服务正在配置，暂时无法发送验证码。</p> : null}
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
        <p>教练将在 24 小时内处理。确认、拒绝或改期都会通过站内消息与短信通知。</p>
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
        <p>取消后时段会重新释放。试课开始前 24 小时内取消可能需要人工审核。</p>
        <div><button onClick={onClose} type="button">保留预约</button><button onClick={onCancel} type="button">确认取消</button></div>
      </div>
    </Sheet>
  );
}

export function FavoritesSheet({ coaches, onClose, onOpen }: { coaches: MobileCoach[]; onClose: () => void; onOpen: (coach: MobileCoach) => void }) {
  return (
    <Sheet onClose={onClose} title="收藏与对比">
      {coaches.length ? <div className="zg-favorites-sheet">{coaches.map((coach) => <button key={coach.id} onClick={() => onOpen(coach)} type="button"><CoachAvatar coach={coach} size="medium" /><span><strong>{coach.name}</strong><small>{coach.sport} · {coach.level}</small></span><b>¥{coach.price}/节</b><ChevronRight size={17} /></button>)}</div> : <EmptyState description="收藏感兴趣的教练后，可以在这里快速比较。" icon="search" title="还没有收藏教练" />}
    </Sheet>
  );
}

export function LearnerSheet({ learner, onClose, onSave }: { learner: LearnerProfile; onClose: () => void; onSave: (learner: LearnerProfile) => void }) {
  const [draft, setDraft] = useState(learner);
  const update = <K extends keyof LearnerProfile>(key: K, value: LearnerProfile[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Sheet onClose={onClose} title="学员训练档案">
      <div className="zg-learner-sheet">
        <header><span>{draft.name.slice(-1) || "学"}</span><div><h3>{draft.name || "我的学员"}</h3><p>{draft.age ? `${draft.age} 岁 · ` : ""}{draft.sport} {draft.level}</p></div></header>
        <div className="zg-learner-form">
          <label><span>姓名或称呼</span><input maxLength={20} onChange={(event) => update("name", event.target.value)} value={draft.name} /></label>
          <label><span>年龄</span><input max={100} min={0} onChange={(event) => update("age", Number(event.target.value))} type="number" value={draft.age || ""} /></label>
          <label><span>运动项目</span><select onChange={(event) => update("sport", event.target.value)} value={draft.sport}><option>田径</option><option>羽毛球</option><option>游泳</option><option>网球</option><option>篮球</option></select></label>
          <label><span>当前水平</span><select onChange={(event) => update("level", event.target.value)} value={draft.level}><option>待完善</option><option>零基础</option><option>入门</option><option>进阶</option><option>竞赛</option></select></label>
          <label className="is-wide"><span>训练目标</span><input maxLength={80} onChange={(event) => update("goal", event.target.value)} value={draft.goal} /></label>
        </div>
        <p>档案仅用于匹配教练与制定训练计划，不向无关人员公开。</p>
        <button className="zg-sheet-primary" disabled={!draft.name.trim() || !draft.goal.trim()} onClick={() => { onSave(draft); onClose(); }} type="button">保存档案</button>
      </div>
    </Sheet>
  );
}

export function AccountSheet({ onClose, onDelete, onLogout, session }: { onClose: () => void; onDelete: () => void; onLogout: () => void; session: MobileSession | null }) {
  const [policy, setPolicy] = useState<"privacy" | "terms" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <Sheet onClose={onClose} title="账号与隐私">
      <div className="zg-account-sheet">
        <section><strong>登录状态</strong><p>{session ? `${session.contactMasked || session.phoneMasked} 已验证` : "当前为匿名浏览，提交预约时再验证邮箱。"}</p></section>
        <section><strong>隐私与数据</strong><p>可查看并管理个人资料授权、训练档案、消息记录与账号注销。</p></section>
        <button onClick={() => setPolicy(policy === "privacy" ? null : "privacy")} type="button">隐私政策<ChevronRight size={17} /></button>
        {policy === "privacy" ? <p>逐光仅处理预约履约所需的邮箱、学员档案与消息记录；资质原件和敏感会话通过鉴权访问，消息最多保留 90 天用于服务保障。</p> : null}
        <button onClick={() => setPolicy(policy === "terms" ? null : "terms")} type="button">用户协议<ChevronRight size={17} /></button>
        {policy === "terms" ? <p>预约需经教练确认后生效，首版费用在线下支付；取消、改期与争议处理以预约页面展示的服务规则为准。</p> : null}
        {session && !confirmingDelete ? <button onClick={() => setConfirmingDelete(true)} type="button">申请注销账号<ChevronRight size={17} /></button> : null}
        {confirmingDelete ? <section><strong>确认注销账号？</strong><p>邮箱与学员资料会去标识化，履约争议所需记录最多保留 90 天。</p><button className="is-danger" onClick={onDelete} type="button">确认注销</button><button onClick={() => setConfirmingDelete(false)} type="button">暂不注销</button></section> : null}
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
  onSubmit: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
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
              <li><strong>争议协助</strong><small>消息与履约记录最多保留 90 天用于服务处理。</small></li>
            </ul>
            <button className="zg-sheet-primary" onClick={onClose} type="button">我知道了</button>
          </>
        ) : (
          <>
            <label><span>问题或建议</span><textarea maxLength={500} onChange={(event) => setMessage(event.target.value)} placeholder="请描述遇到的问题、发生页面和期望结果" rows={5} value={message} /></label>
            <small>{message.length}/500 · 请勿填写身份证号等敏感信息</small>
            <button className="zg-sheet-primary" disabled={!message.trim()} onClick={() => { onSubmit(message.trim()); onClose(); }} type="button">提交反馈</button>
          </>
        )}
      </div>
    </Sheet>
  );
}
