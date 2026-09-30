import { Text, View } from "@tarojs/components";
import type { CoachOverview } from "../../types";

export function CoachWorkspace({ overview, onNavigate }: { overview: CoachOverview; onNavigate: (tab: "requests" | "schedule" | "messages") => void }) {
  const pending = overview.bookings.filter((item) => item.status === "pending_coach").length;
  const waiting = overview.bookings.filter((item) => item.status === "reschedule_requested").length;
  const confirmed = overview.bookings.filter((item) => item.status === "confirmed").length;
  const unread = overview.conversations.reduce((total, item) => total + item.unreadCount, 0);
  return <View className="zg-page-content zg-subpage"><View className="zg-mode-banner"><Text>教练模式</Text><Text>{overview.coach.name} · {overview.coach.sport}</Text></View><View className="zg-page-title"><Text>今天需要处理什么？</Text><Text>先处理即将失效的请求和未读消息</Text></View><View className="zg-coach-summary"><View><Text>{pending}</Text><Text>待处理请求</Text></View><View><Text>{confirmed}</Text><Text>已确认课程</Text></View><View><Text>{unread}</Text><Text>未读消息</Text></View></View><View className="zg-action-queue"><View onClick={() => onNavigate("requests")}><Text className="zg-action-title">预约请求</Text><Text>{pending ? `${pending} 个申请等待确认或协商` : waiting ? `${waiting} 个新方案等待学员回应` : "暂无待处理申请"}</Text><Text className="zg-arrow">›</Text></View><View onClick={() => onNavigate("schedule")}><Text className="zg-action-title">接单状态与日程</Text><Text>{overview.coach.bookingEnabled === false ? "当前停止接收新申请" : "当前接单中，确认时锁定日程"}</Text><Text className="zg-arrow">›</Text></View><View onClick={() => onNavigate("messages")}><Text className="zg-action-title">学员消息</Text><Text>{unread ? `${unread} 条未读消息` : "消息已处理"}</Text><Text className="zg-arrow">›</Text></View></View></View>;
}
