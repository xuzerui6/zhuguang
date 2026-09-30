import Taro from "@tarojs/taro";
import { Input, Text, View } from "@tarojs/components";
import { useMemo, useState } from "react";
import { CoachRow } from "../../components/coach-row";
import { EmptyState } from "../../components/empty-state";
import type { CoachProfile } from "../../types";
import { changeFavorite } from "../../services/favorites";
import { ALL_SPORTS, getStoredServiceCity } from "../../services/service-city";

export function StudentDiscover({ cityName, coaches, favoriteCoachIds, favoritesOnly = false, onFavoritesOnly, selectedSport, onSelectSport }: { cityName: string; coaches: CoachProfile[]; favoriteCoachIds: number[]; favoritesOnly?: boolean; onFavoritesOnly: (active: boolean) => void; selectedSport: string; onSelectSport: (sport: string) => void }) {
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("全部区域");
  const [audience, setAudience] = useState("全部对象");
  const sports = ["全部项目", ...ALL_SPORTS];
  const districts = useMemo(() => ["全部区域", ...new Set(coaches.flatMap(coach => coach.serviceAreas?.filter(area => area.cityId === getStoredServiceCity()).map(area => area.district) || (coach.district ? [coach.district] : [])))], [coaches]);
  const filtered = useMemo(() => coaches.filter((coach) => {
    const queryMatches = [coach.name, coach.sport, coach.district, ...coach.strengths].join(" ").includes(query.trim());
    return queryMatches
      && (!favoritesOnly || favoriteCoachIds.includes(coach.id))
      && (selectedSport === "全部项目" || coach.sport === selectedSport || coach.sports?.includes(selectedSport))
      && (district === "全部区域" || coach.serviceAreas?.some(area => area.cityId === getStoredServiceCity() && area.district === district) || (!coach.serviceAreas?.length && coach.district === district))
      && (audience === "全部对象" || coach.audience.some((item) => item.includes(audience)));
  }), [audience, coaches, district, query, selectedSport, favoriteCoachIds, favoritesOnly]);
  const favorite = async (coach: CoachProfile) => {
    try { await changeFavorite(coach.id); }
    catch { Taro.showToast({ title: '收藏待同步，联网后重试', icon: 'none' }); }
  };
return <View className="zg-page-content zg-subpage"><View className="zg-page-title"><Text>找教练</Text><Text>只展示{cityName}已审核、已上线的真实教练</Text></View><View className="zg-input-wrap"><Input confirmType="search" onInput={(event) => setQuery(event.detail.value)} placeholder="搜索教练、项目或训练目标" value={query} /></View><View className="zg-filter-row">{sports.map((item) => <Text className={selectedSport === item ? "is-active" : ""} key={item} onClick={() => onSelectSport(item)}>{item}</Text>)}</View><View className="zg-filter-row is-secondary"><Text className={favoritesOnly ? "is-active" : ""} onClick={() => onFavoritesOnly(!favoritesOnly)}>仅收藏</Text>{districts.map((item) => <Text className={district === item ? "is-active" : ""} key={item} onClick={() => setDistrict(item)}>{item}</Text>)}{["青少年儿童", "成人"].map((item) => <Text className={audience === item ? "is-active" : ""} key={item} onClick={() => setAudience(audience === item ? "全部对象" : item)}>{item}</Text>)}</View>{filtered.length ? <View className="zg-list-surface">{filtered.map((coach) => <CoachRow coach={coach} favorite={favoriteCoachIds.includes(coach.id)} key={coach.id} onFavorite={(item) => void favorite(item)} />)}</View> : <View className="zg-empty-with-action"><EmptyState title={favoritesOnly ? "当前筛选下暂无收藏教练" : selectedSport === "全部项目" ? "当前城市暂无已审核教练" : `${cityName}暂无${selectedSport}教练`} description="逐光不会使用演示资料填充结果，你可以提交需求或邀请教练申请入驻。" /></View>}</View>;
}
