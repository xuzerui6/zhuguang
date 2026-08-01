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
  "ios/App/App/Info.plist",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "native/desktop/www/index.html",
  "native/assets/ios-app-icon-1024.png",
  ".github/workflows/native-builds.yml",
];

for (const file of files) {
  await access(join(root, file));
}

const [capacitorConfig, nativeMobileEntry, tauriConfigRaw, packageJsonRaw] = await Promise.all([
  readFile(join(root, "capacitor.config.ts"), "utf8"),
  readFile(join(root, "native/mobile/src/main.tsx"), "utf8"),
  readFile(join(root, "src-tauri/tauri.conf.json"), "utf8"),
  readFile(join(root, "package.json"), "utf8"),
]);

async function digest(file) {
  const body = await readFile(join(root, file));
  return createHash("sha256").update(body).digest("hex");
}

const [androidSourceIcon, androidAppIcon, iosSourceIcon, iosAppIcon] = await Promise.all([
  digest("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png"),
  digest("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"),
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
  ["Native mobile offline build", packageJson.scripts?.["mobile:web:build"] === "vite build --config native/mobile/vite.config.ts"],
  ["Android APK build command", packageJson.scripts?.["mobile:android:apk"] === "node scripts/build-android-apk.mjs"],
  ["Tauri desktop identifier", tauriConfig.identifier === "com.zhuguang.coachos.desktop"],
  ["Tauri desktop frontend", tauriConfig.build?.frontendDist === "../native/desktop/www"],
  ["Tauri bundle enabled", tauriConfig.bundle?.active === true],
  ["Android branded icon synced", androidSourceIcon === androidAppIcon],
  ["iOS branded icon synced", iosSourceIcon === iosAppIcon],
  ["Native CI workflow present", packageJson.scripts?.["native:toolchain"] === "node scripts/check-native-toolchain.mjs"],
];

const failed = checks.filter(([, passed]) => !passed);

for (const [label, passed] of checks) {
  console.log(`${passed ? "OK" : "FAIL"} ${label}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
