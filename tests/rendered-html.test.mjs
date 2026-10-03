import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
process.env.ZHUGUANG_COACH_EMAILS = "qa-owner@example.com";
process.env.PRIMARY_OPERATOR_EMAIL = "xuzerui6@gmail.com";
process.env.PRODUCT_FILM_ENABLED = "false";

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

async function render(path = "/", authenticated = false, email = "qa-owner@example.com") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${encodeURIComponent(path)}`);
  const { default: worker } = await import(workerUrl.href);
  const headers = { accept: "text/html" };
  if (authenticated) {
    headers["oai-authenticated-user-email"] = email;
    headers["oai-authenticated-user-id"] = "qa-owner-account";
  }
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("web worker preparation preserves www paths and query parameters in a permanent redirect", async () => {
  const prepareScript = await read("scripts/prepare-web-worker-build.mjs");
  assert.match(prepareScript, /config\.main = "web-entry\.js"/);
  assert.match(prepareScript, /url\.hostname === "www\.beijingzhuguang\.top"/);
  assert.match(prepareScript, /url\.hostname = "beijingzhuguang\.top"/);
  assert.match(prepareScript, /Response\.redirect\(url, 301\)/);
  assert.match(prepareScript, /config\.find_additional_modules = true/);
  assert.ok(prepareScript.includes('replace(\'import assetsManifest from "./__vite_rsc_assets_manifest.js";\''));
  const workerConfig = JSON.parse(await read('wrangler.web.jsonc'));
  assert.ok(workerConfig.compatibility_flags.includes('global_fetch_strictly_public'), 'preview Worker-to-Worker reads must use public fetch routing');
});

test("server-renders a service-first homepage without prototype claims", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>逐光运动教练服务平台<\/title>/);
  assert.match(html, /专业体育教练/);
  assert.match(html, /服务北京 · 吉林长春/);
  assert.match(html, /找教练/);
  assert.match(html, /人工核验/);
  assert.match(html, /教练确认后预约生效/);
  assert.match(html, /北京(?:<!-- -->)?已核验教练/);
  assert.match(html, /了解合作方式/);
  assert.doesNotMatch(html, /Coach OS|28,000\+|320,000\+|注册教练|Android 私有试点版/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("product film stays isolated from the production homepage and deployment", async () => {
  const response = await render();
  const html = await response.text();
  const homepage = await read("app/page.tsx");
  const manifest = await read("app/_lib/product-film.ts");
  const packageJson = await read("package.json");

  assert.doesNotMatch(homepage, /PRODUCT_FILM_ENABLED|ProductFilm|productFilm/);
  const prepareScript = await read("scripts/prepare-web-worker-build.mjs");
  assert.match(prepareScript, /PRODUCT_FILM_ENABLED !== "true"/);
  assert.match(prepareScript, /zhuguang-product-film\.mp4/);
  assert.doesNotMatch(html, /看看逐光如何工作|从选择教练，到看见每一次进步/);
  assert.doesNotMatch(html, /<video\b|<track\b|zhuguang-product-film-(?:poster\.)?|zhuguang-product-film\.(?:webm|mp4|vtt)/i);
  assert.ok(manifest.indexOf("video/webm") < manifest.indexOf("video/mp4"));
  assert.doesNotMatch(packageJson, /@remotion|hyperframes/);
});

test("homepage discovery defaults to a real match and consultation keeps coach context", async () => {
  const homepage = await render("/?coach=5");
  const html = await homepage.text();
  const directory = await read("app/_components/coach-directory.tsx");
  const detail = await read("app/coaches/[id]/page.tsx");

  assert.match(html, /value="中考体育"|<option[^>]*selected[^>]*>中考体育<\/option>/u);
  assert.match(html, /正在咨询/);
  assert.match(html, /徐泽瑞/);
  assert.match(directory, /\?coach=\$\{coach\.id\}&city=\$\{cityId\}#service-inquiry/);
  assert.match(detail, /\?coach=\$\{coach\.id\}&city=\$\{cityId\}#service-inquiry/);
});

test("web booking keeps coach context and submits a student-selected time", async () => {
  const [accessDenied, directory, detail, studentPages, studentRoute, platformClient, platformRoute] = await Promise.all([
    read("app/_components/access-denied.tsx"),
    read("app/_components/coach-directory.tsx"),
    read("app/coaches/[id]/page.tsx"),
    read("app/_components/student-pages.tsx"),
    read("app/student/[section]/page.tsx"),
    read("app/_components/platform-client.ts"),
    read("app/api/platform/route.ts"),
  ]);

  assert.match(directory, /\/student\/bookings\?coach=\$\{coach\.id\}/s);
  assert.match(accessDenied, /usePathname/);
  assert.match(accessDenied, /useSearchParams/);
  assert.match(accessDenied, /encodeURIComponent\(requestedPath\)/);
  assert.doesNotMatch(directory, /\/slots/);
  assert.doesNotMatch(detail, /loadPublicCoachSlots/);
  assert.match(detail, /\/login\?next=\$\{encodeURIComponent\(bookingTarget\)\}/);
  assert.match(studentRoute, /query\.slot/);
  assert.match(studentPages, /\/api\/v1\/learner-profiles/);
  assert.match(studentPages, /idempotencyKey,/);
  assert.match(studentPages, /hasPriorEffectiveBooking/);
  assert.match(studentPages, /bookingPriceLabel/);
  assert.match(studentPages, /教练确认后预约才会生效/);
  assert.match(platformClient, /headers\.set\("idempotency-key", options\.idempotencyKey\)/);
  assert.match(platformRoute, /\^\[A-Za-z0-9\]\[A-Za-z0-9\._:-\]\{7,159\}\$/);
});

test("production login always renders the public Turnstile integration", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  const loginForm = await read("app/login/email-login-form.tsx");
  assert.match(html, /0x4AAAAAAEM50c0fGqXTnUvL/);
  assert.match(loginForm, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.equal((html.match(/<h1(?:\s[^>]*)?>/gu) || []).length, 1);
});

test("public lead forms collect minimal contacts without publishing fake compliance data", async () => {
  const [form, footer, homepage] = await Promise.all([
    read("app/_components/service-lead-form.tsx"),
    read("app/_components/public-footer.tsx"),
    read("app/page.tsx"),
  ]);
  assert.match(form, /contactPhone/);
  assert.match(form, /contactWechat/);
  assert.match(form, /learnerStage/);
  assert.match(form, /咨询不收费，也不会自动生成预约/);
  assert.doesNotMatch(form, /身份证|出生日期|生日/);
  assert.match(footer, /SITE_OPERATOR_NAME/);
  assert.match(footer, /SITE_ICP_NUMBER/);
  assert.match(homepage, /HomeCityProvider/);
  assert.match(await read('app/_components/home-city-content.tsx'), /homeTrialPrice\(data\.coaches\)/);
  assert.match(form, /<details className="zg-service-lead-more">/);
  assert.match(form, /补充更多信息/);
  assert.match(form, /SERVICE_AREAS\[cityId\]\.map/);
  assert.match(footer, /SITE_PUBLIC_SECURITY_NUMBER/);
  assert.match(footer, /safeHttpsUrl/);
});

test("P0 and P1 public flows expose privacy requests and explicit mobile coach actions", async () => {
  const [privacyResponse, header, directory, directoryStyles, privacyForm] = await Promise.all([
    render("/privacy"),
    read("app/_components/public-header.tsx"),
    read("app/_components/coach-directory.tsx"),
    read("app/_components/coach-directory.module.css"),
    read("app/_components/privacy-request-form.tsx"),
  ]);
  const privacyHtml = await privacyResponse.text();
  assert.match(privacyHtml, /提交隐私请求/);
  assert.match(privacyForm, /\/api\/v1\/privacy-requests/);
  assert.match(privacyForm, /无需登录/);
  assert.match(header, /href="\/login\?next=\/student"/);
  assert.equal((header.match(/href="\/login\?next=\/student"/gu) || []).length, 2);
  assert.doesNotMatch(header, /href="\/login">(?:登录|进入平台)/u);
  assert.match(directory, /查看档案/);
  assert.match(directory, /咨询这位教练/);
  assert.match(directoryStyles, /min-height:\s*44px/);
});

test("all public and workspace routes support direct rendering", async () => {
  const routes = [
    ["/coaches", "找到适合你的教练"],
    ["/coaches/5", "资料核验状态"],
    ["/service-guarantee", "预约与履约"],
    ["/coach-partnership", "Android App 或微信小程序提交资料"],
    ["/download", "训练服务，随时在手边"],
    ["/privacy", "只处理完成训练服务"],
    ["/terms", "教练确认后生效"],
    ["/login", "登录逐光"],
    ["/student", "学员平台导航"],
    ["/student/coaches", "学员平台导航"],
    ["/student/bookings", "学员平台导航"],
    ["/student/messages", "学员平台导航"],
    ["/student/training", "学员平台导航"],
    ["/student/profile", "学员平台导航"],
    ["/coach-workspace", "教练工作台导航"],
    ["/coach-workspace/bookings", "教练工作台导航"],
    ["/coach-workspace/schedule", "教练工作台导航"],
    ["/coach-workspace/messages", "教练工作台导航"],
    ["/coach-workspace/courses", "教练工作台导航"],
    ["/coach-workspace/payments", "教练工作台导航"],
    ["/coach-workspace/credentials", "教练工作台导航"],
    ["/ops", "运营工作台导航"],
    ["/ops/matching", "运营工作台导航"],
    ["/ops/coaches", "运营工作台导航"],
    ["/ops/bookings", "运营工作台导航"],
    ["/ops/users", "运营工作台导航"],
    ["/ops/content", "运营工作台导航"],
    ["/ops/releases", "运营工作台导航"],
    ["/ops/catalog", "运营工作台导航"],
    ["/ops/transactions", "运营工作台导航"],
  ];

  for (const [path, copy] of routes) {
    const authenticated = path.startsWith("/student") || path.startsWith("/coach-workspace") || path.startsWith("/ops");
    const response = await render(path, authenticated, path.startsWith("/ops") ? "xuzerui6@gmail.com" : "qa-owner@example.com");
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(copy), path);
  }
});

test("iOS source uses platform-aware auth and TestFlight updates", async () => {
  const [apiClient, bridge, emailAuth, infoPlist, updateCenter, workflow] = await Promise.all([
    read("app/mobile/api-client.ts"),
    read("app/mobile/native-bridge.ts"),
    read("server/api/email-auth.ts"),
    read("ios/App/App/Info.plist"),
    read("app/mobile/update/update-center.tsx"),
    read("codemagic.yaml"),
  ]);

  assert.match(apiClient, /headers\.set\("x-app-platform", getMobilePlatform\(\)\)/);
  assert.match(bridge, /getMobilePlatform\(\) !== "android"/);
  assert.match(emailAuth, /android: 16, ios: 19/);
  assert.match(infoPlist, /<string>逐光<\/string>/);
  assert.match(infoPlist, /ITSAppUsesNonExemptEncryption/);
  assert.match(updateCenter, /通过 TestFlight 管理更新/);
  assert.doesNotMatch(updateCenter.match(/if \(mobilePlatform === "ios"\)[\s\S]*?return \([\s\S]*?\n  \}/)?.[0] ?? "", /downloadAndInstall|createDownloadTicket/);
  assert.match(workflow, /ios-simulator-check:/);
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(workflow, /ios-testflight:/);
  assert.match(workflow, /submit_to_testflight: true/);
  assert.match(workflow, /submit_to_app_store: false/);
});

test("rejects configured operator aliases that are not the primary account", async () => {
  const response = await render("/ops", true, "qa-owner@example.com");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /当前账号暂不能进入运营工作台/);
  assert.doesNotMatch(html, /运营工作台导航/);
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
    releaseProxy,
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
    read("app/api/ops/releases/route.ts"),
  ]);

  assert.doesNotMatch(homepage, /MobileStudentApp|detectDeviceProfile|shouldUseStudentMobileApp/);
  assert.match(webPlatform, /r2Updates:\s*true/);
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
  assert.match(releaseProxy, /platformGet/);
  const sharedProxy = await readFile(new URL("../app/api/platform/route.ts", import.meta.url), "utf8");
  assert.match(sharedProxy, /process\.env\.ZHUGUANG_OPERATOR_API_SECRET/);
  assert.match(sharedProxy, /x-operator-secret/);
  for (const table of ["users", "learner_profiles", "coaches", "coach_credentials", "availability_slots", "favorites", "booking_requests", "booking_events", "conversations", "messages", "notifications", "auth_challenges", "sessions"]) {
    assert.match(schema, new RegExp(`\\b${table}\\b`));
  }
  for (const page of ["预约管理", "接单状态与日程", "学员消息", "课程记录", "线下收款", "资质与资料"]) {
    assert.match(coachPages, new RegExp(page));
  }
});

test("keeps private Android artifacts out of the website static directory", async () => {
  const buildScript = await read("scripts/build-android-apk.mjs");
  const workflow = await read(".github/workflows/native-builds.yml");

  assert.match(buildScript, /path\.join\(root, "outputs", "releases"\)/);
  assert.doesNotMatch(buildScript, /path\.join\(root, "public", "downloads"\)/);
  assert.match(workflow, /outputs\/releases\/zhuguang-android-private-/);
  assert.doesNotMatch(workflow, /public\/downloads/);
});

test("renders a public Android download entry without exposing a static APK", async () => {
  const homepage = await render("/");
  const download = await render("/download");
  assert.match(await homepage.text(), /下载 Android App/);
  const html = await download.text();
  assert.match(html, /正在读取正式版本/);
  assert.match(html, /三步完成安装/);
  assert.doesNotMatch(html, /href=["'][^"']+\.apk/iu);
});

test("P1 naturally expired cookies renew before SSR; present invalid tokens get one recovery path", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { ZHUGUANG_MOBILE_API_URL: "https://isolated.invalid", ZHUGUANG_PILOT_APP_KEY: "test-channel", ZHUGUANG_OPERATOR_API_SECRET: "test-proxy" });
  const identity = { userId: "qa-user", email: "xuzerui6@gmail.com", roles: ["student", "coach", "operator"], availableModes: ["student", "coach"], contactMasked: "QA", coach: { id: 5, name: "隔离测试教练", title: "测试档案", sport: "田径" } };
  let refreshes = 0;
  let identities = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (url.endsWith("/auth/refresh")) { refreshes++; return Response.json({ data: { ...identity, accessToken: "renewed-access", refreshToken: "renewed-refresh" } }); }
    if (url.endsWith("/me")) { identities++; return headers.get("authorization") === "Bearer renewed-access" ? Response.json({ data: identity }) : Response.json({ error: { code: "authentication_required" } }, { status: 401 }); }
    if (url.endsWith("/coaches")) return Response.json({ data: [] });
    return Response.json({ data: {} });
  };
  try {
    const { default: worker } = await import(new URL("../dist/server/index.js", import.meta.url));
    for (const path of ["/student", "/coach-workspace", "/ops", "/api/platform?path=%2Fapi%2Fv1%2Fme"]) {
      const response = await worker.fetch(new Request(`http://localhost${path}`, { headers: { cookie: "zg_web_refresh=old-refresh; zg_web_device=web-qa", accept: "text/html" } }), {}, { waitUntil() {}, passThroughOnException() {} });
      const body = await response.text();
      assert.equal(response.status, 200, path);
      assert.doesNotMatch(body, /需要登录|role_forbidden/);
      const cookies = response.headers.get("set-cookie") || "";
      assert.ok(cookies.includes("zg_web_access=renewed-access") && cookies.includes("HttpOnly") && cookies.includes("Secure"), "renewed cookies must reach the browser");
    }
    assert.equal(refreshes, 4);
    const context = { waitUntil() {}, passThroughOnException() {} };
    for (const path of ['/student','/coach-workspace','/ops']) {
      identities = 0;
      const valid = await worker.fetch(new Request(`http://localhost${path}`,{headers:{cookie:'zg_web_access=renewed-access; zg_web_refresh=old-refresh; zg_web_device=web-qa'}}),{},context);
      assert.doesNotMatch(await valid.text(),/需要登录|role_forbidden/);
      assert.equal(identities,1,'one identity check per protected SSR');
      const expired = await worker.fetch(new Request(`http://localhost${path}`,{headers:{cookie:'zg_web_access=expired; zg_web_refresh=old-refresh; zg_web_device=web-qa'}}),{},context);
      assert.match(await expired.text(),/正在恢复登录状态/);
    }
    assert.equal(refreshes,4,'present cookies never refresh in middleware');
    const recovery = await worker.fetch(new Request('http://localhost/api/auth/email/refresh',{method:'POST',headers:{origin:'http://localhost',cookie:'zg_web_access=expired; zg_web_refresh=old-refresh; zg_web_device=web-qa'}}),{},context);
    assert.equal(recovery.status,200); assert.equal(refreshes,5);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ["ZHUGUANG_MOBILE_API_URL", "ZHUGUANG_PILOT_APP_KEY", "ZHUGUANG_OPERATOR_API_SECRET"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
