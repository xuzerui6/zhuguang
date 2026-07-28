import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const root = process.cwd();
const androidSource = join(root, "src-tauri", "icons", "android");
const androidTarget = join(root, "android", "app", "src", "main", "res");
const iosTarget = join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset");
const iosMarketingIcon = join(root, "native", "assets", "ios-app-icon-1024.png");

async function copyTree(sourceRoot, targetRoot) {
  const entries = await readdir(sourceRoot, { withFileTypes: true });

  for (const entry of entries) {
    const source = join(sourceRoot, entry.name);
    const target = join(targetRoot, relative(sourceRoot, source));

    if (entry.isDirectory()) {
      await copyTree(source, join(targetRoot, entry.name));
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

await copyTree(androidSource, androidTarget);

const iosExistingEntries = await readdir(iosTarget, { withFileTypes: true });
for (const entry of iosExistingEntries) {
  if (entry.isFile() && entry.name.startsWith("AppIcon-") && entry.name !== "AppIcon-512@2x.png") {
    await rm(join(iosTarget, entry.name));
  }
}
await copyFile(iosMarketingIcon, join(iosTarget, "AppIcon-512@2x.png"));

const contentsPath = join(iosTarget, "Contents.json");
const contents = JSON.parse(await readFile(contentsPath, "utf8"));
contents.images = [
  {
    filename: "AppIcon-512@2x.png",
    idiom: "universal",
    platform: "ios",
    size: "1024x1024",
  },
];
await writeFile(contentsPath, `${JSON.stringify(contents, null, 2)}\n`);

console.log("Native mobile icons synced from src-tauri/icons.");
