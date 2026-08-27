import { ApiError, type ApiEnv } from "./contracts";
import { randomId, sha256Hex } from "./security";

const encoder = new TextEncoder();
const SES_HOST = "ses.tencentcloudapi.com";
const SES_SERVICE = "ses";
const SES_VERSION = "2020-10-02";

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function utf8ToBase64(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function hmac(key: Uint8Array | string, value: string) {
  const raw = typeof key === "string" ? encoder.encode(key) : key;
  const rawBuffer = Uint8Array.from(raw).buffer;
  const cryptoKey = await crypto.subtle.importKey("raw", rawBuffer, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value)));
}

async function signedTencentRequest(action: string, payload: Record<string, unknown>, env: ApiEnv) {
  const secretId = env.TENCENTCLOUD_SECRET_ID;
  const secretKey = env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey || !env.TENCENT_SES_FROM_EMAIL) {
    throw new ApiError(503, "email_provider_unavailable", "邮箱验证码服务尚未完成配置");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${SES_HOST}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${await sha256Hex(body)}`;
  const credentialScope = `${date}/${SES_SERVICE}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
  const secretDate = await hmac(`TC3${secretKey}`, date);
  const secretService = await hmac(secretDate, SES_SERVICE);
  const secretSigning = await hmac(secretService, "tc3_request");
  const signature = bytesToHex(await hmac(secretSigning, stringToSign));
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${SES_HOST}/`, {
    body,
    headers: {
      authorization,
      "content-type": "application/json; charset=utf-8",
      host: SES_HOST,
      "x-tc-action": action,
      "x-tc-region": env.TENCENT_SES_REGION ?? "ap-guangzhou",
      "x-tc-timestamp": String(timestamp),
      "x-tc-version": SES_VERSION,
    },
    method: "POST",
  });
  const result = await response.json() as {
    Response?: { Error?: { Code?: string; Message?: string }; MessageId?: string; RequestId?: string };
  };
  if (!response.ok || result.Response?.Error) {
    console.error("Tencent SES request failed", {
      code: result.Response?.Error?.Code,
      requestId: result.Response?.RequestId,
      status: response.status,
    });
    throw new ApiError(503, "email_delivery_failed", "验证码邮件发送失败，请稍后重试");
  }
  return result.Response?.MessageId ?? result.Response?.RequestId ?? randomId("ses");
}

export async function sendEmailOtp(email: string, code: string, env: ApiEnv, purpose: "bind" | "login" = "login") {
  const fromName = (env.TENCENT_SES_FROM_NAME ?? "逐光").replace(/[<>\r\n]/gu, "").slice(0, 32);
  const fromEmail = env.TENCENT_SES_FROM_EMAIL!;
  const safeCode = code.replace(/\D/gu, "").slice(0, 6);
  const action = purpose === "bind" ? "绑定或更换邮箱" : "登录";
  const html = `<div style="background:#f4f7f5;padding:32px 16px;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;color:#10231b"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe7e2;border-radius:8px"><tr><td style="padding:30px 32px 16px"><div style="font-size:20px;font-weight:700;color:#087a46">逐光</div><div style="margin-top:4px;font-size:12px;color:#738078">运动教练服务平台</div></td></tr><tr><td style="padding:8px 32px 34px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.4">${action}验证码</h1><p style="margin:0;color:#536159;font-size:14px;line-height:1.8">你正在${action}，请输入以下验证码完成身份验证。</p><div style="margin:24px 0;padding:18px 20px;background:#f1f8f4;border-left:3px solid #087a46;font-size:30px;font-weight:700;letter-spacing:8px;color:#10231b">${safeCode}</div><p style="margin:0;color:#536159;font-size:13px;line-height:1.8">验证码 5 分钟内有效，请勿向任何人透露。若非本人操作，可忽略此邮件，账号不会受到影响。</p></td></tr><tr><td style="border-top:1px solid #e5ebe7;padding:18px 32px;color:#849089;font-size:11px;line-height:1.7">此邮件由逐光系统自动发送，请勿直接回复。</td></tr></table></div>`;
  const text = `逐光运动教练服务平台\n\n${action}验证码：${safeCode}\n\n验证码 5 分钟内有效，请勿向任何人透露。若非本人操作，可忽略此邮件，账号不会受到影响。\n\n此邮件由逐光系统自动发送，请勿直接回复。`;
  const templateId = Number(env.TENCENT_SES_TEMPLATE_ID ?? 0);
  return signedTencentRequest("SendEmail", {
    Destination: [email],
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    ReplyToAddresses: fromEmail,
    ...(Number.isInteger(templateId) && templateId > 0
      ? { Template: { TemplateData: JSON.stringify({ code: safeCode }), TemplateID: templateId } }
      : { Simple: { Html: utf8ToBase64(html), Text: utf8ToBase64(text) } }),
    Subject: `逐光${action}验证码`,
  }, env);
}
