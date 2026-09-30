import Taro from "@tarojs/taro";
import type { CSSProperties } from "react";

export function miniappNavigationStyle(): CSSProperties | undefined {
  try {
    const windowInfo = Taro.getWindowInfo();
    const capsule = Taro.getMenuButtonBoundingClientRect();
    const statusBarHeight = windowInfo.statusBarHeight || 0;
    const verticalGap = Math.max(4, capsule.top - statusBarHeight);
    const contentHeight = Math.max(44, capsule.height + verticalGap * 2);
    return {
      minHeight: `${statusBarHeight + contentHeight}px`,
      paddingRight: `${Math.max(12, windowInfo.windowWidth - capsule.left + 8)}px`,
      paddingTop: `${statusBarHeight}px`,
    };
  } catch {
    return undefined;
  }
}
