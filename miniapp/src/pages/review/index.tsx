import Taro, { useRouter } from "@tarojs/taro";
import { Text, Textarea, View } from "@tarojs/components";
import { useMemo, useState } from "react";
import { resubmitCoachReview, submitCoachReview } from "../../services/api";
import { DetailNav } from "../../components/detail-nav";
import "../detail.scss";

const tags = ["专业可靠", "讲解清晰", "耐心负责", "计划有针对性", "沟通顺畅", "准时守约"];

export default function ReviewPage() {
  const router = useRouter();
  const bookingId = String(router.params.booking || "");
  const reviewId = String(router.params.review || "");
  const coachName = decodeURIComponent(String(router.params.coach || "教练"));
  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const count = useMemo(() => [...body].length, [body]);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length < 3 ? [...current, tag] : current);
  };

  const submit = async () => {
    if (!bookingId) { Taro.showToast({ title: "预约信息无效", icon: "none" }); return; }
    if (count < 20) { Taro.showToast({ title: "真实体验请至少填写20字", icon: "none" }); return; }
    setBusy(true);
    try {
      const input = { body: body.trim(), rating, tags: selectedTags };
      if (reviewId) await resubmitCoachReview(reviewId, input);
      else await submitCoachReview({ bookingId, ...input });
      await Taro.showModal({ title: "评价已提交", content: "运营审核通过后会匿名展示在教练档案中。", showCancel: false });
      await Taro.navigateBack();
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "提交失败，请重试", icon: "none", duration: 2600 });
    } finally {
      setBusy(false);
    }
  };

  return <View className="zg-review-page">
    <DetailNav title="评价教练" />
    <View className="zg-form-section">
      <Text className="zg-detail-heading">{coachName}教练的本次服务</Text>
      <Text className="zg-helper">评价将匿名显示为“平台履约学员”，不会公开账号昵称或学员姓名。</Text>
      <View className="zg-rating-row">
        {[1, 2, 3, 4, 5].map((value) => <View className={value <= rating ? "is-active" : ""} key={value} onClick={() => setRating(value)}><Text>★</Text></View>)}
        <Text>{rating} 分</Text>
      </View>
      <Text className="zg-field-label">体验标签（最多3项）</Text>
      <View className="zg-review-tags">{tags.map((tag) => <View className={selectedTags.includes(tag) ? "is-active" : ""} key={tag} onClick={() => toggleTag(tag)}><Text>{tag}</Text></View>)}</View>
      <Textarea maxlength={1000} onInput={(event) => setBody(event.detail.value)} placeholder="请写下本次训练的真实体验（20至1000字）" value={body} />
      <Text className="zg-character-count">{count} / 1000</Text>
      <View className={`zg-primary-button ${busy ? "is-disabled" : ""}`} onClick={() => !busy && void submit()}><Text>{busy ? "正在提交" : reviewId ? "重新提交审核" : "提交评价"}</Text></View>
    </View>
  </View>;
}
