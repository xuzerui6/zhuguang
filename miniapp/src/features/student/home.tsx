import { Text, View } from "@tarojs/components";
import type { Booking, CoachProfile } from "../../types";
import { CoachCarousel } from "../../components/coach-carousel";
import { CoachRow } from "../../components/coach-row";

export function StudentHome({ bookings, cityName, coaches, sports, onBookings, onChangeCity, onDiscover, onLocate, onSelectSport }: { bookings: Booking[]; cityName: string; coaches: CoachProfile[]; sports: string[]; onBookings: () => void; onChangeCity: () => void; onDiscover: () => void; onLocate: () => void; onSelectSport: (sport: string) => void }) {
  const pending = bookings.filter((item) => item.status === "pending_coach" || item.status === "reschedule_requested").length;
  return (
    <View className="zg-page-content">
      <View className="zg-greeting"><View className="zg-city-tools"><View className="zg-city-chip" onClick={onChangeCity}><Text>{cityName}</Text><Text>⌄</Text></View><View className="zg-locate-link" onClick={onLocate}><Text>定位城市</Text></View></View><Text className="zg-kicker">你好，</Text><Text className="zg-title">让运动成为更好的自己</Text><Text className="zg-subtitle">在{cityName}，找到资料已审核的运动教练</Text></View>
      <View className="zg-task-panel">
        <View className="zg-task-heading"><Text>今天的训练安排</Text><Text>按真实状态更新</Text></View>
        <View className="zg-task-row" onClick={onBookings}><View className="zg-task-icon is-blue"><Text>预约</Text></View><View><Text className="zg-task-title">{pending ? `${pending} 个申请等待处理` : "暂无待确认预约"}</Text><Text className="zg-task-copy">教练回复后会在这里提醒你</Text></View><Text className="zg-arrow">›</Text></View>
        <View className="zg-search-action" onClick={onDiscover}><Text className="zg-search-label">找教练</Text><Text className="zg-search-copy">搜索教练、项目或训练目标</Text><Text className="zg-arrow is-light">›</Text></View>
      </View>
      <View className="zg-section-heading"><Text>选择运动项目</Text><Text className="zg-heading-link" onClick={onDiscover}>只看{cityName}教练 ›</Text></View>
      <View className="zg-sport-strip">
        {sports.map((sport, index) => <View className={`zg-sport-item ${index === 0 ? "is-active" : ""}`} key={sport} onClick={() => onSelectSport(sport)}><View className="zg-sport-mark"><Text>{sport.slice(0, 1)}</Text></View><Text>{sport}</Text></View>)}
      </View>
      {coaches.length ? <CoachCarousel key={`${cityName}:${coaches.map(coach => coach.id).join(",")}`} coaches={coaches} /> : <View className="zg-honest-empty"><Text>当前城市暂无已审核教练</Text><Text>可以提交训练需求，或邀请专业教练申请入驻。</Text></View>}
      <View className="zg-section-heading"><Text>推荐教练</Text><Text className="zg-heading-link" onClick={onDiscover}>查看全部 ›</Text></View>
      <View className="zg-list-surface">{coaches.slice(0, 3).map((coach) => <CoachRow coach={coach} key={coach.id} />)}</View>
    </View>
  );
}
