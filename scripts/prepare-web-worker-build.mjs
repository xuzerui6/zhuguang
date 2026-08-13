import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "wrangler.web.jsonc");
const outputPath = resolve(root, "dist", "server", "wrangler.web.json");
const config = JSON.parse(await readFile(sourcePath, "utf8"));

config.main = "index.js";
config.assets = { ...config.assets, directory: "../client" };
config.rules = [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }];

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Prepared ${outputPath}`);
