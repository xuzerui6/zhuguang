import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "wrangler.web.jsonc");
const outputPath = resolve(root, "dist", "server", "wrangler.web.json");
const entryPath = resolve(root, "dist", "server", "web-entry.js");
const serverBundlePath = resolve(root, "dist", "server", "index.js");
const config = JSON.parse(await readFile(sourcePath, "utf8"));

config.main = "web-entry.js";
config.assets = { ...config.assets, directory: "../client" };
config.rules = [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }];

const deploymentExcludedAssets = [];

if (config.vars?.PRODUCT_FILM_ENABLED !== "true") {
  deploymentExcludedAssets.push(
    "media/zhuguang-product-film.mp4",
    "media/zhuguang-product-film.webm",
    "media/zhuguang-product-film.vtt",
    "media/zhuguang-product-film-poster.avif",
    "media/zhuguang-product-film-poster.webp",
  );
}

const archivedLegacyAssets = ["coach-visual.png", "images/hero-coaching.png"];
deploymentExcludedAssets.push(...archivedLegacyAssets);
await Promise.all(deploymentExcludedAssets.map((name) => rm(resolve(root, "dist", "client", name), { force: true })));

const excludedManifestEntries = new Set(deploymentExcludedAssets.map((name) => JSON.stringify(`/${name}`)));
const serverBundle = (await readFile(serverBundlePath, "utf8"))
  .split(/\r?\n/)
  .filter((line) => ![...excludedManifestEntries].some((entry) => line.includes(entry)))
  .join("\n");
await writeFile(serverBundlePath, `${serverBundle}\n`, "utf8");

await writeFile(entryPath, `import handler from "./index.js";

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === "www.beijingzhuguang.top") {
      url.hostname = "beijingzhuguang.top";
      return Response.redirect(url, 301);
    }
    return handler.fetch(request, env, ctx);
  },
};
`, "utf8");
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Prepared ${outputPath}`);
