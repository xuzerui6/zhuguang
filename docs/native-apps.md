# 逐光 Coach OS 原生应用交付说明

当前仓库已经包含三层交付：

- Web/PWA：浏览器访问和安装到桌面/主屏幕。
- Mobile Native：Capacitor 工程，覆盖 iOS 和 Android。
- Desktop Native：Tauri 工程，覆盖 Windows、Linux、macOS。

## 项目结构

- `capacitor.config.ts`：iOS/Android 原生应用配置。
- `native/mobile/www/`：移动端原生启动壳和离线兜底页。
- `android/`：Android Gradle 工程。
- `ios/`：iOS Xcode 工程。
- `src-tauri/`：Tauri 桌面端工程。
- `native/desktop/www/`：Windows/Linux/macOS 桌面启动壳。

## 通用检查

```bash
npm run native:check
npm test
```

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

工程已生成在 `android/`。

构建要求：

- JDK
- Android Studio 或 Android SDK
- Android signing keystore

常用命令：

```bash
npm run mobile:android:sync
npm run mobile:android:open
npm run mobile:android:build
```

输出目标：

- `.apk`：测试安装包
- `.aab`：Google Play / 国内安卓商店更常用的发布格式

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

当前 native shell 会进入已发布的逐光私有平台。要达到应用商店长期发布标准，下一阶段应把核心前端拆成可本地静态打包的 App Core，并补齐推送、文件上传、定位、系统通知、自动更新和签名流水线。
