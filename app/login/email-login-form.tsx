"use client";

import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import Script from "next/script";
import { useCallback, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: Record<string, unknown>): string;
      reset(widgetId: string): void;
    };
  }
}

export function EmailLoginForm({ returnTo, siteKey }: { returnTo: string; siteKey?: string }) {
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mountTurnstile = useCallback(() => {
    if (!siteKey || !window.turnstile || !widgetHost.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetHost.current, {
      action: "email_login",
      appearance: "interaction-only",
      callback: (token: string) => setTurnstileToken(token),
      "error-callback": () => setError("安全验证加载失败，请刷新后重试"),
      sitekey: siteKey,
      theme: "light",
    });
  }, [siteKey]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const endpoint = challengeId ? "/api/auth/email/verify" : "/api/auth/email/request";
      const response = await fetch(endpoint, {
        body: JSON.stringify(challengeId ? { challengeId, code } : { email, turnstileToken }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await response.json() as { data?: { challengeId?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "登录服务暂时不可用");
      if (!challengeId) {
        setChallengeId(payload.data?.challengeId || "");
        setTurnstileToken("");
      } else {
        window.location.assign(returnTo);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录服务暂时不可用");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="zg-email-login">
      {siteKey ? <Script onLoad={mountTurnstile} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" /> : null}
      <label>
        <span>{challengeId ? "邮箱验证码" : "邮箱地址"}</span>
        <div>
          <Mail aria-hidden size={18} />
          <input
            autoComplete={challengeId ? "one-time-code" : "email"}
            inputMode={challengeId ? "numeric" : "email"}
            maxLength={challengeId ? 6 : 254}
            onChange={(event) => challengeId ? setCode(event.target.value.replace(/\D/gu, "")) : setEmail(event.target.value.trim())}
            placeholder={challengeId ? "输入 6 位验证码" : "name@example.com"}
            value={challengeId ? code : email}
          />
        </div>
      </label>
      {challengeId ? <p className="zg-email-login-status">验证码已发送至 {email}</p> : <div ref={widgetHost} className="zg-turnstile-host" />}
      {error ? <p className="zg-email-login-error" role="alert">{error}</p> : null}
      <button disabled={loading || !siteKey || (challengeId ? code.length !== 6 : !email || !turnstileToken)} onClick={() => void submit()} type="button">
        {loading ? <LoaderCircle aria-hidden className="is-spinning" size={18} /> : null}
        {challengeId ? "验证并进入平台" : "获取邮箱验证码"}
        {!loading ? <ArrowRight aria-hidden size={18} /> : null}
      </button>
      {!siteKey ? <p className="zg-email-login-error">邮箱登录通道正在完成安全配置，可先使用下方身份登录。</p> : null}
    </div>
  );
}
