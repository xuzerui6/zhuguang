import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateKeyPair, SignJWT } from "jose";
import {
  coachNavigation,
  coaches,
  featureFlags,
  getRouteArea,
  minimumPublishedTrialPrice,
  opsNavigation,
  publicCoaches,
  studentNavigation,
} from "../app/_lib/web-platform";
import { canAccessArea, createWebSession } from "../app/_lib/web-session";
import { applyWebSecurityHeaders } from "../app/_lib/web-security";
import { removeTurnstileWidget } from "../app/_lib/turnstile";
import { allowedForPlatformSession } from "../app/_lib/platform-proxy-policy";
import { describeBookingOptionsFailure, PlatformRequestError } from "../app/_components/platform-client";
import { resolveCloudflareAccessToken, verifyCloudflareAccessToken } from "../app/_lib/cloudflare-access";
import { BEIJING_DISTRICTS, coachCatalog, SPORT_OPTIONS } from "../shared/coach-catalog";

const root = new URL("../", import.meta.url);

test("Turnstile widgets are disposed exactly once when a page leaves", () => {
  const removed: string[] = [];
  const api = { remove: (widgetId: string) => removed.push(widgetId) };
  assert.equal(removeTurnstileWidget(api, "widget-1"), true);
  assert.equal(removeTurnstileWidget(api, null), false);
  assert.deepEqual(removed, ["widget-1"]);
});

test("homepage trial price only uses publicly bookable coaches with published positive pricing", () => {
  const base = coaches.find((coach) => coach.profileKind === "real")!;
  assert.equal(minimumPublishedTrialPrice([
    { ...base, bookable: false, pricingStatus: "published", trialPrice: 1 },
    { ...base, bookable: true, pricingStatus: "unavailable", trialPrice: 2 },
    { ...base, bookable: true, pricingStatus: "published", trialPrice: 99 },
    { ...base, bookable: true, pricingStatus: "published", trialPrice: 120 },
  ]), 99);
  assert.equal(minimumPublishedTrialPrice([{ ...base, bookable: false, pricingStatus: "published", trialPrice: 99 }]), undefined);
});

test("the runtime proxy applies browser security headers", () => {
  const headers = applyWebSecurityHeaders(new Headers());
  assert.match(headers.get("content-security-policy") || "", /frame-ancestors 'self'/u);
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
});

test("Cloudflare Access identity requires a valid signature, issuer and audience", async () => {
  const config = { audience: "access-audience", teamDomain: "https://zhuguang.cloudflareaccess.com" };
  const trusted = await generateKeyPair("RS256");
  const untrusted = await generateKeyPair("RS256");
  const valid = await new SignJWT({ email: "Coach@Example.com", name: "认证教练" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(config.teamDomain)
    .setAudience(config.audience)
    .setSubject("access-user-1")
    .setExpirationTime("5m")
    .sign(trusted.privateKey);
  assert.deepEqual(await verifyCloudflareAccessToken(valid, config, trusted.publicKey), {
    email: "coach@example.com",
    name: "认证教练",
    subject: "access-user-1",
  });

  const forged = await new SignJWT({ email: "coach@example.com" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(config.teamDomain)
    .setAudience(config.audience)
    .setSubject("forged-user")
    .setExpirationTime("5m")
    .sign(untrusted.privateKey);
  assert.equal(await verifyCloudflareAccessToken(forged, config, trusted.publicKey), null);
  assert.equal(await verifyCloudflareAccessToken(valid, { ...config, audience: "wrong-audience" }, trusted.publicKey), null);
});

test("Cloudflare Access falls back to its secure cookie for browser API requests", () => {
  assert.equal(resolveCloudflareAccessToken("signed-header", "signed-cookie"), "signed-header");
  assert.equal(resolveCloudflareAccessToken(null, "signed-cookie"), "signed-cookie");
  assert.equal(resolveCloudflareAccessToken("", ""), null);
});

test("classifies each web area without viewport or device heuristics", () => {
  assert.equal(getRouteArea("/"), "public");
  assert.equal(getRouteArea("/coaches/1"), "public");
  assert.equal(getRouteArea("/student/coaches"), "student");
  assert.equal(getRouteArea("/coach-workspace/schedule"), "coach");
  assert.equal(getRouteArea("/ops/matching"), "ops");
});

test("workspace navigation uses real, unique URLs", () => {
  for (const navigation of [studentNavigation, coachNavigation, opsNavigation]) {
    assert.equal(new Set(navigation.map((item) => item.href)).size, navigation.length);
    assert.ok(navigation.every((item) => item.href.startsWith("/")));
  }
  assert.equal(studentNavigation.find((item) => item.label === "找教练")?.href, "/student/coaches");
  assert.equal(coachNavigation.find((item) => item.label === "线下收款")?.href, "/coach-workspace/payments");
  assert.equal(coachNavigation.find((item) => item.id === "coach-schedule")?.label, "接单状态与日程");
  assert.equal(opsNavigation.find((item) => item.label === "匹配中心")?.href, "/ops/matching");
});

test("browser pages cannot mount the native mobile shell", async () => {
  const homepage = await readFile(new URL("app/page.tsx", root), "utf8");
  const workspaceShell = await readFile(new URL("app/_components/workspace-shell.tsx", root), "utf8");
  assert.doesNotMatch(homepage, /MobileStudentApp|shouldUseStudentMobileApp|detectDeviceProfile/);
  assert.doesNotMatch(workspaceShell, /MobileStudentApp|source=native-mobile/);
  assert.match(workspaceShell, /item\.id !== "student-training"/);
});

test("new web and Android clients do not restore legacy or unverified service claims", async () => {
  const [homepage, mobileApi, coachPages, productionEdge, mobileSheets, mobileBookings, coachDetail] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/mobile/api-client.ts", root), "utf8"),
    readFile(new URL("app/_components/coach-pages.tsx", root), "utf8"),
    readFile(new URL("scripts/verify-production-edge.ps1", root), "utf8"),
    readFile(new URL("app/mobile/sheets.tsx", root), "utf8"),
    readFile(new URL("app/mobile/views/bookings-view.tsx", root), "utf8"),
    readFile(new URL("app/mobile/views/coach-detail-view.tsx", root), "utf8"),
  ]);
  assert.doesNotMatch(homepage, /真实排期|未发布真实场馆与时段/u);
  assert.doesNotMatch(mobileApi, /coachCreateSlot|\/api\/v1\/coach\/slots/u);
  assert.match(coachPages, /无需预先发布时段/u);
  assert.match(productionEdge, /\/login\?next=%2Fops/u);
  assert.doesNotMatch(productionEdge, /Contains\('\/login\?next=\/ops'\)/u);
  assert.doesNotMatch(`${mobileSheets}\n${mobileBookings}`, /短信通知|短信提醒/u);
  assert.match(mobileBookings, /已结束/u);
  assert.doesNotMatch(coachDetail, /小宇妈妈|★★★★★/u);
});

test("web logout clears the session before navigating away", async () => {
  const source = await readFile("app/_components/student-pages.tsx", "utf8");
  const route = await readFile("app/api/auth/email/logout/route.ts", "utf8");
  assert.equal(source.includes('action="/api/auth/email/logout"'), false);
  assert.equal(source.includes('fetch("/api/auth/email/logout", { method: "POST" })'), true);
  assert.equal(source.includes('window.location.assign("/login")'), true);
  assert.equal(route.includes('"CF_Authorization"'), true);
});

test("anonymous visitors have no workspace permissions", () => {
  const session = createWebSession(null);
  assert.equal(session.isAuthenticated, false);
  assert.deepEqual(session.availableAreas, []);
  assert.equal(canAccessArea(session, "student"), false);
  assert.equal(canAccessArea(session, "coach"), false);
  assert.equal(canAccessArea(session, "ops"), false);
});

test("signed-in accounts receive student access by default", () => {
  const session = createWebSession({
    displayName: "测试账号",
    email: "learner@example.com",
    fullName: "测试账号",
    id: "account-1",
  });

  assert.equal(session.authorizationSource, "siwc");
  assert.deepEqual(session.availableAreas, ["student"]);
  assert.equal(canAccessArea(session, "student"), true);
  assert.equal(canAccessArea(session, "coach"), false);
});

test("the web proxy exposes booking options without broadening protected writes", () => {
  assert.equal(allowedForPlatformSession("/api/v1/coaches/5/booking-options", "GET", []), true);
  assert.equal(allowedForPlatformSession("/api/v1/coaches/5/booking-options", "POST", []), false);
  assert.equal(allowedForPlatformSession("/api/v1/bookings", "POST", []), false);
  assert.equal(allowedForPlatformSession("/api/v1/partnership-leads", "POST", []), true);
  assert.equal(allowedForPlatformSession("/api/v1/bookings", "POST", ["student:read"]), true);
  assert.equal(allowedForPlatformSession("/api/v1/operator/coaches/5", "GET", ["student:read"]), false);
});

test("booking options failures distinguish session errors from an offline coach", () => {
  assert.deepEqual(describeBookingOptionsFailure(new PlatformRequestError("forbidden", 403, "role_forbidden")), {
    action: "login",
    copy: "当前登录状态未能取得学员预约权限，请重新验证账号后再试。",
    title: "预约权限需要重新验证",
  });
  assert.deepEqual(describeBookingOptionsFailure(new PlatformRequestError("offline", 410, "coach_not_accepting_requests"), "暂停接单"), {
    action: "none",
    copy: "暂停接单",
    title: "教练暂未接单",
  });
  assert.equal(describeBookingOptionsFailure(new Error("网络异常")).action, "retry");
});

test("coach access uses the server allowlist and operations is locked to the primary email", () => {
  const session = createWebSession({
    displayName: "徐泽瑞",
    email: "xuzerui6@gmail.com",
    fullName: "徐泽瑞",
    id: "account-2",
  }, {
    coachEmails: "coach@example.com, XUZERUI6@gmail.com",
    opsEmails: "xuzerui6@gmail.com",
  });

  assert.equal(session.authorizationSource, "allowlist");
  assert.deepEqual(session.availableAreas, ["student", "coach", "ops"]);
  assert.deepEqual(session.permissions, ["student:read", "coach:work", "ops:manage", "release:read"]);
  assert.equal(canAccessArea(session, "student"), true);
  assert.equal(canAccessArea(session, "coach"), true);
  assert.equal(canAccessArea(session, "ops"), true);

  const accidentalOperator = createWebSession({
    displayName: "其他账号",
    email: "other@example.com",
    fullName: "其他账号",
    id: "account-3",
  }, { opsEmails: "other@example.com" });
  assert.equal(canAccessArea(accidentalOperator, "ops"), false);
  assert.deepEqual(accidentalOperator.availableAreas, ["student"]);
});

test("operations release proxy performs server-side permission and origin checks", async () => {
  const route = await readFile(new URL("app/api/ops/releases/route.ts", root), "utf8");
  assert.match(route, /getWebSession/);
  assert.match(route, /ops:manage/);
  assert.match(route, /release:read/);
  assert.match(route, /request\.headers\.get\("origin"\)/);
});

test("R2 update controls are enabled and coach data remains internally consistent", () => {
  assert.equal(featureFlags.r2Updates, true);
  assert.equal(new Set(coaches.map((coach) => coach.id)).size, coaches.length);
  assert.deepEqual(publicCoaches.map((coach) => coach.name), ["徐泽瑞", "张展祁", "郝健壮"]);
  assert.ok(coaches.every((coach) => coach.image.startsWith("/images/")));
  assert.ok(coaches.filter((coach) => !coach.isNew).every((coach) => coach.credentials.length > 0 && coach.rating > 0));
  const trackCoach = coaches.find((coach) => coach.id === 5);
  assert.deepEqual(trackCoach && {
    bookable: trackCoach.bookable,
    credentials: trackCoach.credentials,
    district: trackCoach.district,
    isNew: trackCoach.isNew,
    name: trackCoach.name,
    rating: trackCoach.rating,
    sport: trackCoach.sport,
  }, {
    bookable: false,
    credentials: ["国家级教练证书"],
    district: "通州区",
    isNew: true,
    name: "徐泽瑞",
    rating: 0,
    sport: "田径",
  });
  const realCoaches = coachCatalog.filter((coach) => coach.profileKind === "real");
  assert.deepEqual(realCoaches.map((coach) => coach.name), ["徐泽瑞", "张展祁", "郝健壮"]);
  assert.ok(realCoaches.every((coach) => coach.verificationLabel === "资料已核验"));
  assert.ok(realCoaches.every((coach) => coach.price === 240 && coach.trialPrice === 99));
  assert.ok(realCoaches.every((coach) => coach.credentials.length > 0 && coach.honors.length > 0));
  assert.ok(realCoaches.every((coach) => !coach.bookable && coach.canConsult));
});

test("coach catalog honestly covers all Beijing districts and pilot sports", () => {
  assert.equal(coachCatalog.length, 18);
  assert.deepEqual(new Set(coachCatalog.map((coach) => coach.district)), new Set(BEIJING_DISTRICTS));
  assert.deepEqual(new Set(coachCatalog.map((coach) => coach.sport)), new Set(SPORT_OPTIONS));
  assert.equal(coachCatalog.filter((coach) => coach.profileKind === "real").length, 3);
  const demos = coachCatalog.filter((coach) => coach.profileKind === "demo");
  assert.equal(demos.length, 15);
  assert.ok(demos.every((coach) => coach.verificationLabel === "演示资料" && !coach.bookable && !coach.canConsult));
  assert.ok(demos.every((coach) => coach.rating === 0 && coach.reviewCount === 0 && coach.lessons === 0));
});
