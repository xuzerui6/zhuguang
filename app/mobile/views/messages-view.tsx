"use client";

import { Building2, ChevronRight, Headphones, MessageCircle, Send } from "lucide-react";
import { CoachAvatar, EmptyState, PageHeader } from "../components";
import { useState } from "react";
import type { MobileCoach, MobileConversation } from "../types";

export function MessagesView({
  coaches,
  conversations,
  draft,
  onBack,
  onChangeDraft,
  onOpen,
  onSend,
  selectedConversation,
  sending,
}: {
  coaches: MobileCoach[];
  conversations: MobileConversation[];
  draft: string;
  onBack: () => void;
  onChangeDraft: (value: string) => void;
  onOpen: (conversation: MobileConversation) => void;
  onSend: () => Promise<void>;
  selectedConversation: MobileConversation | null;
  sending: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "coach" | "system">("all");
  const visibleConversations = conversations.filter((conversation) => filter === "all" || (filter === "coach" ? conversation.kind === "coach" : conversation.kind !== "coach"));
  if (selectedConversation) {
    const coach = selectedConversation.coachId ? coaches.find((item) => item.id === selectedConversation.coachId) : null;
    return (
      <div className="zg-view zg-conversation-view">
        <PageHeader eyebrow={coach ? `${coach.sport} · ${coach.level}` : "逐光平台服务"} onBack={onBack} title={selectedConversation.title} />
        <div className="zg-message-thread">
          <p className="zg-message-date">最近消息</p>
          {selectedConversation.messages.map((message) => (
            <div className={`zg-message-bubble is-${message.sender}`} key={message.id}>
              <p>{message.body}</p><small>{message.createdAt}</small>
            </div>
          ))}
          {selectedConversation.kind === "coach" ? <p className="zg-message-privacy">平台会保留沟通记录 90 天，用于服务保障与争议处理。</p> : null}
        </div>
        <form className="zg-message-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
          <input aria-label="输入消息" onChange={(event) => onChangeDraft(event.target.value)} placeholder="输入消息" value={draft} />
          <button aria-label="发送消息" disabled={!draft.trim() || sending} type="submit"><Send aria-hidden size={19} /></button>
        </form>
      </div>
    );
  }

  return (
    <div className="zg-view zg-messages-view">
      <PageHeader title="消息" />
      <div className="zg-segmented-tabs is-messages" role="tablist">
        <button aria-selected={filter === "all"} className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")} role="tab" type="button">全部</button>
        <button aria-selected={filter === "coach"} className={filter === "coach" ? "is-active" : ""} onClick={() => setFilter("coach")} role="tab" type="button">教练</button>
        <button aria-selected={filter === "system"} className={filter === "system" ? "is-active" : ""} onClick={() => setFilter("system")} role="tab" type="button">系统</button>
      </div>
      {visibleConversations.length ? (
        <div className="zg-conversation-list">
          {visibleConversations.map((conversation) => {
            const coach = conversation.coachId ? coaches.find((item) => item.id === conversation.coachId) : null;
            return (
              <button key={conversation.id} onClick={() => onOpen(conversation)} type="button">
                {coach ? <CoachAvatar coach={coach} size="medium" /> : <span className={`zg-conversation-icon is-${conversation.kind}`}>{conversation.kind === "venue" ? <Building2 size={22} /> : <Headphones size={22} />}</span>}
                <span><strong>{conversation.title}</strong><p>{conversation.subtitle}</p></span>
                <small>{conversation.updatedAt}</small>
                {conversation.unreadCount ? <b>{conversation.unreadCount}</b> : <ChevronRight aria-hidden size={17} />}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState description="教练回复、预约进度和服务提醒会统一出现在这里。" icon="message" title="暂无更多消息" />
      )}
      <p className="zg-retention-note"><MessageCircle aria-hidden size={17} />消息会为您保留 90 天</p>
    </div>
  );
}
