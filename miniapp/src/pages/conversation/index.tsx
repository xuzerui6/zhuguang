import Taro, { useDidHide, useDidShow, useRouter } from "@tarojs/taro";
import { Input, ScrollView, Text, View } from "@tarojs/components";
import { useCallback, useEffect, useRef, useState } from "react";
import { bootstrap, coachOverview, markConversationRead, sendConversationMessage } from "../../services/api";
import type { Conversation } from "../../types";
import { LatestRead } from '../../../../shared/product-flow';
import "../detail.scss";

export default function ConversationPage() {
  const router = useRouter();
  const id = String(router.params.id || "");
  const role = router.params.role === "coach" ? "coach" as const : "student" as const;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const reads = useRef(new LatestRead());
  const sending = useRef(false);
  const reading = useRef(false);
  const load = useCallback(async (quiet = false) => {
    if (reading.current || sending.current || !active.current) return;
    reading.current = true;
    const ticket = reads.current.begin();
    try {
      const data = role === "coach" ? await coachOverview() : await bootstrap();
      const next = data.conversations.find((item) => item.id === id) || null;
      if (!active.current || !reads.current.isCurrent(ticket)) return;
      setConversation(next); setError(next ? "" : "会话不存在或当前账号无权访问");
      if (next?.unreadCount && active.current) {
        await markConversationRead(role, id);
        if (active.current && reads.current.isCurrent(ticket)) setConversation(current => current ? { ...current, unreadCount: 0 } : current);
      }
    } catch (nextError) {
      if (!quiet && active.current && reads.current.isCurrent(ticket)) setError(nextError instanceof Error ? nextError.message : "消息加载失败");
    } finally { reading.current = false; }
  }, [id, role]);
  useDidShow(() => { active.current = true; void load(); });
  useDidHide(() => { active.current = false; reads.current.cancel(); });
  useEffect(() => {
    const requestReads = reads.current;
    const timer = setInterval(() => { if (active.current) void load(true); }, 15_000);
    const connected = (event: { isConnected: boolean }) => { if (event.isConnected && active.current) void load(true); };
    Taro.onNetworkStatusChange(connected);
    return () => { clearInterval(timer); Taro.offNetworkStatusChange(connected); active.current = false; requestReads.cancel(); };
  }, [load]);
  const send = async () => {
    const value = body.trim();
    if (!value || sending.current || !conversation) return;
    sending.current = true; reads.current.cancel();
    setBusy(true); setError("");
    try {
      const next = await sendConversationMessage(role, id, value);
      if ('messages' in next) setConversation(next);
      else setConversation(current => current ? { ...current, messages: [...current.messages.filter(message => message.id !== next.id), next] } : current);
      setBody("");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "发送失败，请重试"); }
    finally { sending.current = false; setBusy(false); }
  };
  return <View className="zg-chat-page"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>{conversation?.title || "消息"}</Text><View /></View><ScrollView className="zg-chat-scroll" scrollY scrollIntoView={conversation?.messages.at(-1)?.id}><View className="zg-chat-list">{conversation?.messages.map((message) => <View className={`zg-bubble-row is-${message.sender === role ? "mine" : "theirs"}`} id={message.id} key={message.id}><View className="zg-bubble"><Text>{message.body}</Text><Text>{message.createdAt}</Text></View></View>)}{!conversation && !error ? <View className="zg-chat-loading"><Text>正在加载消息</Text></View> : null}{error ? <View className="zg-inline-error"><Text>{error}</Text><Text onClick={() => void load()}>重新加载</Text></View> : null}</View></ScrollView><View className="zg-chat-composer safe-bottom"><Input adjustPosition confirmType="send" maxlength={1000} onConfirm={() => void send()} onInput={(event) => setBody(event.detail.value)} placeholder="输入消息" value={body} /><View className={`zg-send-button ${busy || !body.trim() ? "is-disabled" : ""}`} onClick={() => void send()}><Text>{busy ? "发送中" : "发送"}</Text></View></View></View>;
}
