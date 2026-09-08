"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import Script from "next/script";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { removeTurnstileWidget } from "../_lib/turnstile";

export function PrivacyRequestForm({ siteKey }: { siteKey?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const mount = useCallback(() => {
    if (!siteKey || !window.turnstile || !host.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(host.current, {
      action: "privacy_request",
      appearance: "interaction-only",
      callback: setToken,
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
    const phone = String(data.get("contactPhone") || "").trim();
    const wechat = String(data.get("contactWechat") || "").trim();
    const email = String(data.get("contactEmail") || "").trim();
    if (!phone && !wechat && !email) {
      setState("error");
      setMessage("请至少填写一种联系方式，方便反馈处理结果。");
      return;
    }
    setState("sending");
    setMessage("");
    try {
      const response = await fetch(`/api/platform?path=${encodeURIComponent("/api/v1/privacy-requests")}`, {
        body: JSON.stringify({
          contactEmail: email,
          contactName: String(data.get("contactName") || "").trim(),
          contactPhone: phone,
          contactWechat: wechat,
          request: String(data.get("request") || "").trim(),
          turnstileToken: token,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "提交失败，请稍后重试");
      form.reset();
      setState("sent");
      setMessage("隐私请求已提交。联系方式只用于核实和反馈本次请求。");
      setToken("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试");
    } finally {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  return <form className="zg-service-lead-form" onSubmit={submit}>
    {siteKey ? <Script onLoad={mount} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" /> : null}
    <label><span>怎么称呼</span><input autoComplete="name" maxLength={40} name="contactName" required /></label>
    <label><span>手机号（选填）</span><input autoComplete="tel" inputMode="tel" maxLength={30} name="contactPhone" type="tel" /></label>
    <label><span>微信号（选填）</span><input autoCapitalize="none" autoComplete="off" maxLength={64} name="contactWechat" /></label>
    <label><span>邮箱（选填）</span><input autoComplete="email" inputMode="email" maxLength={254} name="contactEmail" type="email" /></label>
    <label className="is-wide"><span>需要查询、更正、删除或投诉的问题</span><textarea maxLength={1000} minLength={10} name="request" required rows={4} /></label>
    <p className="zg-service-lead-note">无需登录。请勿在说明中填写身份证、未成年人姓名或其他不必要的敏感信息。</p>
    {siteKey ? <div className="zg-turnstile-host zg-service-turnstile" ref={host} /> : <p className="is-error">匿名隐私通道正在完成安全配置，请稍后再试。</p>}
    <button disabled={state === "sending" || !siteKey || !token} type="submit">{state === "sending" ? <LoaderCircle aria-hidden className="is-spinning" size={17} /> : state === "sent" ? <CheckCircle2 aria-hidden size={17} /> : <Send aria-hidden size={17} />}{state === "sending" ? "正在提交" : state === "sent" ? "已提交" : "提交隐私请求"}</button>
    {message ? <p className={state === "error" ? "is-error" : "is-success"} role={state === "error" ? "alert" : "status"}>{message}</p> : null}
  </form>;
}
