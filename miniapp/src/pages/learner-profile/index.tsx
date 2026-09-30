import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import { useCallback, useEffect, useState } from "react";
import { getLearnerProfile, listLearnerProfiles, saveLearnerProfile } from "../../services/api";
import { ALL_SPORTS } from "../../services/service-city";
import type { LearnerProfile } from "../../types";
import { safeMiniappNext } from '../../../../shared/product-flow';
import "../detail.scss";

const RELATIONS: Array<{ label: string; value: LearnerProfile["relation"] }> = [{ label: "本人", value: "self" }, { label: "子女", value: "child" }];
const GENDERS: Array<{ label: string; value: NonNullable<LearnerProfile["gender"]> }> = [{ label: "男", value: "male" }, { label: "女", value: "female" }, { label: "不填写", value: "unspecified" }];
const LEVELS = ["零基础", "初学", "有训练基础", "专项提升"];

export default function LearnerProfilePage() {
  const router = useRouter();
  const mode = router.params.mode === "new" || router.params.id ? "form" : "list";
  const profileId = router.params.id ? String(router.params.id) : "";
  const viewOnly=Boolean(profileId&&router.params.edit!=="1");
  const next = router.params.next ? safeMiniappNext(String(router.params.next)) : "";
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
  const [profiles, setProfiles] = useState<LearnerProfile[]>([]);
  const [loading, setLoading] = useState(mode === "list"||Boolean(profileId));
  const [error,setError]=useState("");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<LearnerProfile["relation"]>("self");
  const [gender, setGender] = useState<NonNullable<LearnerProfile["gender"]>>("unspecified");
  const [age, setAge] = useState("");
  const [sport, setSport] = useState(ALL_SPORTS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    if (mode !== "list") return;
    try { setProfiles(await listLearnerProfiles());setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "档案加载失败"); }
    finally { setLoading(false); }
  }, [mode]);

  useDidShow(() => { void loadList(); });
  useEffect(() => {
    if (!profileId) return;
    let active=true;
    void getLearnerProfile(profileId).then((profile) => {
      if(!active)return;
      setName(profile.name); setRelation(profile.relation); setGender(profile.gender || "unspecified");
      setAge(profile.age ? String(profile.age) : ""); setSport(profile.sport); setLevel(profile.level); setGoal(profile.goal);
    }).catch((error) => {if(active)setError(error instanceof Error ? error.message : "档案加载失败");}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  }, [profileId]);

  const save = async () => {
    if(busy||loading||error)return;
    if (name.trim().length < 2) { Taro.showToast({ title: "请填写学员姓名", icon: "none" }); return; }
    if (goal.trim().length < 2) { Taro.showToast({ title: "请填写训练目标", icon: "none" }); return; }
    const parsedAge = age ? Number(age) : undefined;
    if (parsedAge !== undefined && (!Number.isInteger(parsedAge) || parsedAge < 3 || parsedAge > 80)) { Taro.showToast({ title: "请填写有效年龄", icon: "none" }); return; }
    setBusy(true);
    try {
      const saved = await saveLearnerProfile({ id: profileId || undefined, name: name.trim(), relation, gender, age: parsedAge, sport, level, goal: goal.trim() });
      await Taro.showToast({ title: profileId ? "学员档案已更新" : "学员档案已创建", icon: "success" });
      const target = next.startsWith('/pages/booking/index') ? `${next}${next.includes('?') ? '&' : '?'}learner=${encodeURIComponent(saved.id)}` : next;
      setTimeout(() => Taro.redirectTo({ url: target || "/pages/learner-profile/index" }), 260);
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "保存失败，请重试", icon: "none", duration: 2600 }); }
    finally { setBusy(false); }
  };

  if(error)return <View className="zg-profile-edit"><Text className="zg-detail-heading">档案暂时没有加载成功</Text><Text className="zg-helper">{error}</Text><View className="zg-primary-button" onClick={()=>Taro.redirectTo({url:profileId?`/pages/learner-profile/index?id=${encodeURIComponent(profileId)}${viewOnly?"":"&edit=1"}${nextQuery}`:"/pages/learner-profile/index"})}><Text>重新加载</Text></View></View>;
  if(profileId&&loading)return <View className="zg-profile-edit"><View className="zg-skeleton-line is-wide"/><View className="zg-skeleton-line"/></View>;
  if(viewOnly)return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={()=>Taro.navigateBack()}><Text>返回</Text></View><Text>学员档案</Text><View/></View><View className="zg-form-section"><Text className="zg-detail-heading">{name}</Text><Text>{relation==="self"?"本人":"子女"} · {GENDERS.find(item=>item.value===gender)?.label}{age?` · ${age}岁`:""}</Text><Text>{sport} · {level}</Text><Text>{goal}</Text><Text className="zg-helper">仅用于匹配训练方案、预约与履约，不公开展示。</Text></View><View className="zg-primary-button" onClick={()=>Taro.navigateTo({url:`/pages/learner-profile/index?id=${encodeURIComponent(profileId)}&edit=1${nextQuery}`})}><Text>编辑档案</Text></View></View>;

  if (mode === "list") return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>学员档案</Text><View /></View><View className="zg-profile-list-head"><View><Text className="zg-detail-heading">常用学员</Text><Text className="zg-helper">档案仅用于匹配、预约和履约，不会公开展示。</Text></View><View className="zg-mini-action" onClick={() => Taro.navigateTo({ url: `/pages/learner-profile/index?mode=new${nextQuery}` })}><Text>新增</Text></View></View>{loading ? <View className="zg-form-section"><View className="zg-skeleton-line is-wide" /><View className="zg-skeleton-line" /></View> : profiles.length ? <View className="zg-learner-list">{profiles.map((profile) => <View className="zg-learner-card" key={profile.id} onClick={() => Taro.navigateTo({ url: `/pages/learner-profile/index?id=${encodeURIComponent(profile.id)}${nextQuery}` })}><View className="zg-learner-avatar"><Text>{profile.name.slice(0, 1)}</Text></View><View><Text>{profile.name}</Text><Text>{profile.relation === "self" ? "本人" : "子女"} · {profile.sport} · {profile.level}</Text><Text>{profile.goal}</Text></View><Text>查看档案 ›</Text></View>)}</View> : <View className="zg-empty"><Text className="zg-empty-title">还没有学员档案</Text><Text className="zg-empty-copy">创建本人或子女档案后，可在预约时直接选择。</Text><View className="zg-primary-button" onClick={() => Taro.navigateTo({ url: `/pages/learner-profile/index?mode=new${nextQuery}` })}><Text>创建第一份档案</Text></View></View>}</View>;

  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>{profileId ? "编辑学员档案" : "新增学员档案"}</Text><View /></View><View className="zg-form-section"><Text className="zg-detail-heading">服务对象</Text><View className="zg-segments is-two">{RELATIONS.map((item) => <View className={relation === item.value ? "is-active" : ""} key={item.value} onClick={() => setRelation(item.value)}><Text>{item.label}</Text></View>)}</View><View className="zg-auth-field"><Text>姓名</Text><Input maxlength={40} onInput={(event) => setName(event.detail.value)} placeholder="仅用于预约与履约" value={name} /></View><View className="zg-segments">{GENDERS.map((item) => <View className={gender === item.value ? "is-active" : ""} key={item.value} onClick={() => setGender(item.value)}><Text>{item.label}</Text></View>)}</View><View className="zg-auth-field"><Text>年龄（可选）</Text><Input maxlength={2} onInput={(event) => setAge(event.detail.value.replace(/\D/gu, ""))} placeholder="用于匹配训练方案" type="number" value={age} /></View></View><View className="zg-form-section"><Text className="zg-detail-heading">训练需求</Text><Picker range={ALL_SPORTS} value={Math.max(0, ALL_SPORTS.indexOf(sport))} onChange={(event) => setSport(ALL_SPORTS[Number(event.detail.value)])}><View className="zg-field"><Text>运动项目</Text><Text>{sport}</Text></View></Picker><Picker range={LEVELS} value={Math.max(0, LEVELS.indexOf(level))} onChange={(event) => setLevel(LEVELS[Number(event.detail.value)])}><View className="zg-field"><Text>当前基础</Text><Text>{level}</Text></View></Picker><Textarea maxlength={100} onInput={(event) => setGoal(event.detail.value)} placeholder="例如：提升400米成绩、准备中考体育" value={goal} /><Text className="zg-helper">信息仅用于匹配训练方案、预约确认和课程履约，不会出现在公开页面。</Text></View><View className={`zg-primary-button zg-submit ${busy ? "is-disabled" : ""}`} onClick={() => !busy && void save()}><Text>{busy ? "正在保存" : profileId ? "保存修改" : "创建学员档案"}</Text></View></View>;
}
