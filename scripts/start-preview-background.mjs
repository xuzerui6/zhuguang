import { closeSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("./local-preview-server.mjs", import.meta.url));
const stdout = openSync("preview.out.log", "a");
const stderr = openSync("preview.err.log", "a");

const child = spawn(process.execPath, [server], {
  detached: true,
  env: process.env,
  stdio: ["ignore", stdout, stderr],
});

child.unref();
closeSync(stdout);
closeSync(stderr);
console.log(child.pid);
