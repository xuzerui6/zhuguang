import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmBin = isWindows ? "npm.cmd" : "npm";
const npxBin = isWindows ? "npx.cmd" : "npx";
const strict = process.argv.includes("--strict");

function run(label, command, args = []) {
  const commandLine = [command, ...args].join(" ");
  const result = spawnSync(commandLine, {
    encoding: "utf8",
    shell: true,
    timeout: 12000,
  });

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);

  return {
    label,
    ok: result.status === 0,
    command: commandLine,
    detail: output?.trim() ?? result.error?.message ?? "not available",
  };
}

const checks = [
  run("Node.js", "node", ["--version"]),
  run("npm", npmBin, ["--version"]),
  run("Capacitor CLI", npxBin, ["cap", "--version"]),
  run("Tauri CLI", npxBin, ["tauri", "--version"]),
  run("Java / JDK", "java", ["-version"]),
  run("Android Debug Bridge", "adb", ["version"]),
  run("Rust compiler", "rustc", ["--version"]),
  run("Cargo", "cargo", ["--version"]),
  run("Xcode build", "xcodebuild", ["-version"]),
];

const platformNeeds = [
  ["iOS", ["Node.js", "npm", "Capacitor CLI", "Xcode build"]],
  ["Android", ["Node.js", "npm", "Capacitor CLI", "Java / JDK", "Android Debug Bridge"]],
  ["Windows", ["Node.js", "npm", "Tauri CLI", "Rust compiler", "Cargo"]],
  ["Linux", ["Node.js", "npm", "Tauri CLI", "Rust compiler", "Cargo"]],
  ["macOS", ["Node.js", "npm", "Tauri CLI", "Rust compiler", "Cargo", "Xcode build"]],
];

const status = new Map(checks.map((check) => [check.label, check.ok]));

for (const check of checks) {
  console.log(`${check.ok ? "OK  " : "MISS"} ${check.label}: ${check.detail}`);
}

console.log("");

let blocked = false;
for (const [platform, labels] of platformNeeds) {
  const missing = labels.filter((label) => !status.get(label));
  if (missing.length > 0) {
    blocked = true;
    console.log(`BLOCKED ${platform}: missing ${missing.join(", ")}`);
  } else {
    console.log(`READY   ${platform}`);
  }
}

if (strict && blocked) {
  process.exitCode = 1;
}
