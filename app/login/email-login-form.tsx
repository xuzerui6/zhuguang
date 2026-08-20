"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { removeTurnstileWidget } from "../_lib/turnstile";

export function EmailLoginForm({ returnTo, siteKey }: { returnTo: string; siteKey?: string }) {
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

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

  const clearTurnstile = useCallback(() => {
    removeTurnstileWidget(window.turnstile, widgetId.current);
    widgetId.current = null;
  }, []);

  useEffect(() => clearTurnstile, [clearTurnstile]);
  useEffect(() => {
    if (!challengeId) queueMicrotask(mountTurnstile);
  }, [challengeId, mountTurnstile]);
  useEffect(() => {
    if (!siteKey || challengeId) return;
    if (window.turnstile) {
      mountTurnstile();
      return;
    }
    const selector = 'script[data-zg-turnstile="login"]';
    let script = document.querySelector<HTMLScriptElement>(selector);
    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.dataset.zgTurnstile = "login";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      document.head.append(script);
    }
    script.addEventListener("load", mountTurnstile);
    return () => script?.removeEventListener("load", mountTurnstile);
  }, [challengeId, mountTurnstile, siteKey]);
  useEffect(() => {
    if (!resendAfter && !expiresIn) return;
    const timer = window.setInterval(() => {
      setResendAfter((value) => Math.max(0, value - 1));
      setExpiresIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresIn, resendAfter]);

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
      const payload = await response.json() as { data?: { challengeId?: string; expiresIn?: number; retryAfter?: number }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "登录服务暂时不可用");
      if (!challengeId) {
        clearTurnstile();
        setChallengeId(payload.data?.challengeId || "");
        setTurnstileToken("");
        setResendAfter(payload.data?.retryAfter ?? 60);
        setExpiresIn(payload.data?.expiresIn ?? 300);
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

  function changeEmail() {
    clearTurnstile();
    setChallengeId("");
    setCode("");
    setError("");
    setExpiresIn(0);
    setResendAfter(0);
    setTurnstileToken("");
  }

  return (
    <div className="zg-email-login">
      <ol className="zg-login-steps" aria-label="登录步骤">
        <li data-active={!challengeId}><span>{challengeId ? <Check aria-hidden size={13} /> : "1"}</span>验证邮箱</li>
        <li data-active={Boolean(challengeId)}><span>2</span>输入验证码</li>
        <li><span>3</span>进入平台</li>
      </ol>
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
      {challengeId ? <div className="zg-code-status"><p className="zg-email-login-status">验证码已发送至 <strong>{email}</strong>，{expiresIn > 0 ? `${Math.ceil(expiresIn / 60)} 分钟内有效` : "已过期，请重新获取"}。</p><button onClick={changeEmail} type="button"><ArrowLeft aria-hidden size={14} />修改邮箱</button></div> : <div ref={widgetHost} className="zg-turnstile-host" />}
      {error ? <p className="zg-email-login-error" role="alert">{error}</p> : null}
      <button disabled={loading || !siteKey || (challengeId ? code.length !== 6 : !email || !turnstileToken)} onClick={() => void submit()} type="button">
        {loading ? <LoaderCircle aria-hidden className="is-spinning" size={18} /> : null}
        {challengeId ? "验证并进入平台" : "获取邮箱验证码"}
        {!loading ? <ArrowRight aria-hidden size={18} /> : null}
      </button>
      {challengeId ? <button className="zg-resend-code" disabled={loading || resendAfter > 0} onClick={changeEmail} type="button"><RotateCcw aria-hidden size={14} />{resendAfter > 0 ? `${resendAfter} 秒后可重新获取` : "重新获取验证码"}</button> : null}
      {!siteKey ? <p className="zg-email-login-error">邮箱登录通道正在完成安全配置，可先使用下方身份登录。</p> : null}
    </div>
  );
}
