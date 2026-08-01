import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the public introduction before authenticated workspaces", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>逐光 Coach OS<\/title>/);
  assert.match(html, /找到适合你的专业教练/);
  assert.match(html, /登录进入工作台/);
  assert.match(html, /教练资质核验/);
  assert.match(html, /学员智能匹配/);
  assert.match(html, /全流程履约保障/);
  assert.match(html, /Android 私有试点版/);
  assert.match(html, /zhuguang-android-private-1\.1\.1\.apk/);
  assert.match(html, /了解教练合作/);
  assert.doesNotMatch(html, /教练注册入驻/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("keeps the mobile MVP, API and coach workspace wired", async () => {
  const [
    page,
    mobileApp,
    components,
    sheets,
    profile,
    domain,
    device,
    apiClient,
    mobileCss,
    router,
    repository,
    sms,
    schema,
    coachWorkspace,
    packageJson,
    capacitorConfig,
    androidBuild,
    androidGradle,
    workflow,
    nativeDocs,
    designDocs,
    previewServer,
  ] = await Promise.all([
    read("app/page.tsx"),
    read("app/mobile/app.tsx"),
    read("app/mobile/components.tsx"),
    read("app/mobile/sheets.tsx"),
    read("app/mobile/views/profile-view.tsx"),
    read("app/mobile/domain.ts"),
    read("app/mobile/device.ts"),
    read("app/mobile/api-client.ts"),
    read("app/mobile/mobile.css"),
    read("server/api/router.ts"),
    read("server/api/repository.ts"),
    read("server/api/sms.ts"),
    read("db/schema.ts"),
    read("app/coach-workspace/workspace-client.tsx"),
    read("package.json"),
    read("capacitor.config.ts"),
    read("scripts/build-android-apk.mjs"),
    read("android/app/build.gradle"),
    read(".github/workflows/native-builds.yml"),
    read("docs/native-apps.md"),
    read("docs/design/mobile-mvp-design-system.md"),
    read("scripts/local-preview-server.mjs"),
  ]);

  assert.match(page, /detectDeviceProfile/);
  assert.match(page, /shouldUseStudentMobileApp/);
  assert.match(page, /zhuguang-android-private-1\.1\.1\.apk/);
  assert.match(mobileApp, /type SheetName/);
  assert.match(mobileApp, /<BottomNav/);
  assert.match(mobileApp, /SupportSheet/);
  assert.match(components, /aria-label="手机端主导航"/);
  assert.match(components, /getMatchResult/);
  assert.match(components, /onProfile/);
  assert.match(sheets, /教练确认后生效/);
  assert.match(sheets, /帮助与反馈/);
  assert.match(sheets, /申请注销账号/);
  assert.match(profile, /已验证用户/);
  assert.doesNotMatch(profile, /徐泽瑞|最近上课：本周二|反手高远球稳定性提升/);
  assert.match(domain, /score \+= 30/);
  assert.match(domain, /score \+= 25/);
  assert.match(domain, /score \+= 15/);
  assert.match(domain, /score \+= 5/);
  assert.match(device, /SecureStorage/);
  assert.match(device, /Preferences/);
  assert.match(device, /Network/);
  assert.match(apiClient, /VITE_API_BASE_URL/);
  assert.match(apiClient, /x-zhuguang-app-key/);
  assert.match(mobileCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(mobileCss, /min-height:\s*44px/);

  assert.match(router, /\/api\/v1/);
  assert.match(router, /pending_coach/);
  assert.match(router, /coach\/overview/);
  assert.match(repository, /reschedule_requested/);
  assert.match(repository, /cancelled_by_student/);
  assert.match(repository, /idempotency/i);
  assert.match(sms, /tencentcloud-sdk-nodejs-sms/);
  assert.match(sms, /v20210111/);
  for (const table of ["users", "learner_profiles", "coaches", "coach_credentials", "availability_slots", "favorites", "booking_requests", "booking_events", "conversations", "messages", "notifications", "auth_challenges", "sessions"]) {
    assert.match(schema, new RegExp(`\\b${table}\\b`));
  }
  assert.match(coachWorkspace, /待确认预约/);
  assert.match(coachWorkspace, /线下收款/);

  assert.match(packageJson, /mobile:android:release/);
  assert.match(capacitorConfig, /com\.zhuguang\.coachos/);
  assert.match(androidBuild, /assembleRelease/);
  assert.match(androidBuild, /apksigner/);
  assert.match(androidBuild, /signature:\s*"release"/);
  assert.doesNotMatch(androidBuild, /assembleDebug|signature:\s*"debug"/);
  assert.match(androidGradle, /ZHUGUANG_ANDROID_KEYSTORE/);
  assert.match(androidGradle, /signingConfig signingConfigs\.release/);
  assert.match(workflow, /android-private-release/);
  assert.match(workflow, /ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.doesNotMatch(workflow, /name:\s*android-debug-apk/);
  assert.match(nativeDocs, /android-private-release\.json/);
  assert.match(designDocs, /AW1eZlwYWJTs34Iql1c32O/);
  assert.match(designDocs, /160ms/);
  assert.match(previewServer, /Local preview ready/);
  assert.match(previewServer, /native-mobile-preview/);
});

test("ships a verified private Android release artifact", async () => {
  const metadata = JSON.parse(await read("public/downloads/android-private-release.json"));
  const apk = await readFile(new URL(`public/downloads/${metadata.file}`, root));
  const sha256 = createHash("sha256").update(apk).digest("hex");

  assert.equal(metadata.file, "zhuguang-android-private-1.1.1.apk");
  assert.equal(metadata.packageId, "com.zhuguang.coachos");
  assert.equal(metadata.versionName, "1.1.1");
  assert.equal(metadata.versionCode, 4);
  assert.equal(metadata.minAndroid, "7.0");
  assert.equal(metadata.channel, "private-pilot");
  assert.equal(metadata.signature, "release");
  assert.equal(metadata.apiMode, "bundled-private-qa");
  assert.equal(metadata.pushProvider, "jpush-unconfigured-simulated-only");
  assert.equal(metadata.appChannelKeyConfigured, true);
  assert.match(metadata.certificateSha256, /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  assert.equal(metadata.sizeBytes, apk.byteLength);
  assert.equal(metadata.sha256, sha256);
  assert.ok(apk.byteLength > 1_000_000);
  assert.ok(apk.byteLength < 15_000_000);
});
