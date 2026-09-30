import { Text, View } from "@tarojs/components";

export function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <View className="zg-empty"><View className="zg-empty-mark" /><Text className="zg-empty-title">{title}</Text><Text className="zg-empty-copy">{description}</Text>{action ? <View className="zg-outline-button" onClick={onAction}><Text>{action}</Text></View> : null}</View>;
}
