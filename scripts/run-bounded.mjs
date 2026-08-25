import { spawn, spawnSync } from "node:child_process";

const [timeoutText, command, ...args] = process.argv.slice(2);
const timeoutMs = Number(timeoutText);

if (!command || !Number.isFinite(timeoutMs) || timeoutMs < 1) {
  console.error("Usage: node scripts/run-bounded.mjs <timeout-ms> <command> [...args]");
  process.exit(2);
}

const isWindowsScript = process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(command);
const executable = isWindowsScript ? (process.env.ComSpec || "cmd.exe") : command;
const executableArgs = isWindowsScript ? ["/d", "/s", "/c", command, ...args] : args;

const child = spawn(executable, executableArgs, {
  env: process.env,
  shell: false,
  stdio: "inherit",
  windowsHide: true,
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`Command exceeded ${timeoutMs}ms: ${command} ${args.join(" ")}`);
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}, timeoutMs);

child.once("error", (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  clearTimeout(timer);
  if (timedOut) process.exit(124);
  if (signal) {
    console.error(`Command terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
