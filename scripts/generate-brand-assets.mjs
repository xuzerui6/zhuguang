import { mkdir, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = path.join(root, "public");
const nativeAssetsDir = path.join(root, "native", "assets");
const tauriIconsDir = path.join(root, "src-tauri", "icons");

const colors = {
  background: "#06130F",
  coral: "#FF835C",
  ivory: "#ECFFF2",
};

const markPath = "M31 72H77L31 36H76";

function markElements({ monochrome = false } = {}) {
  const stroke = monochrome ? "#000000" : colors.ivory;
  const dot = monochrome ? "#000000" : colors.coral;
  return [
    `<path d="${markPath}" fill="none" stroke="${stroke}" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="76" cy="36" r="6" fill="${dot}"/>`,
  ].join("");
}

function svgDocument(body, width = 108, height = 108) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function fullIconSvg({ round = false, rounded = false } = {}) {
  const background = round
    ? `<circle cx="54" cy="54" r="54" fill="${colors.background}"/>`
    : rounded
      ? `<rect x="1" y="1" width="106" height="106" rx="23" fill="${colors.background}"/>`
      : `<rect width="108" height="108" fill="${colors.background}"/>`;
  return svgDocument(`${background}${markElements()}`);
}

function foregroundSvg(monochrome = false) {
  return svgDocument(markElements({ monochrome }));
}

function backgroundSvg() {
  return svgDocument(`<rect width="108" height="108" fill="${colors.background}"/>`);
}

function webMarkSvg() {
  return `<svg width="80" height="80" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="106" height="106" rx="23" fill="${colors.background}"/>${markElements()}</svg>\n`;
}

function lockupSvg() {
  return `<svg width="360" height="80" viewBox="0 0 486 108" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="106" height="106" rx="23" fill="${colors.background}"/>${markElements()}<text x="137" y="52" fill="${colors.background}" font-family="PingFang SC, Microsoft YaHei, Noto Sans SC, Arial, sans-serif" font-size="40" font-weight="800" letter-spacing="0">逐光</text><text x="137" y="81" fill="#65746B" font-family="PingFang SC, Microsoft YaHei, Noto Sans SC, Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="0">运动教练服务平台</text></svg>\n`;
}

async function render(svg, output, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(output);
}

function run(label, executable, args, { shell = false } = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    shell,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
}

await mkdir(nativeAssetsDir, { recursive: true });

await writeFile(path.join(publicDir, "app-icon.svg"), `${fullIconSvg()}\n`);
await writeFile(path.join(publicDir, "favicon.svg"), webMarkSvg());
await writeFile(path.join(publicDir, "logo-mark.svg"), webMarkSvg());
await writeFile(path.join(publicDir, "logo-lockup.svg"), lockupSvg());

const masterPath = path.join(nativeAssetsDir, "app-icon-master-1024.png");
const androidBackgroundPath = path.join(nativeAssetsDir, "android-icon-background-1024.png");
const androidForegroundPath = path.join(nativeAssetsDir, "android-icon-foreground-1024.png");
const androidMonochromePath = path.join(nativeAssetsDir, "android-icon-monochrome-1024.png");

await render(fullIconSvg(), masterPath, 1024);
await render(backgroundSvg(), androidBackgroundPath, 1024);
await render(foregroundSvg(), androidForegroundPath, 1024);
await render(foregroundSvg(true), androidMonochromePath, 1024);
await render(fullIconSvg(), path.join(nativeAssetsDir, "ios-app-icon-1024.png"), 1024);
await render(fullIconSvg({ rounded: true }), path.join(nativeAssetsDir, "splash-complete-1024.png"), 1024);
await render(fullIconSvg(), path.join(publicDir, "app-icon-512.png"), 512);
await render(fullIconSvg(), path.join(publicDir, "app-icon-192.png"), 192);

const manifestPath = path.join(nativeAssetsDir, "icon-manifest.json");
await writeFile(manifestPath, `${JSON.stringify({
  default: "app-icon-master-1024.png",
  bg_color: colors.background,
  android_bg: "android-icon-background-1024.png",
  android_fg: "android-icon-foreground-1024.png",
  android_fg_scale: 100,
  android_monochrome: "android-icon-monochrome-1024.png",
}, null, 2)}\n`);

const tauriCli = path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
run("Generate platform icon sets", process.execPath, [tauriCli, "icon", manifestPath, "--output", tauriIconsDir]);

const androidDensities = {
  mdpi: { adaptive: 108, legacy: 48 },
  hdpi: { adaptive: 162, legacy: 72 },
  xhdpi: { adaptive: 216, legacy: 96 },
  xxhdpi: { adaptive: 324, legacy: 144 },
  xxxhdpi: { adaptive: 432, legacy: 192 },
};
for (const [density, sizes] of Object.entries(androidDensities)) {
  const directory = path.join(tauriIconsDir, "android", `mipmap-${density}`);
  await mkdir(directory, { recursive: true });
  await render(fullIconSvg({ rounded: true }), path.join(directory, "ic_launcher.png"), sizes.legacy);
  await render(fullIconSvg({ round: true }), path.join(directory, "ic_launcher_round.png"), sizes.legacy);
  await render(foregroundSvg(), path.join(directory, "ic_launcher_foreground.png"), sizes.adaptive);
  await render(backgroundSvg(), path.join(directory, "ic_launcher_background.png"), sizes.adaptive);
  await render(foregroundSvg(true), path.join(directory, "ic_launcher_monochrome.png"), sizes.adaptive);
}
run("Sync native icon sets", process.execPath, [path.join(root, "scripts", "sync-native-icons.mjs")]);

const adaptiveIconV26 = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
const adaptiveIconV33 = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
for (const resourceRoot of [
  path.join(tauriIconsDir, "android"),
  path.join(root, "android", "app", "src", "main", "res"),
]) {
  const v26 = path.join(resourceRoot, "mipmap-anydpi-v26");
  const v33 = path.join(resourceRoot, "mipmap-anydpi-v33");
  await mkdir(v26, { recursive: true });
  await mkdir(v33, { recursive: true });
  await Promise.all([
    writeFile(path.join(v26, "ic_launcher.xml"), adaptiveIconV26),
    writeFile(path.join(v26, "ic_launcher_round.xml"), adaptiveIconV26),
    writeFile(path.join(v33, "ic_launcher.xml"), adaptiveIconV33),
    writeFile(path.join(v33, "ic_launcher_round.xml"), adaptiveIconV33),
  ]);
}

const androidResDir = path.join(root, "android", "app", "src", "main", "res");
const resourceDirectories = await readdir(androidResDir, { withFileTypes: true });
for (const directory of resourceDirectories) {
  if (!directory.isDirectory() || !/^drawable(?:-(?:port|land)-(?:mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi))?$/u.test(directory.name)) continue;
  const splashPath = path.join(androidResDir, directory.name, "splash.png");
  let metadata;
  try {
    metadata = await sharp(splashPath).metadata();
  } catch {
    continue;
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) continue;
  const logoSize = Math.round(Math.min(width, height) * 0.3);
  const logo = await sharp(Buffer.from(fullIconSvg({ rounded: true }))).resize(logoSize, logoSize).png().toBuffer();
  const splash = await sharp({ create: { width, height, channels: 4, background: "#FFFFFF" } })
    .composite([{ input: logo, left: Math.round((width - logoSize) / 2), top: Math.round((height - logoSize) / 2) }])
    .png()
    .toBuffer();
  await writeFile(splashPath, splash);
}

const foreground = await sharp(androidForegroundPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { data, info } = foreground;
let minX = info.width;
let minY = info.height;
let maxX = -1;
let maxY = -1;
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}

const safeMin = Math.floor(info.width * 18 / 108);
const safeMax = Math.ceil(info.width * 90 / 108);
if (minX < safeMin || minY < safeMin || maxX > safeMax || maxY > safeMax) {
  throw new Error(`Adaptive foreground exceeds the protected canvas: ${minX},${minY} to ${maxX},${maxY}`);
}

console.log(`Brand assets generated. Adaptive foreground bounds: ${minX},${minY} to ${maxX},${maxY}.`);
