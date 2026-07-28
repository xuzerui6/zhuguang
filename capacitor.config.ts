import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zhuguang.coachos",
  appName: "ZhuGuang Coach OS",
  webDir: "native/mobile/www",
  server: {
    androidScheme: "https",
    allowNavigation: ["zhuguang-coach-platform.xuzerui6.chatgpt.site"],
    errorPath: "offline.html",
  },
};

export default config;
