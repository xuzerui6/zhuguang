import Taro from "@tarojs/taro";
import { Image, Text, View } from "@tarojs/components";
import type { CoachProfile } from "../types";
import { getStoredServiceCity, serviceCityName } from "../services/service-city";

export function CoachRow({ coach, favorite, onFavorite }: { coach: CoachProfile; favorite?: boolean; onFavorite?: (coach: CoachProfile) => void }) {
  return (
    <View className="zg-coach-row" onClick={() => Taro.navigateTo({ url: `/pages/coach-detail/index?id=${coach.id}` })}>
      <Image ariaLabel={`${coach.name}教练`} className="zg-coach-row-image" mode="aspectFill" src={coach.avatarUrl || coach.cardUrl || ""} />
      <View className="zg-coach-row-copy">
        <View><Text className="zg-coach-row-name">{coach.name}</Text><Text className="zg-verified">{coach.verificationLabel || "公开资料已审核"}</Text></View>
        <Text className="zg-coach-row-meta">{coach.sport} · {serviceCityName(getStoredServiceCity())} · {coach.serviceAreas?.filter(area => area.cityId === getStoredServiceCity()).map(area => area.district).join("、") || coach.district || ""}</Text>
        <Text className="zg-coach-row-strengths">{coach.strengths.slice(0, 3).join(" · ")}</Text>
      </View>
      <View className="zg-row-actions">
        {onFavorite ? <View className="zg-favorite-button" onClick={(event) => { event.stopPropagation(); onFavorite(coach); }}><Text>{favorite ? "已收藏" : "收藏"}</Text></View> : null}
        <View className="zg-small-button"><Text>查看</Text></View>
      </View>
    </View>
  );
}
