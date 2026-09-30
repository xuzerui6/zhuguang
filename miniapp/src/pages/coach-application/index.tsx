import Taro from "@tarojs/taro";
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import { useEffect, useMemo, useState } from "react";
import { listCoachApplications, refreshAccountIdentity, request, saveCoachApplication, submitCoachApplication, uploadCoachApplicationMedia, withdrawCoachApplication } from "../../services/api";
import { coachOnboardingEntry, type CoachOnboardingSummary } from "../../../../shared/coach-application";
import { SERVICE_CITIES, type ServiceCityId } from "../../services/service-city";
import type { Bootstrap, CoachApplication } from "../../types";
import "../detail.scss";

type LocalMedia = { path: string; mime: string } | null;
const splitList = (value: string) => value.split(/[，,、\n]/u).map((item) => item.trim()).filter(Boolean);

async function readFile(path: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath: path,
      success: (result) => result.data instanceof ArrayBuffer ? resolve(result.data) : reject(new Error("资料文件读取失败")),
      fail: () => reject(new Error("资料文件读取失败，请重新选择")),
    });
  });
}

async function chooseMedia(credential = false): Promise<LocalMedia> {
  const result = await Taro.chooseMedia({ count: 1, mediaType: ["image"], sizeType: ["compressed"], sourceType: ["album", "camera"] });
  const file = result.tempFiles[0];
  if (!file) return null;
  if (file.size > (credential ? 8 : 4) * 1024 * 1024) throw new Error(credential ? "证明图片不能超过8MB" : "图片不能超过4MB");
  const extension = file.tempFilePath.toLowerCase().split(".").pop();
  return { path: file.tempFilePath, mime: extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg" };
}

export default function CoachApplicationPage() {
  const [existing, setExisting] = useState<CoachApplication | null>(null);
  const [catalog, setCatalog] = useState<NonNullable<Bootstrap["catalog"]> | null>(null);
  const [cityId, setCityId] = useState<ServiceCityId>("beijing");
  const [realName, setRealName] = useState(""); const [title, setTitle] = useState(""); const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("0"); const [audiences, setAudiences] = useState("青少年儿童、成人");
  const [goals, setGoals] = useState(""); const [strengths, setStrengths] = useState(""); const [honors, setHonors] = useState(""); const [credentials, setCredentials] = useState("");
  const [price, setPrice] = useState(""); const [trialPrice, setTrialPrice] = useState("");
  const [sportId, setSportId] = useState("sport-athletics"); const [areaId, setAreaId] = useState("");
  const [venueName, setVenueName] = useState(""); const [venueAddress, setVenueAddress] = useState("");
  const [avatar, setAvatar] = useState<LocalMedia>(null); const [hero, setHero] = useState<LocalMedia>(null); const [credentialFile, setCredentialFile] = useState<LocalMedia>(null);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<CoachOnboardingSummary>();
  const [loadError,setLoadError] = useState("");
  const [loadAttempt,setLoadAttempt] = useState(0);

  useEffect(() => {
    let active=true;
    void Promise.all([listCoachApplications(),refreshAccountIdentity()]).then(([items,identity]) => {
      if(!active)return;
      setOnboarding(identity.coachOnboarding);
      const item = items.find(item=>item.id===identity.coachOnboarding?.applicationId) || items[0] || null; setExisting(item);
      if (item && item.status !== "withdrawn") {
        setRealName(item.real_name || ""); setTitle(item.title || ""); setBio(item.bio || ""); setExperienceYears(String(item.experience_years || 0));
        setAudiences(item.audiences?.join("、")||"");setGoals(item.goals?.join("、")||"");setStrengths(item.strengths?.join("、")||"");setHonors(item.honors?.join("、")||"");setCredentials(item.credentials?.join("、")||"");
        setPrice(item.price_fen ? String(item.price_fen / 100) : ""); setTrialPrice(item.trial_price_fen ? String(item.trial_price_fen / 100) : "");
        if (item.sports[0]) setSportId(item.sports[0].id);
        if (item.areas[0]) { setCityId(item.areas[0].cityId); setAreaId(item.areas[0].id); }
        if (item.venues[0]) { setVenueName(item.venues[0].name); setVenueAddress(item.venues[0].address); }
      }
    }).catch((error) => {if(active)setLoadError(error instanceof Error ? error.message : "申请加载失败");}).finally(() => {if(active)setLoading(false);});
    return()=>{active=false;};
  }, [loadAttempt]);
  useEffect(() => {
    let active = true;
    void request<NonNullable<Bootstrap["catalog"]>>(`/api/v1/catalog?city=${cityId}`, "GET", undefined, false).then((value) => {
      if (!active) return;
      setCatalog(value);
      setAreaId(current=>value.serviceAreas?.some(area=>area.id===current)?current:value.serviceAreas?.[0]?.id||"");
      setSportId(current=>value.sports.some(sport=>sport.id===current)?current:value.sports[0]?.id||"");
    }).catch(() => {
      if (!active) return;
      setCatalog(null);
      void Taro.showToast({ title: "服务区域加载失败，请重新选择城市", icon: "none" });
    });
    return () => { active = false; };
  }, [cityId]);

  const cityIndex = Math.max(0, SERVICE_CITIES.findIndex((item) => item.id === cityId));
  const sports = catalog?.sports || [];
  const areas = catalog?.serviceAreas || [];
  const locked = existing?.status === "pending" || existing?.status === "approved" || onboarding?.status === "pending";
  const mediaComplete = Boolean((avatar || existing?.avatar_temp_key) && (hero || existing?.hero_temp_key) && (credentialFile || existing?.credentialTempKeys?.length));
  const statusText = useMemo(() => ({ draft: "草稿", pending: "待运营审核", approved: "审核通过，已自动上架", rejected: "审核未通过，可修改后重提", withdrawn: "已撤回" }[existing?.status || "draft"]), [existing?.status]);

  const save = async (submitAfter = false) => {
    if (locked || busy || onboarding?.isOnboarded) return;
    setBusy(true);
    try {
      const result = await saveCoachApplication({
        applicationId: existing?.status === "withdrawn" ? undefined : existing?.id,
        realName, title, bio, experienceYears: Number(experienceYears), audiences: splitList(audiences), goals: splitList(goals), strengths: splitList(strengths), honors: splitList(honors), credentials: splitList(credentials),
        priceFen: Math.round(Number(price) * 100), trialPriceFen: Math.round(Number(trialPrice) * 100), sportIds: [sportId], areaIds: [areaId], primarySportId: sportId, primaryAreaId: areaId,
        venue: { name: venueName, address: venueAddress, areaId },
      });
      setExisting(result);
      if (avatar) { await uploadCoachApplicationMedia(result.id, "avatar", await readFile(avatar.path), avatar.mime);setAvatar(null); }
      if (hero) { await uploadCoachApplicationMedia(result.id, "hero", await readFile(hero.path), hero.mime);setHero(null); }
      if (credentialFile) { await uploadCoachApplicationMedia(result.id, "credential", await readFile(credentialFile.path), credentialFile.mime);setCredentialFile(null); }
      const latest=await request<CoachApplication>(`/api/v1/coach-applications/${result.id}`);
      setExisting(latest);
      if (submitAfter) {
        if (!mediaComplete && !avatar && !hero && !credentialFile) throw new Error("请上传头像、详情图片和证明材料");
        await submitCoachApplication(result.id);
        setExisting({ ...latest, status: "pending" });
        Taro.showToast({ title: "申请已提交审核", icon: "success" });
      } else { Taro.showToast({ title: "草稿已保存", icon: "success" }); }
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none", duration: 2800 }); }
    finally { setBusy(false); }
  };

  const withdraw = async () => {
    if (!existing || busy) return;
    const confirm = await Taro.showModal({ title: "撤回申请", content: "撤回后可以继续修改并重新提交。", confirmText: "确认撤回" });
    if (!confirm.confirm) return;
    try { await withdrawCoachApplication(existing.id); setExisting({ ...existing, status: "withdrawn" }); Taro.showToast({ title: "申请已撤回", icon: "success" }); }
    catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "撤回失败", icon: "none" }); }
  };

  const selectMedia = async (kind: "avatar" | "hero" | "credential") => {
    if (locked) return;
    try {
      const value = await chooseMedia(kind === "credential");
      if (kind === "avatar") setAvatar(value);
      else if (kind === "hero") setHero(value);
      else setCredentialFile(value);
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : "图片选择失败", icon: "none" });
    }
  };

  if (loading) return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>教练入驻</Text><View /></View><View className="zg-form-section"><View className="zg-skeleton-line is-wide" /><View className="zg-skeleton-line" /></View></View>;
  if (loadError) return <View className="zg-profile-edit"><Text>{loadError}</Text><View className="zg-outline-button" onClick={()=>{setLoading(true);setLoadError("");setLoadAttempt(value=>value+1);}}><Text>重新读取申请</Text></View><View className="zg-outline-button" onClick={()=>Taro.reLaunch({url:"/pages/index/index?tab=profile"})}><Text>返回我的</Text></View></View>;
  if (onboarding?.isOnboarded) return <View className="zg-profile-edit"><Text className="zg-detail-title">已入驻教练</Text><Text>{coachOnboardingEntry(onboarding).description}</Text><View className="zg-primary-button" onClick={()=>Taro.reLaunch({url:"/pages/index/index?tab=profile"})}><Text>返回我的</Text></View></View>;
  if (existing?.status === "approved") return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>教练入驻</Text><View /></View><View className="zg-application-result is-approved"><Text>审核已通过</Text><Text>教练身份、公开档案和接单能力已自动开通。返回“我的”即可进入教练工作台。</Text></View></View>;

  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>申请成为教练</Text><View /></View>{existing ? <View className={`zg-application-status is-${existing.status}`}><Text>{statusText}</Text><Text>{existing.review_note || "资料仅在审核通过后公开。"}</Text>{existing.status === "pending" ? <View onClick={() => void withdraw()}><Text>撤回申请</Text></View> : null}</View> : null}<View className="zg-form-section"><Text className="zg-detail-heading">身份与介绍</Text><View className="zg-auth-field"><Text>真实姓名</Text><Input disabled={locked} maxlength={40} value={realName} onInput={(event) => setRealName(event.detail.value)} placeholder="与证明材料一致" /></View><View className="zg-auth-field"><Text>公开头衔</Text><Input disabled={locked} maxlength={80} value={title} onInput={(event) => setTitle(event.detail.value)} placeholder="例如：田径专项训练教练" /></View><Textarea disabled={locked} maxlength={1000} value={bio} onInput={(event) => setBio(event.detail.value)} placeholder="至少20字，介绍训练理念与服务方式" /><View className="zg-auth-field"><Text>执教年限</Text><Input disabled={locked} type="number" value={experienceYears} onInput={(event) => setExperienceYears(event.detail.value.replace(/\D/gu, ""))} /></View></View><View className="zg-form-section"><Text className="zg-detail-heading">服务范围</Text><Picker disabled={locked} range={SERVICE_CITIES} rangeKey="name" value={cityIndex} onChange={(event) => setCityId(SERVICE_CITIES[Number(event.detail.value)].id)}><View className="zg-field"><Text>服务城市</Text><Text>{SERVICE_CITIES[cityIndex].name}</Text></View></Picker><Picker disabled={locked} range={sports} rangeKey="name" value={Math.max(0, sports.findIndex((item) => item.id === sportId))} onChange={(event) => setSportId(sports[Number(event.detail.value)]?.id || "")}><View className="zg-field"><Text>主项目</Text><Text>{sports.find((item) => item.id === sportId)?.name || "请选择"}</Text></View></Picker><Picker disabled={locked} range={areas} rangeKey="name" value={Math.max(0, areas.findIndex((item) => item.id === areaId))} onChange={(event) => setAreaId(areas[Number(event.detail.value)]?.id || "")}><View className="zg-field"><Text>主服务区域</Text><Text>{areas.find((item) => item.id === areaId)?.name || "请选择"}</Text></View></Picker><View className="zg-auth-field"><Text>服务对象</Text><Input disabled={locked} value={audiences} onInput={(event) => setAudiences(event.detail.value)} placeholder="青少年儿童、成人" /></View><View className="zg-auth-field"><Text>训练目标</Text><Input disabled={locked} value={goals} onInput={(event) => setGoals(event.detail.value)} placeholder="中考体育、专项提升" /></View><View className="zg-auth-field"><Text>擅长方向</Text><Input disabled={locked} value={strengths} onInput={(event) => setStrengths(event.detail.value)} placeholder="用逗号分隔" /></View></View><View className="zg-form-section"><Text className="zg-detail-heading">价格与场馆</Text><View className="zg-form-grid"><View className="zg-auth-field"><Text>常规课（元/60分钟）</Text><Input disabled={locked} type="digit" value={price} onInput={(event) => setPrice(event.detail.value)} /></View><View className="zg-auth-field"><Text>试课（元/60分钟）</Text><Input disabled={locked} type="digit" value={trialPrice} onInput={(event) => setTrialPrice(event.detail.value)} /></View></View><View className="zg-auth-field"><Text>场馆名称</Text><Input disabled={locked} value={venueName} onInput={(event) => setVenueName(event.detail.value)} placeholder="必须是真实可服务场馆" /></View><View className="zg-auth-field"><Text>场馆地址</Text><Input disabled={locked} value={venueAddress} onInput={(event) => setVenueAddress(event.detail.value)} placeholder="填写详细地址" /></View></View><View className="zg-form-section"><Text className="zg-detail-heading">经历与证明</Text><View className="zg-auth-field"><Text>荣誉经历（可选）</Text><Input disabled={locked} value={honors} onInput={(event) => setHonors(event.detail.value)} placeholder="用逗号分隔，仅填写真实信息" /></View><View className="zg-auth-field"><Text>证书或资质</Text><Input disabled={locked} value={credentials} onInput={(event) => setCredentials(event.detail.value)} placeholder="用逗号分隔" /></View><View className="zg-upload-grid"><View onClick={() => void selectMedia("avatar")}><Text>{avatar || existing?.avatar_temp_key ? "头像已选择" : "上传头像"}</Text><Text>正方形清晰照片</Text></View><View onClick={() => void selectMedia("hero")}><Text>{hero || existing?.hero_temp_key ? "详情图已选择" : "上传详情图"}</Text><Text>用于教练详情页</Text></View><View onClick={() => void selectMedia("credential")}><Text>{credentialFile || existing?.credentialTempKeys?.length ? "证明已选择" : "上传证明"}</Text><Text>证书或经历材料</Text></View></View><Text className="zg-helper">审核通过后才会公开；拒绝会说明原因，可修改后重提。</Text></View>{!locked ? <View className="zg-application-actions"><View className={`zg-outline-button ${busy ? "is-disabled" : ""}`} onClick={() => !busy && void save(false)}><Text>保存草稿</Text></View><View className={`zg-primary-button ${busy ? "is-disabled" : ""}`} onClick={() => !busy && void save(true)}><Text>{busy ? "正在提交" : "提交审核"}</Text></View></View> : null}</View>;
}
