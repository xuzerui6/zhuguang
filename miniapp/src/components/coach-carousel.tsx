import Taro from "@tarojs/taro";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoachProfile } from "../types";
import { getStoredServiceCity, serviceCityName } from "../services/service-city";

export function CoachCarousel({ coaches }: { coaches: CoachProfile[] }) {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [failed, setFailed] = useState<number[]>([]);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = useMemo(() => coaches.filter((coach) => coach.id === 5 || coach.id === 6 || coach.id === 7).slice(0, 3), [coaches]);
  const cityId = getStoredServiceCity();
  const activeIndex = Math.min(current, Math.max(0, visible.length - 1));
  const open = (path: string) => Taro.navigateTo({ url: path });
  const pauseAutoplay = () => {
    setAutoplay(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const scheduleAutoplay = () => {
    if (visible.length < 2) return;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAutoplay(true), 8_000);
  };
  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);
  if (!visible.length) return null;
  return (
    <View className="zg-featured">
      <View className="zg-section-heading">
        <Text>优选教练</Text>
        <View className="zg-carousel-progress">
          <Text>{activeIndex + 1} / {visible.length}</Text>
          {visible.map((coach, index) => <View className={index === activeIndex ? "is-active" : ""} key={coach.id} />)}
        </View>
      </View>
      <Swiper autoplay={visible.length > 1 && autoplay} className="zg-coach-swiper" current={activeIndex} circular={visible.length > 1} duration={260} interval={5000} onChange={(event) => setCurrent(event.detail.current)} onTouchEnd={scheduleAutoplay} onTouchStart={pauseAutoplay}>
        {visible.map((coach) => (
          <SwiperItem key={coach.id}>
            <View className="zg-featured-card">
              {failed.includes(coach.id) || !(coach.heroUrl || coach.cardUrl)
                ? <View className="zg-featured-fallback"><Text className="zg-featured-monogram">{coach.name.slice(0, 1)}</Text><Text>逐光 · 已核验教练档案</Text></View>
                : <Image ariaLabel={`${coach.name}教练`} className={`zg-featured-image coach-${coach.id}`} mode="aspectFill" onError={() => setFailed((items) => [...new Set([...items, coach.id])])} src={coach.heroUrl || coach.cardUrl || ""} />}
              <View className="zg-featured-shade" />
              <View className="zg-featured-copy">
                <View className="zg-featured-row"><Text className="zg-featured-name">{coach.name}</Text><Text className="zg-verified">{coach.verificationLabel || "公开资料已审核"}</Text></View>
                <Text className="zg-featured-meta">{coach.sport} · {serviceCityName(cityId)}服务</Text>
                <Text className="zg-featured-strengths">{coach.strengths.slice(0, 2).join(" · ")}</Text>
                <View className="zg-featured-actions">
                  <View className="zg-button is-ghost" onClick={() => open(`/pages/coach-detail/index?id=${coach.id}&city=${cityId}`)}><Text>查看档案</Text></View>
                  {coach.bookable !== false && coach.bookingEnabled !== false
                    ? <View className="zg-button is-coral" onClick={() => open(`/pages/booking/index?coach=${coach.id}&city=${cityId}`)}><Text>选择时间</Text></View>
                    : <View className="zg-button is-disabled"><Text>暂未接单</Text></View>}
                </View>
              </View>
              {visible.length > 1 ? <Text className="zg-swipe-hint">左右滑动{autoplay ? " · 自动切换" : ""}</Text> : null}
            </View>
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  );
}
