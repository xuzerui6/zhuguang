import { Image, Text, View } from "@tarojs/components";
import type { AccountProfile, Session } from "../../types";
import Taro from '@tarojs/taro';
import { deleteAccount } from '../../services/api';
import { coachOnboardingEntry } from '../../../../shared/coach-application';

type Props = {
  profile?: AccountProfile;
  session: Session | null;
  onBookings: () => void;
  onCoachMode: () => void;
  onDiscover: () => void;
  onEdit: () => void;
  onLearners: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onCoachApplication: () => void;
};

export function StudentProfile({ profile, session, onBookings, onCoachApplication, onCoachMode, onDiscover, onEdit, onLearners, onLogin, onLogout }: Props) {
  const open = (url: string) => session ? Taro.navigateTo({ url }) : onLogin();
  const remove = async () => {
    const confirmed = await Taro.showModal({ title: '申请注销账号', content: '账号资料将清除，依法或处理未结争议所需的记录按实际规则保留。此操作不可撤销。', confirmText: '确认注销' });
    if (!confirmed.confirm) return;
    try { await deleteAccount(); Taro.reLaunch({ url: '/pages/index/index?tab=profile' }); }
    catch (error) { Taro.showModal({ title: '注销未完成', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false }); }
  };
  const nickname = profile?.nickname || (session ? "昵称待完善" : "未登录");
  const entry = coachOnboardingEntry(session?.coachOnboarding, session?.coach);
  return (
    <View className="zg-page-content zg-subpage">
      <View className="zg-profile-card">
        {profile?.avatarUrl
          ? <Image ariaLabel={`${nickname}头像`} className="zg-profile-avatar-image" mode="aspectFill" src={profile.avatarUrl} />
          : <View className="zg-profile-avatar"><Text>{nickname.slice(0, 1)}</Text></View>}
        <View>
          <Text className="zg-profile-name">{nickname}</Text>
          <Text className="zg-profile-copy">{profile?.serviceCityId === "changchun" ? "长春" : "北京"}{profile?.serviceArea || profile?.district ? ` · ${profile?.serviceArea || profile?.district}` : ""} · 账号资料与教练公开档案相互独立</Text>
        </View>
      </View>
      {!session ? <View className="zg-primary-button" onClick={onLogin}><Text>微信登录</Text></View> : null}
      <View className="zg-settings">
        <View onClick={() => session ? onEdit() : onLogin()}><Text>账号资料</Text><Text>昵称、地区与个性签名</Text></View>
        <View onClick={() => session ? onLearners() : onLogin()}><Text>学员档案</Text><Text>本人或子女的训练信息</Text></View>
        <View onClick={onDiscover}><Text>收藏教练</Text><Text>在找教练页面查看并管理收藏</Text></View>
        <View onClick={onBookings}><Text>服务记录</Text><Text>查看预约状态、训练地点与费用快照</Text></View>
        <View onClick={() => open('/pages/service-records/index')}><Text>训练记录</Text><Text>查看教练发布的训练总结</Text></View>
        <View onClick={() => open('/pages/support/index')}><Text>站内工单</Text><Text>提交问题并查看处理状态</Text></View>
        <View onClick={() => Taro.navigateTo({ url: '/pages/legal/index?document=privacy' })}><Text>隐私政策</Text><Text>查看信息处理规则</Text></View>
        <View onClick={() => Taro.navigateTo({ url: '/pages/legal/index?document=terms' })}><Text>服务协议</Text><Text>查看预约与履约边界</Text></View>
        {session ? <View onClick={() => void remove()}><Text>注销账号</Text><Text>清除账号资料并撤销登录</Text></View> : null}
      </View>
      {entry.kind === "coach"
        ? <View className="zg-coach-entry" onClick={entry.canEnter ? onCoachMode : undefined}><Text className="zg-coach-entry-label">已入驻教练</Text><Text className="zg-coach-entry-title">{entry.title}</Text><Text>{entry.description}</Text></View>
        : <View className="zg-coach-entry is-application" onClick={onCoachApplication}><Text className="zg-coach-entry-label">教练合作</Text><Text className="zg-coach-entry-title">{entry.title}</Text><Text>{entry.description}</Text></View>}
      {session ? <View className="zg-outline-button zg-profile-logout" onClick={onLogout}><Text>退出当前账号</Text></View> : null}
    </View>
  );
}
