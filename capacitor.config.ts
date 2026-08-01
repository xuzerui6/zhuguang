import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zhuguang.coachos",
  appName: "逐光",
  webDir: "native/mobile/www",
  server: {
    androidScheme: "https",
    allowNavigation: ["zhuguang-coach-platform.xuzerui6.chatgpt.site"],
  },
};

export default config;
