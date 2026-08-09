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
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${encodeURIComponent(path)}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders a service-first homepage without prototype claims", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>逐光 \| 专业运动教练服务平台<\/title>/);
  assert.match(html, /专业运动教练/);
  assert.match(html, /查找教练/);
  assert.match(html, /身份与履历人工核验/);
  assert.match(html, /教练确认后生效/);
  assert.match(html, /值得认真了解的教练/);
  assert.match(html, /了解合作方式/);
  assert.doesNotMatch(html, /Coach OS|28,000\+|320,000\+|注册教练|Android 私有试点版/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("all public and workspace routes support direct rendering", async () => {
  const routes = [
    ["/coaches", "找适合你的教练"],
    ["/coaches/1", "认证与资质"],
    ["/service-guarantee", "预约与履约"],
    ["/coach-partnership", "定向邀请和人工审核"],
    ["/login", "登录逐光私有试点"],
    ["/student", "继续按计划训练"],
    ["/student/coaches", "找适合你的教练"],
    ["/student/bookings", "管理训练安排"],
    ["/student/messages", "教练沟通"],
    ["/student/training", "看见持续训练带来的变化"],
    ["/student/profile", "学员账号"],
    ["/coach-workspace", "今天需要关注的工作"],
    ["/coach-workspace/bookings", "预约管理"],
    ["/coach-workspace/schedule", "排期与场馆"],
    ["/coach-workspace/messages", "学员消息"],
    ["/coach-workspace/courses", "课程记录"],
    ["/coach-workspace/payments", "线下收款"],
    ["/coach-workspace/credentials", "资质与资料"],
    ["/ops", "今日服务流转"],
    ["/ops/matching", "匹配中心"],
    ["/ops/coaches", "教练管理"],
    ["/ops/bookings", "预约履约"],
    ["/ops/users", "学员服务"],
    ["/ops/content", "内容与协议"],
    ["/ops/releases", "APK 在线分发暂未启用"],
  ];

  for (const [path, copy] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(copy), path);
  }
});

test("keeps the native MVP and business API isolated from browser routing", async () => {
  const [
    homepage,
    webPlatform,
    mobileApp,
    mobileDomain,
    mobileDevice,
    mobileCss,
    router,
    repository,
    schema,
    coachPages,
  ] = await Promise.all([
    read("app/page.tsx"),
    read("app/_lib/web-platform.ts"),
    read("app/mobile/app.tsx"),
    read("app/mobile/domain.ts"),
    read("app/mobile/device.ts"),
    read("app/mobile/mobile.css"),
    read("server/api/router.ts"),
    read("server/api/repository.ts"),
    read("db/schema.ts"),
    read("app/_components/coach-pages.tsx"),
  ]);

  assert.doesNotMatch(homepage, /MobileStudentApp|detectDeviceProfile|shouldUseStudentMobileApp/);
  assert.match(webPlatform, /r2Updates:\s*false/);
  assert.match(mobileApp, /type SheetName/);
  assert.match(mobileApp, /<BottomNav/);
  assert.match(mobileDomain, /score \+= 30/);
  assert.match(mobileDomain, /score \+= 25/);
  assert.match(mobileDomain, /score \+= 15/);
  assert.match(mobileDomain, /score \+= 5/);
  assert.match(mobileDevice, /SecureStorage/);
  assert.match(mobileDevice, /Preferences/);
  assert.match(mobileCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(router, /\/api\/v1/);
  assert.match(router, /pending_coach/);
  assert.match(repository, /idempotency/i);
  for (const table of ["users", "learner_profiles", "coaches", "coach_credentials", "availability_slots", "favorites", "booking_requests", "booking_events", "conversations", "messages", "notifications", "auth_challenges", "sessions"]) {
    assert.match(schema, new RegExp(`\\b${table}\\b`));
  }
  for (const page of ["预约管理", "排期与场馆", "学员消息", "课程记录", "线下收款", "资质与资料"]) {
    assert.match(coachPages, new RegExp(page));
  }
});

test("ships the existing verified private Android artifact without advertising R2 delivery", async () => {
  const metadata = JSON.parse(await read("public/downloads/android-private-release.json"));
  const apk = await readFile(new URL(`public/downloads/${metadata.file}`, root));
  const sha256 = createHash("sha256").update(apk).digest("hex");

  assert.equal(metadata.packageId, "com.zhuguang.coachos");
  assert.equal(metadata.versionName, "1.1.1");
  assert.equal(metadata.versionCode, 4);
  assert.equal(metadata.signature, "release");
  assert.equal(metadata.apiMode, "bundled-private-qa");
  assert.equal(metadata.sha256, sha256);
});

