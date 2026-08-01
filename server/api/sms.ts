import { ApiError, type ApiEnv } from "./contracts";

type SmsConfig = {
  appId: string;
  region: string;
  secretId: string;
  secretKey: string;
  signName: string;
  templateId: string;
};

function getSmsConfig(env: ApiEnv, templateId = env.TENCENT_SMS_TEMPLATE_ID): SmsConfig | null {
  if (!env.TENCENTCLOUD_SECRET_ID || !env.TENCENTCLOUD_SECRET_KEY || !env.TENCENT_SMS_SDK_APP_ID || !env.TENCENT_SMS_SIGN_NAME || !templateId) return null;
  return {
    appId: env.TENCENT_SMS_SDK_APP_ID,
    region: env.TENCENT_SMS_REGION ?? "ap-beijing",
    secretId: env.TENCENTCLOUD_SECRET_ID,
    secretKey: env.TENCENTCLOUD_SECRET_KEY,
    signName: env.TENCENT_SMS_SIGN_NAME,
    templateId,
  };
}

async function sendSms(phone: string, params: string[], config: SmsConfig, context: string) {
  const sdk = await import("tencentcloud-sdk-nodejs-sms");
  const SmsClient = sdk.sms.v20210111.Client;
  const client = new SmsClient({
    credential: { secretId: config.secretId, secretKey: config.secretKey },
    profile: { httpProfile: { reqMethod: "POST", reqTimeout: 10 }, signMethod: "TC3-HMAC-SHA256" },
    region: config.region,
  });
  const result = await client.SendSms({
    PhoneNumberSet: [`+86${phone}`],
    SessionContext: context.slice(0, 500),
    SignName: config.signName,
    SmsSdkAppId: config.appId,
    TemplateId: config.templateId,
    TemplateParamSet: params,
  });
  const status = result.SendStatusSet?.[0];
  if (!status || status.Code !== "Ok") throw new Error(status?.Message ?? status?.Code ?? "Tencent SMS rejected the request");
  return result.RequestId;
}

export async function sendOtpSms(phone: string, code: string, challengeId: string, env: ApiEnv) {
  const config = getSmsConfig(env);
  if (!config) {
    if (env.APP_ENV === "production") throw new ApiError(503, "sms_not_configured", "短信服务尚未完成配置");
    return null;
  }
  try {
    return await sendSms(phone, [code, "5"], config, challengeId);
  } catch (error) {
    console.error("Tencent OTP SMS failed", { challengeId, error });
    throw new ApiError(502, "sms_delivery_failed", "验证码发送失败，请稍后重试");
  }
}

export async function sendBookingStatusSms(phone: string, statusText: string, bookingId: string, env: ApiEnv) {
  const config = getSmsConfig(env, env.SMS_NOTIFICATION_TEMPLATE_ID);
  if (!config) return null;
  try {
    return await sendSms(phone, [statusText], config, bookingId);
  } catch (error) {
    console.error("Tencent booking SMS failed", { bookingId, error });
    return null;
  }
}

