import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the premium coach platform shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>逐光 Coach OS<\/title>/);
  assert.match(html, /PC 工作台/);
  assert.match(html, /浏览器介绍/);
  assert.match(html, /手机端/);
  assert.match(html, /应用版本/);
  assert.match(html, /教练端/);
  assert.match(html, /运营端/);
  assert.match(html, /iOS、Android、Windows、Linux、macOS/);
  assert.match(html, /教练服务中台/);
  assert.match(html, /推荐队列/);
  assert.match(html, /服务健康度/);
  assert.match(html, /服务队列/);
  assert.match(html, /平台经营判断/);
  assert.match(html, /学员匹配工作台/);
  assert.match(html, /教练信任档案/);
  assert.match(html, /自动入口/);
  assert.match(html, /已在推荐入口/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("keeps the full product UI surfaces wired", async () => {
  const [
    page,
    layout,
    css,
    packageJson,
    manifest,
    sw,
    offline,
    capacitorConfig,
    tauriConfig,
    mobileShell,
    desktopShell,
    workflow,
    nativeDocs,
    iconSync,
    toolchainCheck,
    appIcon,
    favicon,
    logoMark,
    logoLockup,
  ] =
    await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/manifest.webmanifest", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("public/offline.html", root), "utf8"),
    readFile(new URL("capacitor.config.ts", root), "utf8"),
    readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"),
    readFile(new URL("native/mobile/www/index.html", root), "utf8"),
    readFile(new URL("native/desktop/www/index.html", root), "utf8"),
    readFile(new URL(".github/workflows/native-builds.yml", root), "utf8"),
    readFile(new URL("docs/native-apps.md", root), "utf8"),
    readFile(new URL("scripts/sync-native-icons.mjs", root), "utf8"),
    readFile(new URL("scripts/check-native-toolchain.mjs", root), "utf8"),
    readFile(new URL("public/app-icon.svg", root), "utf8"),
    readFile(new URL("public/favicon.svg", root), "utf8"),
    readFile(new URL("public/logo-mark.svg", root), "utf8"),
    readFile(new URL("public/logo-lockup.svg", root), "utf8"),
  ]);

  assert.match(page, /type Surface = "command" \| "web" \| "mobile" \| "apps" \| "coach" \| "ops"/);
  assert.match(page, /type DeviceClass = "phone" \| "tablet" \| "desktop"/);
  assert.match(page, /detectDeviceProfile/);
  assert.match(page, /compactSurfaceIds/);
  assert.match(page, /source === "native-mobile"/);
  assert.match(page, /source === "native-desktop"/);
  assert.match(page, /chooseSurface/);
  assert.match(page, /selectedFit/);
  assert.match(page, /savedCoachIds/);
  assert.match(page, /phone-frame/);
  assert.match(page, /appEditions/);
  assert.match(page, /nativeTargets/);
  assert.match(page, /releasePipelines/);
  assert.match(page, /五端原生交付矩阵/);
  assert.match(page, /构建流水线和本机诊断/);
  assert.match(page, /Capacitor/);
  assert.match(page, /Tauri/);
  assert.match(page, /handleInstallApp/);
  assert.match(page, /coachPackages/);
  assert.match(page, /auditQueue/);
  assert.match(page, /workQueue/);
  assert.match(page, /decisionSignals/);
  assert.match(page, /commandSegments/);
  assert.match(page, /persistent-dock/);
  assert.match(page, /smart-handoff/);
  assert.match(page, /logo-mark\.svg/);
  assert.match(layout, /metadataBase: new URL/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /全平台服务系统/);
  assert.match(css, /app-grid/);
  assert.match(css, /smart-handoff/);
  assert.match(css, /route-pill/);
  assert.match(css, /target-grid/);
  assert.match(css, /pipeline-row/);
  assert.match(css, /@keyframes surfaceIn/);
  assert.match(css, /@keyframes tileIn/);
  assert.match(css, /@keyframes growBar/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /\/app-icon-512\.png/);
  assert.match(sw, /CACHE_NAME = "zhuguang-coach-os-v1"/);
  assert.match(sw, /offline\.html/);
  assert.match(offline, /逐光 Coach OS 离线/);
  assert.match(capacitorConfig, /com\.zhuguang\.coachos/);
  assert.match(capacitorConfig, /native\/mobile\/www/);
  assert.match(tauriConfig, /com\.zhuguang\.coachos\.desktop/);
  assert.match(tauriConfig, /native\/desktop\/www/);
  assert.match(mobileShell, /iOS \/ Android 原生应用启动壳/);
  assert.match(desktopShell, /Windows \/ Linux \/ macOS/);
  assert.match(workflow, /android-debug/);
  assert.match(workflow, /ios-simulator/);
  assert.match(workflow, /desktop/);
  assert.match(nativeDocs, /native:toolchain/);
  assert.match(nativeDocs, /native-builds\.yml/);
  assert.match(iconSync, /ios-app-icon-1024\.png/);
  assert.match(toolchainCheck, /BLOCKED/);
  assert.match(appIcon, /#06130F/);
  assert.match(appIcon, /#FF835C/);
  assert.match(favicon, /#BFF3D2/);
  assert.match(logoMark, /viewBox="0 0 80 80"/);
  assert.match(logoLockup, /COACH OS/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
