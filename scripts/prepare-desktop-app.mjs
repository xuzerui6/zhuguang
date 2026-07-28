import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "native/desktop/www/index.html",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/src/main.rs",
];

for (const file of requiredFiles) {
  await access(join(root, file));
}

const config = JSON.parse(await readFile(join(root, "src-tauri/tauri.conf.json"), "utf8"));

if (config.identifier !== "com.zhuguang.coachos.desktop") {
  throw new Error("Unexpected Tauri identifier");
}

if (config.build?.frontendDist !== "../native/desktop/www") {
  throw new Error("Unexpected Tauri frontendDist");
}

console.log("Desktop native shell is ready.");
