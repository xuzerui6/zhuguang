import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const versionName = process.env.ZHUGUANG_IOS_VERSION_NAME?.trim() || "1.3.4";
const versionCode = process.env.ZHUGUANG_IOS_VERSION_CODE?.trim() || "19";
const environment = {
  ...process.env,
  VITE_API_BASE_URL: process.env.ZHUGUANG_API_BASE_URL?.trim() || "https://api.beijingzhuguang.top",
  VITE_APP_VERSION: versionName,
  VITE_APP_VERSION_CODE: versionCode,
};

if (!/^\d+\.\d+\.\d+$/.test(versionName) || !/^\d+$/.test(versionCode)) {
  throw new Error("iOS version must use semantic version and a positive integer build number");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: environment,
    shell: isWindows && command.toLowerCase().endsWith(".cmd"),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

run(isWindows ? "npm.cmd" : "npm", ["run", "mobile:web:build"]);
run(isWindows ? "npx.cmd" : "npx", ["cap", "sync", "ios"]);
run(process.execPath, [path.join(repoRoot, "scripts", "normalize-capacitor-ios-spm.mjs")]);

const projectFile = path.join(repoRoot, "ios", "App", "App.xcodeproj", "project.pbxproj");
const project = readFileSync(projectFile, "utf8")
  .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`)
  .replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${versionName};`);
writeFileSync(projectFile, project, "utf8");

console.log(`[ios] Synced source version ${versionName} (${versionCode})`);
