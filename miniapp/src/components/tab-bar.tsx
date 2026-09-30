import { Text, View } from "@tarojs/components";
import type { AccountMode, CoachTab, StudentTab } from "../types";

const studentItems: Array<[StudentTab, string]> = [["home", "首页"], ["discover", "找教练"], ["bookings", "预约"], ["messages", "消息"], ["profile", "我的"]];
const coachItems: Array<[CoachTab, string]> = [["workspace", "工作台"], ["requests", "预约"], ["schedule", "日程"], ["messages", "消息"], ["profile", "我的"]];

export function TabBar({ mode, active, onChange, unread = 0 }: {
  mode: AccountMode;
  active: StudentTab | CoachTab;
  onChange: (tab: StudentTab | CoachTab) => void;
  unread?: number;
}) {
  const items = mode === "coach" ? coachItems : studentItems;
  return (
    <View className="zg-tabbar safe-bottom">
      {items.map(([tab, label]) => (
        <View className={`zg-tab ${active === tab ? "is-active" : ""}`} key={tab} onClick={() => onChange(tab)}>
          <View className="zg-tab-mark" />
          <Text>{label}</Text>
          {tab === "messages" && unread > 0 ? <Text className="zg-tab-badge">{unread > 9 ? "9+" : unread}</Text> : null}
        </View>
      ))}
    </View>
  );
}
