import { closeSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./run-vinext.mjs", import.meta.url));
const stdout = openSync("dev.out.log", "a");
const stderr = openSync("dev.err.log", "a");

const child = spawn(process.execPath, [runner, "dev"], {
  detached: true,
  stdio: ["ignore", stdout, stderr],
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
  },
});

child.unref();
closeSync(stdout);
closeSync(stderr);
console.log(child.pid);
