import { ApiError, type ApiEnv } from "./contracts";
import { randomId, sha256Hex } from "./security";

const encoder = new TextEncoder();
const SES_HOST = "ses.tencentcloudapi.com";
const SES_SERVICE = "ses";
const SES_VERSION = "2020-10-02";

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

export async function sendEmailOtp(email: string, code: string, env: ApiEnv) {
  const fromName = (env.TENCENT_SES_FROM_NAME ?? "逐光").replace(/[<>\r\n]/gu, "").slice(0, 32);
  const fromEmail = env.TENCENT_SES_FROM_EMAIL!;
  const safeCode = code.replace(/\D/gu, "").slice(0, 6);
  return signedTencentRequest("SendEmail", {
    Destination: [email],
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    ReplyToAddresses: fromEmail,
    Simple: {
      Html: `<div style="font-family:Arial,'PingFang SC',sans-serif;color:#10231b;line-height:1.7"><p>你正在登录逐光运动教练服务平台。</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${safeCode}</p><p>验证码 5 分钟内有效。请勿向任何人透露。</p></div>`,
      Text: `你正在登录逐光运动教练服务平台。验证码：${safeCode}，5 分钟内有效。请勿向任何人透露。`,
    },
    Subject: `逐光登录验证码 ${safeCode}`,
  }, env);
}
