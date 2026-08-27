import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageFile = path.join(repoRoot, "ios", "App", "CapApp-SPM", "Package.swift");
const source = readFileSync(packageFile, "utf8");
const normalized = source.replaceAll("\\", "/");

if (normalized !== source) writeFileSync(packageFile, normalized, "utf8");

if (normalized.includes("\\")) {
  throw new Error("iOS Swift Package still contains Windows-only dependency paths");
}

console.log("[ios] Swift Package dependency paths are macOS-compatible");
