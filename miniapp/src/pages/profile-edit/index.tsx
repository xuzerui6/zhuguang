import Taro, { useRouter } from "@tarojs/taro";
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import { useState } from "react";
import { updateAccountProfile } from "../../services/api";
import { getSession, setSession } from "../../services/storage";
import { SERVICE_AREAS, SERVICE_CITIES, type ServiceCityId } from '../../../../shared/service-cities';
import { safeMiniappNext } from '../../../../shared/product-flow';
import "../detail.scss";

export default function ProfileEditPage() {
  const router = useRouter();
  const next = router.params.next ? safeMiniappNext(String(router.params.next)) : "";
  const session = getSession();
  const profile = session?.profile;
  const [nickname, setNickname] = useState(profile?.nickname || "");
  const [serviceCityId, setServiceCityId] = useState<ServiceCityId>(profile?.serviceCityId || "beijing");
  const [serviceArea, setServiceArea] = useState(profile?.serviceArea || profile?.district || SERVICE_AREAS[serviceCityId][0]);
  const [bio, setBio] = useState(profile?.bio || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const updatedProfile = await updateAccountProfile({ nickname: nickname.trim(), serviceArea, serviceCityId, bio: bio.trim() });
      const current = getSession();
      if (current) setSession({ ...current, profile: updatedProfile }, true);
      Taro.showToast({ title: "资料已保存", icon: "success" });
      setTimeout(() => next ? Taro.redirectTo({ url: next }) : Taro.navigateBack(), 300);
    } catch (error) { Taro.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" }); }
    finally { setBusy(false); }
  };
  return <View className="zg-profile-edit"><View className="zg-detail-nav"><View onClick={() => Taro.navigateBack()}><Text>返回</Text></View><Text>账号资料</Text><View /></View><View className="zg-profile-edit-avatar"><View className="zg-profile-avatar"><Text>{nickname.slice(0, 1) || "我"}</Text></View><Text>账号头像仅在已建立服务关系的双方之间展示</Text></View><View className="zg-form-section"><Text className="zg-detail-heading">基本信息</Text><View className="zg-auth-field"><Text>昵称</Text><Input maxlength={20} onInput={(event) => setNickname(event.detail.value)} placeholder="2 至 20 个字" value={nickname} /></View><Picker range={SERVICE_CITIES.map(item=>item.name)} value={Math.max(0,SERVICE_CITIES.findIndex(item=>item.id===serviceCityId))} onChange={(event) => { const city=SERVICE_CITIES[Number(event.detail.value)]?.id || 'beijing'; setServiceCityId(city); setServiceArea(SERVICE_AREAS[city][0]); }}><View className="zg-field"><Text>服务城市</Text><Text>{SERVICE_CITIES.find(item=>item.id===serviceCityId)?.name}</Text></View></Picker><Picker range={[...SERVICE_AREAS[serviceCityId]]} value={Math.max(0, SERVICE_AREAS[serviceCityId].indexOf(serviceArea))} onChange={(event) => setServiceArea(SERVICE_AREAS[serviceCityId][Number(event.detail.value)])}><View className="zg-field"><Text>所在区域</Text><Text>{serviceArea}</Text></View></Picker><Textarea maxlength={80} onInput={(event) => setBio(event.detail.value)} placeholder="可选，写一句简短的个性签名" value={bio} /><Text className="zg-helper">账号昵称与学员真实姓名、教练公开姓名相互独立。</Text></View><View className="zg-primary-button zg-submit" onClick={() => !busy && void save()}><Text>{busy ? "正在保存" : "保存资料"}</Text></View></View>;
}
