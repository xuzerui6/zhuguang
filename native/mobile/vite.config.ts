import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const mobileRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(mobileRoot, "../..");
const mobileOutput = path.join(mobileRoot, "www");
const nativeAssets = [
  "logo-mark.svg",
  "mobile-coach-hero-v23.webp",
  "mobile-coach-portraits-v23.webp",
];

export default defineConfig({
  base: "./",
  build: {
    assetsDir: "assets",
    emptyOutDir: true,
    outDir: mobileOutput,
    target: "es2020",
  },
  plugins: [
    react(),
    {
      closeBundle() {
        mkdirSync(mobileOutput, { recursive: true });
        for (const filename of nativeAssets) {
          copyFileSync(
            path.join(repoRoot, "public", filename),
            path.join(mobileOutput, filename),
          );
        }
      },
      name: "copy-native-mobile-assets",
    },
  ],
  publicDir: false,
  resolve: {
    alias: {
      "next/image": path.join(mobileRoot, "src/next-image-shim.tsx"),
    },
  },
  root: mobileRoot,
});
