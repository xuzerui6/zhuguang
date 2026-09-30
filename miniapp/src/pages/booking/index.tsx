import Taro, { useDidShow, useDidHide, useRouter } from "@tarojs/taro";
import { Input, Picker, Radio, RadioGroup, Text, Textarea, View } from "@tarojs/components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bookingOptions, bootstrap, createBooking, startWechatLogin } from "../../services/api";
import { getSession, setSession } from "../../services/storage";
import type { BookingOptions, Bootstrap } from "../../types";
import { consumesTrial } from "../../shared";
import { SERVICE_AREAS, getStoredServiceCity, serviceCityName } from "../../services/service-city";
import { dateInShanghai, parseTrainingTime, LatestRead } from '../../../../shared/product-flow';
import { bookingSubmissionKeys, saveBookingDraft, readBookingDraft, clearBookingDraft } from '../../services/booking-draft';
import "../detail.scss";

function beijingDate(offsetDays = 1) { return dateInShanghai(Date.now() + offsetDays * 86_400_000); }

export default function BookingPage() {
  const router = useRouter();
  const coachId = Number(router.params.coach || 0);
  const serviceCity = router.params.city === 'changchun' ? 'changchun' : router.params.city === 'beijing' ? 'beijing' : getStoredServiceCity();
  const [initial] = useState(() => readBookingDraft(coachId, serviceCity));
  const serviceAreas = SERVICE_AREAS[serviceCity];
  const [data, setData] = useState<Bootstrap | null>(null);
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(initial?.date || beijingDate());
  const [time, setTime] = useState(initial?.time || "18:30");
  const [duration, setDuration] = useState<60 | 90 | 120>(initial?.duration || 60);
  const [locationType, setLocationType] = useState<"venue" | "custom">(initial?.locationType || "venue");
  const [venueId, setVenueId] = useState(initial?.venueId || "");
  const [district, setDistrict] = useState(initial?.district || serviceAreas[0]);
  const [address, setAddress] = useState(initial?.address || "");
  const [note, setNote] = useState(initial?.note || "");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reads = useRef(new LatestRead());
  const submitLock = useRef(false);
  const [selectedLearnerId, setSelectedLearnerId] = useState(String(router.params.learner || initial?.selectedLearnerId || ''));
  const returnPath = `/pages/booking/index?coach=${coachId}&city=${serviceCity}`;
  const saveDraft = (linking = false) => saveBookingDraft(coachId, serviceCity, { date, time, duration, locationType, venueId, district, address, note, selectedLearnerId }, linking);

  const openLearnerPage = async (create = false) => {
    if (submitLock.current) return;
    submitLock.current = true;
    saveDraft(true);
    const target = `/pages/learner-profile/index?${create ? 'mode=new&' : ''}next=${encodeURIComponent(returnPath)}`;
    try {
      if (!getSession()) {
        const login = await startWechatLogin();
        if (login.status === 'link_required') {
          await Taro.navigateTo({ url: `/pages/account-link/index?next=${encodeURIComponent(target)}` });
          return;
        }
      }
      await Taro.navigateTo({ url: target });
    } catch (reason) { Taro.showToast({ title: reason instanceof Error ? reason.message : '登录失败，请重试', icon: 'none' }); }
    finally { submitLock.current = false; }
  };

  const load = useCallback(async () => {
    const ticket = reads.current.begin();
    try {
      const [next, nextOptions] = await Promise.all([bootstrap(serviceCity), bookingOptions(coachId, serviceCity)]);
      if (!reads.current.isCurrent(ticket)) return;
      setLoadError("");
      if (!next.coaches.some((item) => item.id === coachId)) throw new Error("该教练不存在、已下线或暂不可预约");
      setData(next);
      setOptions(nextOptions);
      setSelectedLearnerId(current => next.learnerProfiles.some(item => item.id === current) ? current : next.learnerProfiles[0]?.id || '');
      if (nextOptions.venues[0]) setVenueId(current => nextOptions.venues.some(item => item.id === current) ? current : nextOptions.venues[0].id);
      else setLocationType("custom");
    } catch (error) {
      if (!reads.current.isCurrent(ticket)) return;
      setLoadError(error instanceof Error ? error.message : "预约配置加载失败");
    } finally {
      if (reads.current.isCurrent(ticket)) setLoading(false);
    }
  }, [coachId, serviceCity]);

useDidShow(() => { void load(); });
  useDidHide(() => { reads.current.cancel(); });
  useEffect(() => () => reads.current.cancel(), []);
  const coach = data?.coaches.find((item) => item.id === coachId) || null;
  const hasPriorEffectiveBooking = options?.trialEligible != null ? !options.trialEligible : Boolean(data?.bookings.some((booking) => booking.coachId === coachId && consumesTrial(booking.status)));
  const baseFen = options ? hasPriorEffectiveBooking ? options.regularBasePriceFen : options.trialBasePriceFen : 0;
  const feeFen = Math.round(baseFen * duration / 60);
  const price = useMemo(() => feeFen ? `¥${(feeFen / 100).toFixed(feeFen % 100 ? 2 : 0)}` : "提交后由平台核对", [feeFen]);
  const learner = data?.learnerProfiles.find(item => item.id === selectedLearnerId);

  const submitOnce = async () => {
    if (!options || !coach) { Taro.showToast({ title: loadError || "请先加载预约配置", icon: "none" }); return; }
    if (coach.bookable === false || coach.bookingEnabled === false) { Taro.showToast({ title: coach.unavailableReason || "该教练暂未接单", icon: "none" }); return; }
    let currentData = data;
    if (!getSession()) {
      saveDraft(true);
      try {
        const result = await startWechatLogin();
        if (result.status === "link_required") {
          const next = encodeURIComponent(returnPath);
          await Taro.navigateTo({ url: `/pages/account-link/index?next=${next}` });
          return;
        }
        setSession(result.session, true);
        if (!result.session.profile?.completed) {
          const next = encodeURIComponent(returnPath);
          await Taro.navigateTo({ url: `/pages/profile-edit/index?next=${next}` });
          return;
        }
        currentData = await bootstrap(serviceCity);
        setData(currentData);
        await Taro.showToast({ title: "登录成功", icon: "success" });
      }
      catch (error) { await Taro.showModal({ title: "需要登录", content: error instanceof Error ? error.message : "请先登录", showCancel: false }); return; }
    }
    if (!getSession()?.profile?.completed) {
      saveDraft(true);
      const next = encodeURIComponent(returnPath);
      await Taro.navigateTo({ url: `/pages/profile-edit/index?next=${next}` });
      return;
    }
    let latestStartsAt = options.latestStartsAt;
    try {
      const [fresh, freshOptions] = await Promise.all([bootstrap(serviceCity), bookingOptions(coachId, serviceCity)]);
      currentData = fresh; setData(fresh); setOptions(freshOptions);
      latestStartsAt = freshOptions.latestStartsAt;
      const freshCoach = fresh.coaches.find(item => item.id === coachId);
      if (!freshCoach || freshCoach.bookable === false || freshCoach.bookingEnabled === false) throw new Error(freshCoach?.unavailableReason || '该教练暂未接单，请重新选择');
      const freshRepeat = freshOptions.trialEligible != null ? !freshOptions.trialEligible : fresh.bookings.some(item => item.coachId === coachId && consumesTrial(item.status));
      const freshFee = Math.round((freshRepeat ? freshOptions.regularBasePriceFen : freshOptions.trialBasePriceFen) * duration / 60);
      if (freshFee !== feeFen) {
        const confirm = await Taro.showModal({ title: '费用已更新', content: `当前费用为¥${(freshFee / 100).toFixed(2)}，是否继续？` });
        if (!confirm.confirm) return;
      }
      if (locationType === 'venue' && !freshOptions.venues.some(item => item.id === venueId)) throw new Error('场馆已不可用，请重新选择');
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : '配置核对失败', icon: 'none' }); return; }
    const activeLearner = currentData?.learnerProfiles.find(item => item.id === selectedLearnerId);
    if (!activeLearner) {
      saveDraft(true);
      const result = await Taro.showModal({ title: "请先完善学员档案", content: "学员姓名和训练目标用于教练确认服务，不会公开展示。", confirmText: "去完善" });
      if (result.confirm) await Taro.navigateTo({ url: `/pages/learner-profile/index?mode=new&next=${encodeURIComponent(returnPath)}` });
      return;
    }
    if (!agreed) { Taro.showToast({ title: "请先确认服务协议", icon: "none" }); return; }
    const startsAt = parseTrainingTime(date, time);
    if (!Number.isFinite(startsAt)) { Taro.showToast({ title: '请选择有效的北京时间', icon: 'none' }); return; }
    if (startsAt < Date.now() + 2 * 60 * 60_000) { Taro.showToast({ title: "请选择至少 2 小时后的时间", icon: "none" }); return; }
    if (startsAt > latestStartsAt) { Taro.showToast({ title: "请选择 60 天内的训练时间", icon: "none" }); return; }
    if (locationType === "venue" && !venueId) { Taro.showToast({ title: "请选择已审核场馆，或填写期望地点", icon: "none" }); return; }
    if (locationType === "custom" && (!serviceAreas.includes(district) || address.trim().length < 4)) { Taro.showToast({ title: "请选择服务区域并填写详细训练地址", icon: "none" }); return; }
    setSubmitting(true);
    try {
      const payload = { coachId, learnerId: activeLearner.id, startsAt, durationMinutes: duration, locationType, venueId: locationType === "venue" ? venueId : undefined, customDistrict: locationType === "custom" ? district : undefined, customAddress: locationType === "custom" ? address.trim() : undefined, serviceCityId: serviceCity, note: note.trim() };
      saveDraft();
      const result = await createBooking(payload, bookingSubmissionKeys(coachId, serviceCity).for(payload));
      clearBookingDraft(coachId, serviceCity);
      await Taro.showModal({ title: "预约申请已提交", content: `申请编号 ${result.id}，等待教练确认后生效。`, showCancel: false });
      Taro.reLaunch({ url: "/pages/index/index?tab=bookings" });
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "提交失败，请重试", icon: "none", duration: 2600 }); }
    finally { setSubmitting(false); }
  };

const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true; setSubmitting(true);
    try { await submitOnce(); } finally { submitLock.current = false; setSubmitting(false); }
  };

  if (!coach || !options) return <View className="zg-booking-page"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>申请训练时间</Text><View /></View><View className="zg-empty"><Text className="zg-empty-title">{loading ? "正在读取预约配置" : "暂时不能预约"}</Text><Text className="zg-empty-copy">{loading ? "正在核对教练、价格和服务范围" : loadError}</Text>{!loading ? <View className="zg-outline-button" onClick={() => { setLoading(true); void load(); }}><Text>重新加载</Text></View> : <View className="zg-skeleton-line is-wide" />}</View></View>;

  return <View className="zg-booking-page"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>申请训练时间</Text><View /></View><View className="zg-booking-coach"><Text>{coach.name}</Text><Text>{coach.sport} · {serviceCityName(serviceCity)}服务</Text></View><View className="zg-form-section"><Text className="zg-detail-heading">选择学员</Text><Picker range={data?.learnerProfiles || []} rangeKey="name" value={Math.max(0,(data?.learnerProfiles || []).findIndex(item=>item.id===selectedLearnerId))} onChange={event=>setSelectedLearnerId(data?.learnerProfiles[Number(event.detail.value)]?.id || '')}><View className="zg-field"><Text>训练学员</Text><Text>{learner?.name || '请先创建档案'}</Text></View></Picker><View className="zg-outline-button" onClick={()=>void openLearnerPage()}><Text>查看或编辑档案</Text></View><View className="zg-mini-action" onClick={()=>void openLearnerPage(true)}><Text>新增学员</Text></View></View><View className="zg-form-section"><Text className="zg-detail-heading">日期和开始时间</Text><View className="zg-form-grid"><Picker mode="date" start={beijingDate(0)} end={beijingDate(60)} value={date} onChange={(event) => setDate(event.detail.value)}><View className="zg-field"><Text>训练日期</Text><Text>{date}</Text></View></Picker><Picker mode="time" value={time} onChange={(event) => setTime(event.detail.value)}><View className="zg-field"><Text>开始时间</Text><Text>{time}</Text></View></Picker></View><Text className="zg-helper">北京时间，可选择未来 2 小时至 60 天。</Text></View><View className="zg-form-section"><Text className="zg-detail-heading">训练时长</Text><View className="zg-segments">{([60, 90, 120] as const).map((item) => <View className={duration === item ? "is-active" : ""} key={item} onClick={() => setDuration(item)}><Text>{item} 分钟</Text></View>)}</View></View><View className="zg-form-section"><Text className="zg-detail-heading">训练地点</Text><RadioGroup onChange={(event) => setLocationType(event.detail.value as "venue" | "custom")}><View className="zg-radio-row"><Radio disabled={!options.venues.length} checked={locationType === "venue"} color="#176c54" value="venue" /><Text>选择教练已审核场馆</Text></View><View className="zg-radio-row"><Radio checked={locationType === "custom"} color="#176c54" value="custom" /><Text>填写期望地点</Text></View></RadioGroup>{locationType === "venue" && options.venues.length ? <Picker range={options.venues} rangeKey="name" onChange={(event) => setVenueId(options.venues[Number(event.detail.value)]?.id || "")}><View className="zg-field"><Text>训练场馆</Text><Text>{options.venues.find((item) => item.id === venueId)?.name || "请选择场馆"}</Text></View></Picker> : <View className="zg-custom-location">{locationType === "venue" ? <Text className="zg-helper">{serviceCityName(serviceCity)}暂无该教练已审核场馆，请填写双方协商的期望地点。</Text> : null}<Picker range={serviceAreas} value={Math.max(0, serviceAreas.indexOf(district))} onChange={(event) => setDistrict(serviceAreas[Number(event.detail.value)])}><View className="zg-field"><Text>期望区域</Text><Text>{serviceCityName(serviceCity)} · {district}</Text></View></Picker><Input maxlength={120} onInput={(event) => setAddress(event.detail.value)} placeholder="期望训练地址" value={address} /></View>}</View><View className="zg-form-section"><Text className="zg-detail-heading">训练需求</Text><Textarea maxlength={500} onInput={(event) => setNote(event.detail.value)} placeholder="可选：训练目标、基础情况或需要教练注意的事项" value={note} /></View><View className="zg-price-summary"><View><Text>{hasPriorEffectiveBooking ? "常规课费用" : "首次试课费用"}</Text><Text>教练确认后生效 · 线下支付</Text></View><Text>{price}</Text></View><View className="zg-agreement" onClick={() => setAgreed(!agreed)}><View className={agreed ? "is-checked" : ""}><Text>{agreed ? "✓" : ""}</Text></View><Text>我已阅读并同意服务协议，费用以服务端快照为准</Text></View><View className="zg-mini-action" onClick={()=>{saveDraft();void Taro.navigateTo({url:'/pages/legal/index?slug=terms'});}}><Text>阅读服务协议与隐私政策</Text></View><View className={`zg-primary-button zg-submit ${submitting ? "is-disabled" : ""}`} onClick={() => !submitting && void submit()}><Text>{submitting ? "正在提交" : "提交预约申请"}</Text></View></View>;
}
