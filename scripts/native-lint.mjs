import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const javaRoot = path.join(root, ".toolchains", "jdk-21");
const javaHome = process.env.JAVA_HOME || (existsSync(javaRoot) ? readdirSync(javaRoot).map((name) => path.join(javaRoot, name)).find((name) => existsSync(path.join(name, "bin", "java.exe"))) : undefined);
if (!javaHome) throw new Error("Set JAVA_HOME to JDK 21 before native:lint.");
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: process.env.ANDROID_HOME || path.join(root, ".toolchains", "android-sdk") };
for (const key of ["KEYSTORE", "KEY_ALIAS", "STORE_PASSWORD", "KEY_PASSWORD"]) delete env[`ZHUGUANG_ANDROID_${key}`];
const windows = process.platform === "win32";
const result = spawnSync(windows ? (process.env.ComSpec || "cmd.exe") : "./gradlew", windows ? ["/d", "/s", "/c", "gradlew.bat", ":app:lintDebug", ":app:lintRelease", "--no-daemon", "--console=plain"] : [":app:lintDebug", ":app:lintRelease", "--no-daemon", "--console=plain"], { cwd: path.join(root, "android"), env, stdio: "inherit", windowsHide: true, timeout: 540000 });
if (result.error) console.error(`Native lint did not finish: ${result.error.code || "process error"}`);
process.exit(result.status ?? 1);
