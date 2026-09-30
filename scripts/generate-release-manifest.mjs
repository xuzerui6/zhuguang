import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputPath = path.join(root, "outputs", "release-manifest.json");

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 10_000 }).trim();
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function migrationManifest() {
  const directory = path.join(root, "drizzle");
  const names = (await readdir(directory)).filter((name) => /^\d{4}_.+\.sql$/u.test(name)).sort();
  return Promise.all(names.map(async (name) => ({ name, sha256: await sha256(path.join(directory, name)) })));
}

async function apkManifest() {
  const apkPath = process.env.ZHUGUANG_APK_PATH?.trim();
  if (!apkPath) return null;
  const absolutePath = path.resolve(root, apkPath);
  const info = await stat(absolutePath);
  return {
    fileName: path.basename(absolutePath),
    packageName: process.env.ZHUGUANG_ANDROID_PACKAGE || "com.zhuguang.coachos",
    sha256: await sha256(absolutePath),
    sizeBytes: info.size,
    versionCode: Number(process.env.ZHUGUANG_ANDROID_VERSION_CODE || 0) || null,
    versionName: process.env.ZHUGUANG_ANDROID_VERSION_NAME || null,
  };
}

const featureFlags = Object.fromEntries([
  "BEIJING_CATALOG_V2_ENABLED",
  "FULFILLMENT_V2_ENABLED",
  "ONLINE_TRANSACTION_ENABLED",
  "PUBLIC_TRUST_METRICS_ENABLED",
  "SUPPORT_EVIDENCE_ENABLED",
].map((name) => [name, process.env[name] === "true"]));

const manifest = {
  generatedAt: new Date().toISOString(),
  git: {
    branch: git("branch", "--show-current"),
    commit: git("rev-parse", "HEAD"),
    dirty: Boolean(git("status", "--porcelain")),
  },
  workers: {
    apiVersion: process.env.ZHUGUANG_API_WORKER_VERSION || null,
    webVersion: process.env.ZHUGUANG_WEB_WORKER_VERSION || null,
  },
  migrations: await migrationManifest(),
  featureFlags,
  android: await apkManifest(),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Release manifest written to ${outputPath}\n`);
