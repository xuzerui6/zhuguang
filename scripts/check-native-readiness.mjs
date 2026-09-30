import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const files = [
  "capacitor.config.ts",
  "native/mobile/index.html",
  "native/mobile/src/main.tsx",
  "native/mobile/vite.config.ts",
  "native/mobile/www/index.html",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/java/com/zhuguang/coachos/ZhuguangJCommonService.java",
  "android/app/src/main/java/com/zhuguang/coachos/ZhuguangPushReceiver.java",
  "android/app/src/main/java/com/zhuguang/coachos/PushBridgePlugin.java",
  "android/app/src/main/res/drawable/ic_notification_zhuguang.xml",
  "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
  "android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml",
  "ios/App/App/Info.plist",
  "codemagic.yaml",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "native/desktop/www/index.html",
  "native/assets/ios-app-icon-1024.png",
  ".github/workflows/native-builds.yml",
];

for (const file of files) {
  await access(join(root, file));
}

const [capacitorConfig, nativeMobileEntry, tauriConfigRaw, packageJsonRaw, adaptiveIconV26, adaptiveIconV33, notificationIcon, androidManifest, jpushService, pushReceiver, pushBridge, iosInfoPlist, codemagicWorkflow] = await Promise.all([
  readFile(join(root, "capacitor.config.ts"), "utf8"),
  readFile(join(root, "native/mobile/src/main.tsx"), "utf8"),
  readFile(join(root, "src-tauri/tauri.conf.json"), "utf8"),
  readFile(join(root, "package.json"), "utf8"),
  readFile(join(root, "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"), "utf8"),
  readFile(join(root, "android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml"), "utf8"),
  readFile(join(root, "android/app/src/main/res/drawable/ic_notification_zhuguang.xml"), "utf8"),
  readFile(join(root, "android/app/src/main/AndroidManifest.xml"), "utf8"),
  readFile(join(root, "android/app/src/main/java/com/zhuguang/coachos/ZhuguangJCommonService.java"), "utf8"),
  readFile(join(root, "android/app/src/main/java/com/zhuguang/coachos/ZhuguangPushReceiver.java"), "utf8"),
  readFile(join(root, "android/app/src/main/java/com/zhuguang/coachos/PushBridgePlugin.java"), "utf8"),
  readFile(join(root, "ios/App/App/Info.plist"), "utf8"),
  readFile(join(root, "codemagic.yaml"), "utf8"),
]);

async function digest(file) {
  const body = await readFile(join(root, file));
  return createHash("sha256").update(body).digest("hex");
}

const [androidSourceIcon, androidAppIcon, androidSourceForeground, androidAppForeground, androidSourceMonochrome, androidAppMonochrome, iosSourceIcon, iosAppIcon] = await Promise.all([
  digest("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png"),
  digest("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"),
  digest("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png"),
  digest("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png"),
  digest("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_monochrome.png"),
  digest("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_monochrome.png"),
  digest("native/assets/ios-app-icon-1024.png"),
  digest("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"),
]);

const tauriConfig = JSON.parse(tauriConfigRaw);
const packageJson = JSON.parse(packageJsonRaw);

const checks = [
  ["Capacitor app id", capacitorConfig.includes("com.zhuguang.coachos")],
  ["Capacitor mobile webDir", capacitorConfig.includes('webDir: "native/mobile/www"')],
  ["Capacitor mobile app name", capacitorConfig.includes('appName: "逐光"')],
  ["Capacitor iOS/Android installed", Boolean(packageJson.devDependencies?.["@capacitor/android"] && packageJson.devDependencies?.["@capacitor/ios"])],
  ["Native mobile React entry", nativeMobileEntry.includes("<MobileStudentApp")],
  ["Native mobile design system", nativeMobileEntry.includes('import "../../../app/mobile/mobile.css"')],
  ["Native mobile offline build", packageJson.scripts?.["mobile:web:build"] === "vite build --config native/mobile/vite.config.ts"],
  ["Android APK release alias", packageJson.scripts?.["mobile:android:apk"] === "npm run mobile:android:release"],
  ["Android release build command", packageJson.scripts?.["mobile:android:release"] === "node scripts/build-android-apk.mjs"],
  ["Tauri desktop identifier", tauriConfig.identifier === "com.zhuguang.coachos.desktop"],
  ["Tauri desktop frontend", tauriConfig.build?.frontendDist === "../native/desktop/www"],
  ["Tauri bundle enabled", tauriConfig.bundle?.active === true],
  ["Android branded icon synced", androidSourceIcon === androidAppIcon],
  ["Android adaptive foreground synced", androidSourceForeground === androidAppForeground],
  ["Android monochrome icon synced", androidSourceMonochrome === androidAppMonochrome],
  ["Android adaptive icon uses independent layers", adaptiveIconV26.includes("ic_launcher_background") && adaptiveIconV26.includes("ic_launcher_foreground")],
  ["Android 8 adaptive icon excludes unsupported monochrome layer", !adaptiveIconV26.includes("<monochrome")],
  ["Android 13 themed icon enabled", adaptiveIconV33.includes("<monochrome")],
  ["Android notification icon is monochrome", notificationIcon.includes("#FFFFFFFF") && !notificationIcon.includes("#FF835C")],
  ["Android location stays foreground and approximate", androidManifest.includes('android:name="android.permission.ACCESS_COARSE_LOCATION" />') && androidManifest.includes('android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove"') && androidManifest.includes('android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove"') && Boolean(packageJson.dependencies?.["@capacitor/geolocation"])],
  ["Android JPush common service declared", androidManifest.includes(".ZhuguangJCommonService") && androidManifest.includes("cn.jiguang.user.service.action") && androidManifest.includes('android:process=":pushcore"')],
  ["Android JPush receiver action is correct", androidManifest.includes("cn.jpush.android.intent.RECEIVER_MESSAGE") && !androidManifest.includes("cn.jpush.android.intent.RECEIVE_MESSAGE")],
  ["Android JPush common service implementation", jpushService.includes("extends JCommonService")],
  ["Android push opens are persisted before activity launch", pushReceiver.includes("deliverPushOpen(context, deepLink)") && pushBridge.includes("PENDING_DEEP_LINK")],
  ["Android pending push deep links are consumed once", pushBridge.includes("consumePendingDeepLink") && pushBridge.includes("remove(PENDING_DEEP_LINK)")],
  ["iOS branded icon synced", iosSourceIcon === iosAppIcon],
  ["iOS display name localized", iosInfoPlist.includes("<string>逐光</string>")],
  ["iOS export compliance declared", iosInfoPlist.includes("ITSAppUsesNonExemptEncryption")],
  ["Codemagic unsigned iOS check present", codemagicWorkflow.includes("ios-simulator-check:") && codemagicWorkflow.includes("CODE_SIGNING_ALLOWED=NO")],
  ["Codemagic TestFlight workflow is manual", codemagicWorkflow.includes("ios-testflight:") && codemagicWorkflow.includes("submit_to_testflight: true") && codemagicWorkflow.includes("submit_to_app_store: false")],
  ["Native CI workflow present", packageJson.scripts?.["native:toolchain"] === "node scripts/check-native-toolchain.mjs"],
];

const failed = checks.filter(([, passed]) => !passed);

for (const [label, passed] of checks) {
  console.log(`${passed ? "OK" : "FAIL"} ${label}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
