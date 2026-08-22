import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "com.zhuguang.coachos",
  appName: "逐光",
  webDir: "native/mobile/www",
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
  },
  server: {
    androidScheme: "https",
    allowNavigation: ["beijingzhuguang.top", "api.beijingzhuguang.top"],
  },
};

export default config;
