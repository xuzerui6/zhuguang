"use client";

import { BadgeCheck, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BEIJING_DISTRICTS, SPORT_OPTIONS } from "../../shared/coach-catalog";
import { removeTurnstileWidget } from "../_lib/turnstile";

const learnerStages = ["幼儿", "小学低年级", "小学高年级", "初中", "高中", "成人"];

export function ServiceLeadForm({ coach, kind = "student", siteKey }: { coach?: { id: number; name: string; sport: string }; kind?: "coach" | "student"; siteKey?: string }) {
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [state, setState] = useState<"error" | "idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState("");
  const [contactError, setContactError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const mountTurnstile = useCallback(() => {
    if (!siteKey || !window.turnstile || !widgetHost.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetHost.current, {
      action: kind === "coach" ? "coach_partnership" : "service_inquiry",
      appearance: "interaction-only",
      callback: (token: string) => setTurnstileToken(token),
      "error-callback": () => setMessage("安全验证加载失败，请刷新后重试。"),
      sitekey: siteKey,
      theme: "light",
    });
  }, [kind, siteKey]);

  useEffect(() => () => {
    removeTurnstileWidget(window.turnstile, widgetId.current);
    widgetId.current = null;
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const contactPhone = String(data.get("contactPhone") || "").trim();
    const contactWechat = String(data.get("contactWechat") || "").trim();
    if (!contactPhone && !contactWechat) {
      setState("error");
      setContactError("请至少填写手机号或微信号");
      setMessage("请至少填写手机号或微信号，方便运营与你确认安排。");
      return;
    }
    setContactError("");
    setState("sending");
    setMessage("");

    try {
      const response = await fetch(`/api/platform?path=${encodeURIComponent(kind === "coach" ? "/api/v1/partnership-leads" : "/api/v1/service-leads")}`, {
        body: JSON.stringify({
          coachId: coach?.id,
          contactEmail: String(data.get("contactEmail") || "").trim(),
          contactName: String(data.get("contactName") || "").trim(),
          contactPhone,
          contactWechat,
          desiredTime: String(data.get("desiredTime") || "").trim(),
          district: String(data.get("district") || "通州区"),
          goal: String(data.get("goal") || "").trim(),
          learnerStage: kind === "student" ? String(data.get("learnerStage") || "") : undefined,
          sport: coach?.sport || String(data.get("sport") || "田径"),
          turnstileToken,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "提交失败，请稍后重试");
      form.reset();
      setState("sent");
      setTurnstileToken("");
      setMessage(kind === "coach" ? "合作意向已提交，运营核对资料后会与你联系。" : "需求已进入逐光运营工作台，我们会在核对服务安排后与你联系。");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试");
    } finally {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  return (
    <form className="zg-service-lead-form" onSubmit={submit}>
      {siteKey ? <Script onLoad={mountTurnstile} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" /> : null}
      {coach ? <p className="zg-service-lead-context"><BadgeCheck aria-hidden size={16} />正在咨询 <strong>{coach.name}</strong> · {coach.sport}</p> : null}
      <label>
        <span>{kind === "coach" ? "教练称呼" : "怎么称呼"}</span>
        <input autoComplete="name" maxLength={40} name="contactName" placeholder={kind === "coach" ? "你的姓名或称呼" : "你的称呼"} required />
      </label>
      <label>
        <span>手机号</span>
        <input aria-describedby={contactError ? "service-contact-error" : undefined} aria-invalid={Boolean(contactError)} autoComplete="tel" inputMode="tel" maxLength={30} name="contactPhone" placeholder="手机号或下方微信至少填一项" type="tel" />
      </label>
      <label>
        <span>微信号</span>
        <input aria-describedby={contactError ? "service-contact-error" : undefined} aria-invalid={Boolean(contactError)} autoCapitalize="none" autoComplete="off" maxLength={64} name="contactWechat" placeholder="用于确认服务安排" />
      </label>
      {contactError ? <p className="is-error zg-service-contact-error" id="service-contact-error" role="alert">{contactError}</p> : null}
      <label>
        <span>{kind === "coach" ? "可服务区域" : "训练区域"}</span>
        <select defaultValue="通州区" name="district">
          {BEIJING_DISTRICTS.map((district) => <option key={district}>{district}</option>)}
        </select>
      </label>
      {coach ? null : <label><span>运动项目</span><select defaultValue="田径" name="sport">{SPORT_OPTIONS.map((sport) => <option key={sport}>{sport}</option>)}</select></label>}
      <label className="is-wide">
        <span>{kind === "coach" ? "经历与合作方向" : "训练需求"}</span>
        <textarea
          maxLength={160}
          name="goal"
          placeholder={kind === "coach" ? "请简要说明运动经历、资质和擅长方向" : "例如：准备中考体育，希望评估跑姿并安排训练"}
          required
          rows={3}
        />
      </label>
      <details className="zg-service-lead-more">
        <summary>补充更多信息 <span>选填</span></summary>
        <div>
          <label><span>联系邮箱</span><input autoCapitalize="none" autoComplete="email" inputMode="email" maxLength={254} name="contactEmail" placeholder="name@example.com" type="email" /></label>
          {kind === "student" ? <label><span>年龄段或年级</span><select defaultValue="" name="learnerStage"><option value="">暂不填写</option>{learnerStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label> : null}
          <label><span>{kind === "coach" ? "可服务时间" : "期望训练时间"}</span><input maxLength={160} name="desiredTime" placeholder={kind === "coach" ? "例如：工作日晚间、周末" : "例如：周六上午或工作日晚间"} /></label>
        </div>
      </details>
      <p className="zg-service-lead-note">{kind === "coach" ? "提交意向不会自动开通教练账号，所有公开资料仍需人工核验。" : "咨询不收费，也不会自动生成预约；年龄段或年级仅用于匹配训练方案。"}</p>
      {siteKey ? <div ref={widgetHost} className="zg-turnstile-host zg-service-turnstile" /> : <p className="is-error">咨询通道正在完成安全配置，请稍后再试。</p>}
      <button disabled={state === "sending" || !siteKey || !turnstileToken} type="submit">
        {state === "sending" ? <LoaderCircle aria-hidden className="is-spinning" size={17} /> : state === "sent" ? <CheckCircle2 aria-hidden size={17} /> : <Send aria-hidden size={17} />}
        {state === "sending" ? "正在提交" : state === "sent" ? "已提交" : kind === "coach" ? "提交合作意向" : "提交训练需求"}
      </button>
      {message ? <p className={state === "error" ? "is-error" : "is-success"} role={state === "error" ? "alert" : "status"}>{message}</p> : null}
    </form>
  );
}
