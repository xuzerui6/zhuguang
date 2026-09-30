import { Image, Text, View } from "@tarojs/components";
import type { CoachOverview } from "../../types";
import Taro from '@tarojs/taro';

export function CoachProfile({
  overview,
  onEdit,
  onStudentMode,
}: {
  overview: CoachOverview;
  onEdit: () => void;
  onStudentMode: () => void;
}) {
  return (
    <View className="zg-page-content zg-subpage">
      <View className="zg-profile-card">
        {overview.coach.avatarUrl
          ? <Image ariaLabel={`${overview.coach.name}教练`} className="zg-profile-avatar-image" mode="aspectFill" src={overview.coach.avatarUrl} />
          : <View className="zg-profile-avatar is-coach"><Text>{overview.coach.name.slice(0, 1)}</Text></View>}
        <View>
          <Text className="zg-profile-name">{overview.coach.name}</Text>
          <Text className="zg-profile-copy">{overview.coach.title}</Text>
          <Text className="zg-verified">{overview.coach.verificationLabel || "公开资料已审核"}</Text>
        </View>
      </View>
      <View className="zg-settings">
        <View onClick={onEdit}><Text>公开教练档案</Text><Text>修改后提交运营审核，线上资料不会直接变化</Text></View>
        <View onClick={onEdit}><Text>场馆与服务区域</Text><Text>新增或修改场馆需要运营审核</Text></View>
        <View onClick={() => Taro.navigateTo({ url: '/pages/support/index?role=coach' })}><Text>站内工单</Text><Text>提交服务问题并查看运营回复</Text></View>
        <View onClick={() => Taro.navigateTo({ url: '/pages/legal/index' })}><Text>协议与隐私</Text><Text>查看当前公开规则</Text></View>
      </View>
      <View className="zg-muted-note"><Text>训练总结在完成课程后从预约详情填写；账号安全设置请切换到学员模式管理。</Text></View>
      <View className="zg-outline-button zg-mode-switch" onClick={onStudentMode}><Text>切换为学员</Text></View>
    </View>
  );
}
