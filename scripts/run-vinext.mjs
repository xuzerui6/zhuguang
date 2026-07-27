import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2] ?? "dev";
const cli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));

const child = spawn(process.execPath, [cli, command], {
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
  },
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 0);
});
