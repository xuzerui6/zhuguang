import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const toolchains = path.join(root, ".toolchains");
const androidSdk = process.env.ANDROID_HOME || path.join(toolchains, "android-sdk");
const isWindows = process.platform === "win32";
const versionName = process.env.ZHUGUANG_ANDROID_VERSION_NAME?.trim() || "1.1.0";
const versionCode = Number.parseInt(process.env.ZHUGUANG_ANDROID_VERSION_CODE || "3", 10);
const apiBaseUrl = process.env.ZHUGUANG_API_BASE_URL?.trim() || process.env.VITE_API_BASE_URL?.trim() || "";
const pilotAppKey = process.env.ZHUGUANG_PILOT_APP_KEY?.trim() || process.env.VITE_PILOT_APP_KEY?.trim() || "";

const signingVariables = [
  "ZHUGUANG_ANDROID_KEYSTORE",
  "ZHUGUANG_ANDROID_KEY_ALIAS",
  "ZHUGUANG_ANDROID_STORE_PASSWORD",
  "ZHUGUANG_ANDROID_KEY_PASSWORD",
];
const missingSigningVariables = signingVariables.filter((name) => !process.env[name]?.trim());

if (missingSigningVariables.length) {
  throw new Error(
    `Release signing is required. Set ${missingSigningVariables.join(", ")} outside the repository before building.`,
  );
}

if (!Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error("ZHUGUANG_ANDROID_VERSION_CODE must be a positive integer.");
}

if (!existsSync(process.env.ZHUGUANG_ANDROID_KEYSTORE)) {
  throw new Error("ZHUGUANG_ANDROID_KEYSTORE does not point to an existing keystore.");
}

if (apiBaseUrl && !/^https:\/\//i.test(apiBaseUrl)) {
  throw new Error("The pilot API URL must use HTTPS. Omit it only for a bundled private QA build.");
}

function findFiles(directory, filename, depth = 8) {
  if (!existsSync(directory) || depth < 0) return [];

  const matches = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
      matches.push(candidate);
    }
    if (entry.isDirectory()) {
      matches.push(...findFiles(candidate, filename, depth - 1));
    }
  }
  return matches;
}

function getJavaMajor(executable) {
  const result = spawnSync(executable, ["-version"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const match = output.match(/version "(?:1\.)?(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

const configuredJava = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, "bin", isWindows ? "java.exe" : "java")
  : null;
const javaCandidates = [
  ...(configuredJava && existsSync(configuredJava) ? [configuredJava] : []),
  ...findFiles(toolchains, isWindows ? "java.exe" : "java"),
];
const javaExecutable = [...new Set(javaCandidates)].find(
  (candidate) => getJavaMajor(candidate) >= 21,
);

if (!javaExecutable) {
  throw new Error(
    "JDK 21 or newer was not found. Place a portable JDK under .toolchains or set JAVA_HOME for this command.",
  );
}

if (!existsSync(androidSdk)) {
  throw new Error(
    "Android SDK was not found. Place it under .toolchains/android-sdk or set ANDROID_HOME.",
  );
}

const javaHome = path.dirname(path.dirname(javaExecutable));
const buildEnvironment = {
  ...process.env,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  JAVA_HOME: javaHome,
  VITE_API_BASE_URL: apiBaseUrl,
  VITE_APP_VERSION: versionName,
  VITE_APP_VERSION_CODE: String(versionCode),
  VITE_PILOT_APP_KEY: pilotAppKey,
  Path: [
    path.join(javaHome, "bin"),
    path.join(androidSdk, "platform-tools"),
    process.env.Path || process.env.PATH || "",
  ].join(path.delimiter),
};

function run(label, command, args, options = {}) {
  console.log(`\n[android] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: buildEnvironment,
    shell: isWindows,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function runCapture(label, command, args) {
  console.log(`\n[android] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: buildEnvironment,
    shell: isWindows,
    windowsHide: true,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${output || `exit code ${result.status ?? "unknown"}`}`);
  }
  return output;
}

run("Build offline mobile web bundle", isWindows ? "npm.cmd" : "npm", [
  "run",
  "mobile:web:build",
]);
run("Sync Capacitor Android project", isWindows ? "npx.cmd" : "npx", [
  "cap",
  "sync",
  "android",
]);
run(
  "Assemble release-signed APK",
  path.join(root, "android", isWindows ? "gradlew.bat" : "gradlew"),
  ["assembleRelease"],
  { cwd: path.join(root, "android") },
);

const sourceApk = path.join(
  root,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk",
);

if (!existsSync(sourceApk)) {
  throw new Error(`Gradle completed but no release APK was found at ${sourceApk}`);
}

const apkSigner = findFiles(androidSdk, isWindows ? "apksigner.bat" : "apksigner")
  .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))[0];
if (!apkSigner) {
  throw new Error("Android apksigner was not found in the configured SDK build-tools.");
}

const verification = runCapture("Verify APK signature", apkSigner, [
  "verify",
  "--verbose",
  "--print-certs",
  sourceApk,
]);
const certificateMatch = verification.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f:]+)/i);
if (!certificateMatch) {
  throw new Error("APK signature verified, but the signing certificate SHA-256 fingerprint was not reported.");
}

const certificateSha256 = certificateMatch[1]
  .replace(/:/g, "")
  .toUpperCase()
  .match(/.{1,2}/g)
  .join(":");
const downloadsDirectory = path.join(root, "public", "downloads");
const apkFilename = `zhuguang-android-private-${versionName}.apk`;
const targetApk = path.join(downloadsDirectory, apkFilename);
mkdirSync(downloadsDirectory, { recursive: true });
copyFileSync(sourceApk, targetApk);

const apkBuffer = readFileSync(targetApk);
const metadata = {
  appChannelKeyConfigured: Boolean(pilotAppKey),
  apiMode: apiBaseUrl ? "pilot-api" : "bundled-private-qa",
  builtAt: new Date().toISOString(),
  certificateSha256,
  channel: "private-pilot",
  file: apkFilename,
  minAndroid: "7.0",
  packageId: "com.zhuguang.coachos",
  pushProvider: process.env.JPUSH_APP_KEY ? "jpush" : "jpush-unconfigured-simulated-only",
  sha256: createHash("sha256").update(apkBuffer).digest("hex"),
  signature: "release",
  sizeBytes: statSync(targetApk).size,
  versionCode,
  versionName,
};

writeFileSync(
  path.join(downloadsDirectory, "android-private-release.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
writeFileSync(
  path.join(downloadsDirectory, `android-private-release-${versionName}.json`),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(`\n[android] Private release APK ready: ${targetApk}`);
console.log(`[android] SHA-256: ${metadata.sha256}`);
console.log(`[android] Certificate SHA-256: ${metadata.certificateSha256}`);
