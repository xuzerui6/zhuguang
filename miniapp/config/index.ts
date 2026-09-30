import { defineConfig } from "@tarojs/cli";
import path from "node:path";

export default defineConfig({
  env: {
    TARO_APP_API_ORIGIN: JSON.stringify(process.env.TARO_APP_API_ORIGIN || "https://api.beijingzhuguang.top"),
    TARO_APP_CHANNEL_KEY: JSON.stringify(process.env.TARO_APP_CHANNEL_KEY || ""),
    TARO_APP_WECHAT_LOGIN_ENABLED: JSON.stringify(process.env.TARO_APP_WECHAT_LOGIN_ENABLED || "false"),
    TARO_APP_PREVIEW: JSON.stringify(process.env.TARO_APP_PREVIEW || "false"),
    TARO_APP_FUZZY_LOCATION_ENABLED: JSON.stringify(process.env.TARO_APP_FUZZY_LOCATION_ENABLED || "false"),
  },
  alias: {
    "@": path.resolve(__dirname, "..", "src"),
  },
  appId: "zhuguang-wechat-miniapp",
  date: "2026-09-14",
  designWidth: 390,
  deviceRatio: {
    390: 2,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  projectName: "zhuguang-wechat-miniapp",
  cache: { enable: true },
  mini: {
    compile: {
      include: [path.resolve(__dirname, '..', '..', 'shared'), path.resolve(__dirname, '..', '..', 'app', 'mobile', 'favorite-sync.ts')],
    },
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: { enable: false },
    },
  },
});
