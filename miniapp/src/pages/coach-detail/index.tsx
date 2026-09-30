import { DelayedSkeleton } from '../../components/delayed-skeleton';
import Taro, { useDidHide, useDidShow, useRouter } from "@tarojs/taro";
import { Image, Text, View } from "@tarojs/components";
import { useCallback, useEffect, useRef, useState } from "react";
import { bootstrap, createConversation, listCoachReviews, startWechatLogin } from "../../services/api";
import { getSession } from "../../services/storage";
import { acceptFavorites, changeFavorite, favoriteIds, favoriteTicket, subscribeFavorites } from "../../services/favorites";
import { LatestRead } from "../../../../shared/product-flow";
import type { CoachProfile, PublicCoachReviews } from "../../types";
import { DetailNav } from "../../components/detail-nav";
import { getStoredServiceCity, serviceCityName } from "../../services/service-city";
import "../detail.scss";

export default function CoachDetailPage() {
  const router = useRouter();
  const id = Number(router.params.id || 0);
  const serviceCity = router.params.city === 'changchun' ? 'changchun' : router.params.city === 'beijing' ? 'beijing' : getStoredServiceCity();
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [favorite, setFavorite] = useState(() => favoriteIds().includes(id));
  const [imageFailed, setImageFailed] = useState(false);
  const [reviews, setReviews] = useState<PublicCoachReviews | null>(null);

  const reads = useRef(new LatestRead());
  const restored = useRef(false);
  const load = useCallback(async () => {
    const ticket = reads.current.begin();
    const favoritesRead = favoriteTicket();
    setLoadError("");
    try {
      const [data, nextReviews] = await Promise.all([bootstrap(serviceCity), listCoachReviews(id).catch(() => null)]);
      if (!reads.current.isCurrent(ticket)) return;
      if (getSession()) acceptFavorites(data.favoriteCoachIds, favoritesRead);
      const nextCoach = data.coaches.find((item) => item.id === id);
      if (!nextCoach) throw new Error("该教练不存在、已下线或暂不可公开查看");
      setCoach(nextCoach);
      setFavorite(favoriteIds().includes(id));
      setReviews(nextReviews);
    } catch (error) {
      if (!reads.current.isCurrent(ticket)) return;
      setLoadError(error instanceof Error ? error.message : "教练档案加载失败");
    }
  }, [id, serviceCity]);

  useDidShow(() => { void load(); });
  useDidHide(() => reads.current.cancel());
  useEffect(() => subscribeFavorites(ids => setFavorite(ids.includes(id))), [id]);

  const consult = useCallback(async () => {
    const next = `/pages/coach-detail/index?id=${id}&city=${serviceCity}&consult=1`;
    if (!getSession()) {
      try {
        const result = await startWechatLogin();
        if (result.status === "link_required") {
          await Taro.navigateTo({ url: `/pages/account-link/index?next=${encodeURIComponent(next)}` });
          return;
        }
        if (!result.session.profile?.completed) {
          await Taro.navigateTo({ url: `/pages/profile-edit/index?next=${encodeURIComponent(next)}` });
          return;
        }
      } catch (error) {
        Taro.showToast({ title: error instanceof Error ? error.message : "登录失败", icon: "none" });
        return;
      }
    }
    if (!getSession()?.profile?.completed) {
      await Taro.navigateTo({ url: `/pages/profile-edit/index?next=${encodeURIComponent(next)}` });
      return;
    }
    try {
      const conversation = await createConversation(id);
      await Taro.navigateTo({ url: `/pages/conversation/index?id=${encodeURIComponent(conversation.id)}&role=student` });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "暂时无法咨询", icon: "none" });
    }
  }, [id, serviceCity]);

  useEffect(() => {
    if (router.params.consult === "1" && getSession() && !restored.current) { restored.current = true; void consult(); }
  }, [consult, router.params.consult]);

  const favoriteCoach = async () => {
    try { await changeFavorite(id); }
    catch { Taro.showToast({ title: '收藏待同步，联网后重试', icon: 'none' }); }
  };

  if (!coach) return <View className="zg-detail-page"><DetailNav title="教练档案" /><View className="zg-empty"><Text className="zg-empty-title">{loadError || "正在加载教练档案"}</Text>{loadError ? <View className="zg-outline-button" onClick={() => void load()}><Text>重新加载</Text></View> : <DelayedSkeleton />}</View></View>;

  const canBook = coach.bookable !== false && coach.bookingEnabled !== false;
  return (
    <View className="zg-detail-page">
      <DetailNav onRight={() => void favoriteCoach()} rightLabel={favorite ? "已收藏" : "收藏"} title="教练档案" />
      <View className="zg-detail-hero">
        {imageFailed || !(coach.heroUrl || coach.cardUrl)
          ? <View className="zg-featured-fallback"><Text className="zg-featured-monogram">{coach.name.slice(0, 1)}</Text><Text>逐光 · 已核验教练档案</Text></View>
          : <Image ariaLabel={`${coach.name}教练`} className={`coach-${coach.id}`} mode="aspectFill" onError={() => setImageFailed(true)} src={coach.heroUrl || coach.cardUrl || ""} />}
        <View className="zg-detail-hero-shade" />
        <View className="zg-detail-identity">
          <Text className="zg-detail-name">{coach.name}</Text>
          <Text>{coach.sport} · {serviceCityName(serviceCity)}服务</Text>
          <Text className="zg-verified">{coach.verificationLabel || "公开资料已审核"}</Text>
        </View>
      </View>
      <View className="zg-detail-body">
        <View className="zg-detail-intro"><Text className="zg-detail-title">{coach.title}</Text><Text>公开资料由平台核验，预约由学员指定时间和地点，教练确认后生效。</Text></View>
        <View className="zg-detail-section"><Text className="zg-detail-heading">擅长方向</Text><View className="zg-chip-row">{coach.strengths.map((item) => <Text key={item}>{item}</Text>)}</View></View>
        <View className="zg-detail-section"><Text className="zg-detail-heading">服务对象</Text><Text>{coach.audience.join("、")}</Text></View>
        <View className="zg-detail-section"><Text className="zg-detail-heading">已核验资质</Text>{coach.credentials?.length ? coach.credentials.map((item) => <Text className="zg-detail-line" key={item}>{item}</Text>) : <Text>资质信息待补充</Text>}</View>
        <View className="zg-detail-section">
          <View className="zg-review-heading"><Text className="zg-detail-heading">学员评价</Text>{reviews?.summary.total ? <Text>{reviews.summary.averageRating === null ? `${reviews.summary.total} 条` : `${reviews.summary.averageRating.toFixed(1)} 分 · ${reviews.summary.total} 条`}</Text> : null}</View>
          {reviews?.summary.tagCounts.length ? <View className="zg-review-tags is-readonly">{reviews.summary.tagCounts.slice(0, 3).map((item) => <View key={item.tag}><Text>{item.tag} {item.count}</Text></View>)}</View> : null}
          {reviews?.items.length ? <View className="zg-public-reviews">{reviews.items.slice(0, 3).map((review) => <View key={review.id}><View><Text>{"★".repeat(review.rating)} · {review.reviewerLabel}</Text><Text>{review.sport} · {review.durationMinutes}分钟 · {review.completedMonth}</Text></View><Text>{review.body}</Text>{review.coachReply ? <View><Text>教练回复</Text><Text>{review.coachReply.body}</Text></View> : null}</View>)}</View> : <Text>暂无已审核公开评价</Text>}
        </View>
      </View>
      <View className="zg-detail-actions safe-bottom">
        <View className="zg-outline-button" onClick={() => void consult()}><Text>先咨询</Text></View>
        {canBook
          ? <View className="zg-primary-button" onClick={() => Taro.navigateTo({ url: `/pages/booking/index?coach=${coach.id}&city=${serviceCity}` })}><Text>选择时间预约</Text></View>
          : <View className="zg-primary-button is-disabled"><Text>{coach.unavailableReason || "暂未接单"}</Text></View>}
      </View>
    </View>
  );
}
