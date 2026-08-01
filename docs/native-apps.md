# 逐光 Coach OS 原生应用交付说明

当前仓库已经包含三层交付：

- Web/PWA：浏览器访问和安装到桌面/主屏幕。
- Mobile Native：Capacitor 工程，覆盖 iOS 和 Android。
- Desktop Native：Tauri 工程，覆盖 Windows、Linux、macOS。

## 项目结构

- `capacitor.config.ts`：iOS/Android 原生应用配置。
- `native/mobile/src/`：可独立运行的移动端 React 应用。
- `native/mobile/www/`：Vite 生成的离线移动端资源包。
- `android/`：Android Gradle 工程。
- `ios/`：iOS Xcode 工程。
- `src-tauri/`：Tauri 桌面端工程。
- `native/desktop/www/`：Windows/Linux/macOS 桌面启动壳。

## 通用检查

```bash
npm run native:check
npm run native:toolchain
npm run native:icons
npm test
```

`native:toolchain` 默认只输出诊断，不会因为当前机器缺少某个平台工具链而失败；如果需要在 CI 中强制失败，可直接运行：

```bash
node scripts/check-native-toolchain.mjs --strict
```

## 品牌图标

逐光图标源在 `public/app-icon-512.png` 和 `src-tauri/icons/`。移动端原生工程使用：

```bash
npm run native:icons
```

该命令会把品牌图标同步到：

- `android/app/src/main/res/`
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

## CI 构建

五端构建骨架在 `.github/workflows/native-builds.yml`。

当前工作流包含：

- Web/PWA + 原生配置检查
- Android 编译检查（debug 包不上传、不分发）
- Android 私有 release APK（仅手动触发并从 GitHub Secrets 注入签名）
- iOS simulator build
- Windows Tauri bundle
- Linux Tauri bundle
- macOS Tauri bundle

iOS 和桌面商店发布仍需补充证书、notarization 与 Apple provisioning profile。

## iOS

工程已生成在 `ios/`。

构建要求：

- macOS
- Xcode
- Apple Developer 账号
- iOS Distribution 证书和 provisioning profile

常用命令：

```bash
npm run mobile:ios:sync
npm run mobile:ios:open
npm run mobile:ios:build
```

说明：iOS 的 `.ipa`、TestFlight 和 App Store 包必须在 macOS/Xcode 环境完成。

## Android

### Unified mobile API

The Android client uses the standalone `worker/mobile-api.ts` Worker in production. Start from
`wrangler.mobile-api.example.jsonc`, bind the dedicated `zhuguang-mobile-api` D1 database and the
private `zhuguang-mobile-releases` R2 bucket, then store all authentication, SMS, update-ticket,
operator, and JPush credentials as Worker secrets. The channel key is an identifier bundled into
the APK and must not be treated as user authorization or as a secret.

The Worker cron retries pending push deliveries every five minutes. JPush remains disabled until
the server has an AppKey and Master Secret and the Android build receives only the public AppKey.

工程已生成在 `android/`。

构建要求：

- JDK 21 或更高版本
- Android SDK Platform 36 / Build Tools 36
- 仓库外 Android release keystore

常用命令：

```bash
npm run mobile:android:sync
npm run mobile:android:open
npm run mobile:android:build
npm run mobile:android:apk
npm run mobile:android:release
```

输出目标：

- `public/downloads/zhuguang-android-private-1.1.0.apk`：统一双身份私有试点 release APK
- `public/downloads/android-private-release.json`：版本、大小、SHA-256 与签名指纹
- `.aab`：Google Play / 国内安卓商店更常用的发布格式

`mobile:android:apk` 与 `mobile:android:release` 都只生成 release 签名包。构建前必须在当前终端提供：

```bash
ZHUGUANG_ANDROID_KEYSTORE=/outside/repository/zhuguang-release.jks
ZHUGUANG_ANDROID_KEY_ALIAS=zhuguang-student
ZHUGUANG_ANDROID_STORE_PASSWORD=***
ZHUGUANG_ANDROID_KEY_PASSWORD=***
```

可选变量：

```bash
ZHUGUANG_API_BASE_URL=https://private-api.example.com
VITE_PILOT_APP_KEY=***
ZHUGUANG_ANDROID_VERSION_NAME=1.1.0
ZHUGUANG_ANDROID_VERSION_CODE=3
```

密钥、密码和生产 API 凭据不得写入仓库或 APK。构建脚本会执行 Capacitor 同步、`assembleRelease`、`apksigner verify`，随后生成 SHA-256 校验值和签名证书指纹。

## Windows

工程由 `src-tauri/` 提供。

构建要求：

- Rust / Cargo
- Microsoft C++ Build Tools
- Microsoft Edge WebView2 Runtime
- 代码签名证书

常用命令：

```bash
npm run desktop:prepare
npm run desktop:build
```

输出目标通常为 `.exe`、`.msi`。

## Linux

构建要求：

- Linux 构建机
- Rust / Cargo
- WebKitGTK 和 Tauri Linux 系统依赖

常用命令：

```bash
npm run desktop:prepare
npm run desktop:build
```

输出目标通常为 AppImage、deb、rpm。

## macOS

构建要求：

- macOS
- Xcode Command Line Tools
- Apple Developer ID 证书
- notarization 配置

常用命令：

```bash
npm run desktop:prepare
npm run desktop:build
```

输出目标通常为 `.app`、`.dmg`。

## 当前限制

当前 Android App 已覆盖匿名浏览、手机号验证、收藏合并、教练筛选与详情、预约、消息、通知、学员档案、账号安全和注销。北京私有试点上线前仍需配置生产 D1/R2、腾讯云短信、手机号白名单与私有 HTTPS API；首版不包含在线支付、精确定位和原生推送。
