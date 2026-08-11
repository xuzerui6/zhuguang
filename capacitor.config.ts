import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.zhuguang.coachos",
  appName: "逐光",
  webDir: "native/mobile/www",
  server: {
    androidScheme: "https",
    allowNavigation: ["beijingzhuguang.top", "api.beijingzhuguang.top"],
  },
};

export default config;
