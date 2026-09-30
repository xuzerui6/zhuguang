import Taro, { useRouter } from "@tarojs/taro";
import { Input, Text, View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { sendWechatLinkEmail, verifyWechatLinkEmail } from "../../services/api";
import { getPendingWechatLink, setMode } from "../../services/storage";
import { safeMiniappNext } from '../../../../shared/product-flow';
import "../detail.scss";

export default function AccountLinkPage() {
  const router = useRouter();
  const next = safeMiniappNext(String(router.params.next || ''));
  const link = getPendingWechatLink();
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!remaining) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const send = async () => {
    if (!link || busy || remaining || !getPendingWechatLink()) return;
    setBusy(true);
    try {
      const result = await sendWechatLinkEmail(email.trim(), link.linkToken);
      setChallengeId(result.challengeId);
      setRemaining(result.retryAfter);
      Taro.showToast({ title: "验证码已发送", icon: "success" });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "发送失败", icon: "none" });
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!link || busy || !getPendingWechatLink() || !challengeId || code.length !== 6) return;
    setBusy(true);
    try {
      const session = await verifyWechatLinkEmail(challengeId, code, link.linkToken);
      Taro.showToast({ title: "账号关联成功", icon: "success" });
      if (session.profile?.completed && session.availableModes.includes("coach") && next === "/pages/index/index?tab=profile") {
        try {
          const choice = await Taro.showActionSheet({ itemList: ["进入学员端", "进入教练工作台"] });
          setMode(choice.tapIndex === 1 ? "coach" : "student");
        } catch {
          setMode("student");
        }
      }
      const destination = session.profile?.completed
        ? next
        : `/pages/profile-edit/index?next=${encodeURIComponent(next)}`;
      setTimeout(() => Taro.redirectTo({ url: destination }), 350);
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "验证失败", icon: "none", duration: 2600 });
    } finally { setBusy(false); }
  };

  if (!link) return <View className="zg-auth-page"><View className="zg-auth-card"><Text className="zg-detail-title">关联状态已失效</Text><Text className="zg-helper">请返回“我的”，重新发起微信登录。</Text><View className="zg-primary-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index?tab=profile" })}><Text>返回我的</Text></View></View></View>;
  return <View className="zg-auth-page"><View className="zg-auth-brand"><Text>逐光</Text><Text>关联已有账号</Text></View><View className="zg-auth-card"><Text className="zg-detail-title">验证你的邮箱</Text><Text className="zg-helper">微信不会自动获得你的逐光业务数据。验证已绑定邮箱后，收藏、预约和教练身份会安全恢复。</Text><View className="zg-auth-field"><Text>邮箱</Text><Input autoFocus={!challengeId} onInput={(event) => setEmail(event.detail.value)} placeholder="请输入逐光账号邮箱" type="text" value={email} /></View>{challengeId ? <View className="zg-auth-field"><Text>6 位验证码</Text><Input autoFocus maxlength={6} onInput={(event) => setCode(event.detail.value.replace(/\D/gu, "").slice(0, 6))} placeholder="验证码 5 分钟内有效" type="number" value={code} /></View> : null}<View className="zg-primary-button" onClick={() => !busy && (challengeId ? void verify() : void send())}><Text>{busy ? "请稍候" : challengeId ? "验证并关联" : "发送验证码"}</Text></View>{challengeId ? <View className="zg-link-actions"><Text onClick={() => setChallengeId("")}>修改邮箱</Text><Text onClick={() => !remaining && void send()}>{remaining ? `${remaining} 秒后重发` : "重新发送"}</Text></View> : null}<Text className="zg-auth-safe">验证码只用于本次账号关联，不会写入日志或本地缓存。</Text></View></View>;
}
