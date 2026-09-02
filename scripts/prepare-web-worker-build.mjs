import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "wrangler.web.jsonc");
const outputPath = resolve(root, "dist", "server", "wrangler.web.json");
const entryPath = resolve(root, "dist", "server", "web-entry.js");
const config = JSON.parse(await readFile(sourcePath, "utf8"));

config.main = "web-entry.js";
config.assets = { ...config.assets, directory: "../client" };
config.rules = [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }];

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
