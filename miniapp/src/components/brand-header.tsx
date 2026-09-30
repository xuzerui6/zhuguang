import { Image, Text, View } from "@tarojs/components";
import type { AccountMode } from "../types";
import logo from "../assets/logo.png";
import { miniappNavigationStyle } from "./navigation-metrics";
import { getStoredServiceCity, serviceCityName } from "../services/service-city";

export function BrandHeader({ mode, onAccount, onNotifications, unread = 0 }: { mode: AccountMode; onAccount: () => void; onNotifications: () => void; unread?: number }) {
  return (
    <View className="zg-header" style={miniappNavigationStyle()}>
      <View className="zg-brand">
        <Image ariaLabel="逐光" className="zg-logo" src={logo} mode="aspectFill" />
        <Text className="zg-brand-name">逐光</Text>
      </View>
      <View className="zg-header-city"><Text>{serviceCityName(getStoredServiceCity())}</Text></View>
      <View className="zg-header-spacer" />
      <View className="zg-notification" onClick={onNotifications}><Text>通知</Text>{unread ? <View className="zg-notification-dot" /> : null}</View>
      <View className="zg-account" onClick={onAccount}><Text>{mode === "coach" ? "教" : "我"}</Text></View>
    </View>
  );
}
