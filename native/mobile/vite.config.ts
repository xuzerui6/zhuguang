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
  "images/coach-zhouming.webp",
  "images/coach-linyue.webp",
  "images/coach-zhaolei.webp",
  "images/coach-chenwei.webp",
  "images/coach-xu-zerui-avatar.webp",
  "images/coach-xu-zerui-portrait.webp",
  "images/coach-xu-zerui-portrait.avif",
  "images/coach-xu-zerui-hero.webp",
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
          const destination = path.join(mobileOutput, filename);
          mkdirSync(path.dirname(destination), { recursive: true });
          copyFileSync(
            path.join(repoRoot, "public", filename),
            destination,
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
