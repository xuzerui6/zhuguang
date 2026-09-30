import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { miniappNavigationStyle } from "./navigation-metrics";

export function DetailNav({ onRight, rightLabel, title }: { onRight?: () => void; rightLabel?: string; title: string }) {
  return <View className="zg-detail-nav" style={miniappNavigationStyle()}>
    <View onClick={() => Taro.navigateBack()}><Text>返回</Text></View>
    <Text>{title}</Text>
    {rightLabel ? <View onClick={onRight}><Text>{rightLabel}</Text></View> : <View />}
  </View>;
}
