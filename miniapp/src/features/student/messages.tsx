import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { EmptyState } from "../../components/empty-state";
import type { Conversation } from "../../types";

export function StudentMessages({ conversations, role }: { conversations: Conversation[]; role: "student" | "coach" }) {
  return <View className="zg-page-content zg-subpage"><View className="zg-page-title"><Text>消息</Text><Text>{role === "coach" ? "学员咨询与预约沟通" : "咨询、预约进度与平台通知"}</Text></View>{conversations.length ? <View className="zg-list-surface">{conversations.map((item) => <View className="zg-message-row" key={item.id} onClick={() => Taro.navigateTo({ url: `/pages/conversation/index?id=${encodeURIComponent(item.id)}&role=${role}` })}><View className="zg-message-avatar"><Text>{item.title.slice(0, 1)}</Text></View><View><Text className="zg-message-title">{item.title}</Text><Text className="zg-message-copy">{item.subtitle || "点击查看消息"}</Text></View>{item.unreadCount ? <Text className="zg-unread">{item.unreadCount}</Text> : <Text className="zg-arrow">›</Text>}</View>)}</View> : <EmptyState description={role === "coach" ? "学员发来咨询后，会话会显示在这里。" : "向教练发起咨询后，对话会显示在这里。"} title="暂无消息" />}</View>;
}
