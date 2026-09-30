import Taro, { useError, useUnhandledRejection } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import "./app.scss";

function readableStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "未知启动错误");
  return message.split("\n", 1)[0].slice(0, 160);
}

class StartupBoundary extends Component<PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: readableStartupError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Zhuguang miniapp render failure", error, info.componentStack);
  }

  private reload = () => {
    this.setState({ error: null });
    void Taro.reLaunch({ url: "/pages/index/index" });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <View className="zg-crash-screen">
        <View className="zg-crash-mark"><Text>Z</Text></View>
        <Text className="zg-crash-title">页面没有正常载入</Text>
        <Text className="zg-crash-copy">{this.state.error}</Text>
        <View className="zg-crash-action" onClick={this.reload}><Text>重新载入</Text></View>
      </View>
    );
  }
}

export default function App({ children }: PropsWithChildren) {
  useError((error) => {
    console.error("Zhuguang miniapp runtime failure", error);
    void Taro.showModal({ title: "小程序启动异常", content: readableStartupError(error), showCancel: false });
  });
  useUnhandledRejection(({ reason }) => {
    console.error("Zhuguang miniapp unhandled rejection", reason);
  });
  return <StartupBoundary>{children}</StartupBoundary>;
}
