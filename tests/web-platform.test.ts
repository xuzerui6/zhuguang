import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  coachNavigation,
  coaches,
  featureFlags,
  getRouteArea,
  opsNavigation,
  studentNavigation,
} from "../app/_lib/web-platform";
import { canAccessArea, createWebSession } from "../app/_lib/web-session";
import { removeTurnstileWidget } from "../app/_lib/turnstile";

const root = new URL("../", import.meta.url);

test("Turnstile widgets are disposed exactly once when a page leaves", () => {
  const removed: string[] = [];
  const api = { remove: (widgetId: string) => removed.push(widgetId) };
  assert.equal(removeTurnstileWidget(api, "widget-1"), true);
  assert.equal(removeTurnstileWidget(api, null), false);
  assert.deepEqual(removed, ["widget-1"]);
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
  assert.equal(opsNavigation.find((item) => item.label === "匹配中心")?.href, "/ops/matching");
});

test("browser pages cannot mount the native mobile shell", async () => {
  const homepage = await readFile(new URL("app/page.tsx", root), "utf8");
  const workspaceShell = await readFile(new URL("app/_components/workspace-shell.tsx", root), "utf8");
  assert.doesNotMatch(homepage, /MobileStudentApp|shouldUseStudentMobileApp|detectDeviceProfile/);
  assert.doesNotMatch(workspaceShell, /MobileStudentApp|source=native-mobile/);
  assert.match(workspaceShell, /item\.id !== "student-training"/);
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

test("coach and operations access only come from server allowlists", () => {
  const session = createWebSession({
    displayName: "徐泽瑞",
    email: "xuzerui@example.com",
    fullName: "徐泽瑞",
    id: "account-2",
  }, {
    coachEmails: "coach@example.com, XUZERUI@example.com",
    opsEmails: "xuzerui@example.com",
  });

  assert.equal(session.authorizationSource, "allowlist");
  assert.deepEqual(session.availableAreas, ["student", "coach", "ops"]);
  assert.equal(canAccessArea(session, "coach"), true);
  assert.equal(canAccessArea(session, "ops"), true);
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
    credentials: [],
    district: "通州区",
    isNew: true,
    name: "徐泽瑞",
    rating: 0,
    sport: "田径",
  });
});
