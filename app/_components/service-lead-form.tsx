"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { removeTurnstileWidget } from "../_lib/turnstile";

export function ServiceLeadForm({ coachId = 5, siteKey }: { coachId?: number; siteKey?: string }) {
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [state, setState] = useState<"error" | "idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const mountTurnstile = useCallback(() => {
    if (!siteKey || !window.turnstile || !widgetHost.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetHost.current, {
      action: "service_inquiry",
      appearance: "interaction-only",
      callback: (token: string) => setTurnstileToken(token),
      "error-callback": () => setMessage("安全验证加载失败，请刷新后重试。"),
      sitekey: siteKey,
      theme: "light",
    });
  }, [siteKey]);

  useEffect(() => () => {
    removeTurnstileWidget(window.turnstile, widgetId.current);
    widgetId.current = null;
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState("sending");
    setMessage("");

    try {
      const response = await fetch(`/api/platform?path=${encodeURIComponent("/api/v1/service-leads")}`, {
        body: JSON.stringify({
          coachId,
          contactEmail: String(data.get("contactEmail") || "").trim(),
          contactName: String(data.get("contactName") || "").trim(),
          district: String(data.get("district") || "通州区"),
          goal: String(data.get("goal") || "").trim(),
          source: "official-site",
          sport: "田径",
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
      setMessage("需求已进入逐光运营工作台，我们会在核对服务安排后与你联系。");
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
      <label>
        <span>怎么称呼</span>
        <input maxLength={40} name="contactName" placeholder="你的称呼" required />
      </label>
      <label>
        <span>联系邮箱</span>
        <input autoCapitalize="none" autoComplete="email" inputMode="email" maxLength={254} name="contactEmail" placeholder="name@example.com" required type="email" />
      </label>
      <label>
        <span>训练区域</span>
        <select defaultValue="通州区" name="district">
          <option>通州区</option>
          <option>朝阳区</option>
          <option>海淀区</option>
          <option>北京其他区域</option>
        </select>
      </label>
      <label className="is-wide">
        <span>训练需求</span>
        <textarea
          maxLength={500}
          name="goal"
          placeholder="例如：孩子准备中考体育，希望评估跑姿并安排每周训练"
          required
          rows={3}
        />
      </label>
      {siteKey ? <div ref={widgetHost} className="zg-turnstile-host zg-service-turnstile" /> : <p className="is-error">咨询通道正在完成安全配置，请稍后再试。</p>}
      <button disabled={state === "sending" || !siteKey || !turnstileToken} type="submit">
        {state === "sending" ? <LoaderCircle aria-hidden className="is-spinning" size={17} /> : state === "sent" ? <CheckCircle2 aria-hidden size={17} /> : <Send aria-hidden size={17} />}
        {state === "sending" ? "正在提交" : state === "sent" ? "已提交" : "提交训练需求"}
      </button>
      {message ? <p className={state === "error" ? "is-error" : "is-success"} role={state === "error" ? "alert" : "status"}>{message}</p> : null}
    </form>
  );
}
