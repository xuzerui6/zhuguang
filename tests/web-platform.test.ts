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
import type { WebSession } from "../app/_lib/web-platform";
import { canAccessArea } from "../app/_lib/web-session";

const root = new URL("../", import.meta.url);

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

test("workspace access requires both an available area and its permission", () => {
  const session: WebSession = {
    availableAreas: ["student", "coach"],
    displayName: "测试账号",
    email: null,
    isPrivatePreview: true,
    permissions: ["student:read"],
  };

  assert.equal(canAccessArea(session, "student"), true);
  assert.equal(canAccessArea(session, "coach"), false);
  assert.equal(canAccessArea(session, "ops"), false);
});

test("R2 update controls stay disabled while coach data remains internally consistent", () => {
  assert.equal(featureFlags.r2Updates, false);
  assert.equal(new Set(coaches.map((coach) => coach.id)).size, coaches.length);
  assert.ok(coaches.every((coach) => coach.image.startsWith("/images/") && coach.credentials.length > 0));
});
