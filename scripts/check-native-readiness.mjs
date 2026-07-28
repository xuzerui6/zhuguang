import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const files = [
  "capacitor.config.ts",
  "native/mobile/www/index.html",
  "native/mobile/www/offline.html",
  "android/app/src/main/AndroidManifest.xml",
  "ios/App/App/Info.plist",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "native/desktop/www/index.html",
];

for (const file of files) {
  await access(join(root, file));
}

const [capacitorConfig, tauriConfigRaw, packageJsonRaw] = await Promise.all([
  readFile(join(root, "capacitor.config.ts"), "utf8"),
  readFile(join(root, "src-tauri/tauri.conf.json"), "utf8"),
  readFile(join(root, "package.json"), "utf8"),
]);

const tauriConfig = JSON.parse(tauriConfigRaw);
const packageJson = JSON.parse(packageJsonRaw);

const checks = [
  ["Capacitor app id", capacitorConfig.includes("com.zhuguang.coachos")],
  ["Capacitor mobile webDir", capacitorConfig.includes('webDir: "native/mobile/www"')],
  ["Capacitor iOS/Android installed", Boolean(packageJson.devDependencies?.["@capacitor/android"] && packageJson.devDependencies?.["@capacitor/ios"])],
  ["Tauri desktop identifier", tauriConfig.identifier === "com.zhuguang.coachos.desktop"],
  ["Tauri desktop frontend", tauriConfig.build?.frontendDist === "../native/desktop/www"],
  ["Tauri bundle enabled", tauriConfig.bundle?.active === true],
];

const failed = checks.filter(([, passed]) => !passed);

for (const [label, passed] of checks) {
  console.log(`${passed ? "OK" : "FAIL"} ${label}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
