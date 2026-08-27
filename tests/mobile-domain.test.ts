import assert from "node:assert/strict";
import test from "node:test";
import { demoCoaches } from "../app/mobile/demo-data";
import { createDemoCoachOverview } from "../app/mobile/coach/coach-app";
import {
  canTransitionBooking,
  formatYuan,
  getMatchResult,
  isFutureBookingDate,
  mergeFavoriteIds,
} from "../app/mobile/domain";
import type { MatchPreferences } from "../app/mobile/types";
import type { AppRelease, CoachAccountSummary } from "../app/mobile/types";
import { getUpdateDecision, parsePrivateQaNotification, parseZhuguangDeepLink, resolveAccountMode } from "../app/mobile/unified-domain";
import {
  createUpdateResumeGate,
  ensureUpdateInstallPermission,
  isNoNewReleaseError,
  updateCheckErrorMessage,
} from "../app/mobile/update/update-domain";
import { stableRolloutBucket } from "../server/api/releases";
import { pushLockScreenBody } from "../server/api/push";
import { formatBeijingDateTimeLocal, parseBeijingDateTimeLocal, validateScheduleDraft } from "../shared/scheduling";
import { matchesAudience, matchesTrainingGoal } from "../shared/coach-catalog";
import { calculateDurationPriceFen, durationMinutesBetween } from "../shared/pricing";
import {
  canStartPullRefresh,
  isVerticalPull,
  PULL_REFRESH_MAX_DISTANCE,
  PULL_REFRESH_THRESHOLD,
  pullRefreshDistance,
  pullRefreshState,
} from "../app/mobile/pull-refresh-domain";

const preferences: MatchPreferences = {
  audience: "青少年儿童",
  budget: 240,
  city: "北京",
  desiredTime: "周末",
  district: "通州区",
  goal: "体能提升",
  sport: "田径",
};

test("Beijing schedule input is timezone-stable and validates duration fields", () => {
  const startsAt = parseBeijingDateTimeLocal("2026-09-12T09:30");
  const endsAt = parseBeijingDateTimeLocal("2026-09-12T11:00");
  assert.equal(startsAt, Date.parse("2026-09-12T09:30:00+08:00"));
  assert.equal(formatBeijingDateTimeLocal(startsAt), "2026-09-12T09:30");
  assert.deepEqual(validateScheduleDraft({ endsAt, startsAt, venueId: "venue-1" }, Date.parse("2026-09-01T00:00:00+08:00")), {});
  assert.equal(validateScheduleDraft({ endsAt: startsAt + 15 * 60_000, startsAt, venueId: "venue-1" }, Date.parse("2026-09-01T00:00:00+08:00")).endsAt, "训练时长不能少于30分钟");
  assert.equal(validateScheduleDraft({ endsAt: startsAt + 5 * 60 * 60_000, startsAt, venueId: "venue-1" }, Date.parse("2026-09-01T00:00:00+08:00")).endsAt, "训练时长不能超过4小时");
  assert.ok(Number.isNaN(parseBeijingDateTimeLocal("2026-02-30T09:30")));
});

test("matching applies the locked 30/25/25/15/5 weights", () => {
  const availableCoach = { ...demoCoaches[0], bookable: true, bookingEnabled: true };
  assert.deepEqual(getMatchResult(availableCoach, preferences).score, 100);
  assert.equal(getMatchResult(availableCoach, { ...preferences, goal: "兴趣入门" }).score, 70);
  assert.equal(getMatchResult(demoCoaches[0], preferences).score, 75);
  assert.ok(getMatchResult(availableCoach, preferences).reasons.includes("周末可申请"));
  assert.deepEqual(getMatchResult({ ...availableCoach, sport: "游泳" }, preferences), { eligible: false, reasons: [], score: 0 });
  assert.deepEqual(getMatchResult({ ...availableCoach, verified: false }, preferences), { eligible: false, reasons: [], score: 0 });
});

test("shared discovery aliases match real coach vocabulary across web and Android", () => {
  assert.equal(matchesTrainingGoal(["中小学体育中高考"], "中考体育"), true);
  assert.equal(matchesTrainingGoal(["专项训练"], "短跑专项"), true);
  assert.equal(matchesTrainingGoal(["体能提升"], "专项体能"), true);
  assert.equal(matchesTrainingGoal(["跳远", "跳高"], "专项提升"), true);
  assert.equal(matchesAudience(["青少年儿童", "成人"], "青少年"), true);
  assert.equal(matchesAudience(["成人"], "全部对象"), true);
  assert.equal(matchesAudience(["成人"], "儿童"), false);
});

test("booking dates and state transitions reject expired or illegal paths", () => {
  const now = new Date("2026-08-01T08:00:00+08:00");
  assert.equal(isFutureBookingDate("2026-08-01", now), true);
  assert.equal(isFutureBookingDate("2026-07-31", now), false);
  assert.equal(isFutureBookingDate("not-a-date", now), false);
  assert.equal(canTransitionBooking("pending_coach", "confirmed"), true);
  assert.equal(canTransitionBooking("confirmed", "completed"), true);
  assert.equal(canTransitionBooking("completed", "confirmed"), false);
  assert.equal(canTransitionBooking("rejected", "cancelled_by_student"), false);
});

test("favorites merge without duplicates and money remains fen-based", () => {
  assert.deepEqual(mergeFavoriteIds([3, 1, 3], [2, 1]), [1, 2, 3]);
  assert.match(formatYuan(9900), /99/u);
  assert.match(formatYuan(12_345), /123[.,]45|123\.45/u);
});

test("booking prices scale from the 60-minute base rate", () => {
  assert.equal(calculateDurationPriceFen(24_000, 60), 24_000);
  assert.equal(calculateDurationPriceFen(24_000, 90), 36_000);
  assert.equal(calculateDurationPriceFen(24_000, 120), 48_000);
  assert.equal(calculateDurationPriceFen(9_900, 90), 14_850);
  assert.equal(durationMinutesBetween(1_000, 1_000 + 90 * 60_000), 90);
});

test("native pull refresh applies threshold, damping, and a bounded travel distance", () => {
  assert.equal(pullRefreshDistance(-10), 0);
  assert.equal(pullRefreshDistance(36), 36);
  assert.equal(pullRefreshDistance(PULL_REFRESH_THRESHOLD), PULL_REFRESH_THRESHOLD);
  assert.ok(pullRefreshDistance(100) > PULL_REFRESH_THRESHOLD);
  assert.equal(pullRefreshDistance(10_000), PULL_REFRESH_MAX_DISTANCE);
  assert.equal(pullRefreshState(0), "idle");
  assert.equal(pullRefreshState(PULL_REFRESH_THRESHOLD - 1), "pulling");
  assert.equal(pullRefreshState(PULL_REFRESH_THRESHOLD), "armed");
});

test("native pull refresh rejects horizontal, nested, multi-touch, and concurrent gestures", () => {
  assert.equal(isVerticalPull(3, 20), true);
  assert.equal(isVerticalPull(20, 20), false);
  assert.equal(isVerticalPull(0, -20), false);
  assert.equal(canStartPullRefresh({ atTop: true, blocked: false, refreshing: false, touchCount: 1 }), true);
  assert.equal(canStartPullRefresh({ atTop: false, blocked: false, refreshing: false, touchCount: 1 }), false);
  assert.equal(canStartPullRefresh({ atTop: true, blocked: true, refreshing: false, touchCount: 1 }), false);
  assert.equal(canStartPullRefresh({ atTop: true, blocked: false, refreshing: true, touchCount: 1 }), false);
  assert.equal(canStartPullRefresh({ atTop: true, blocked: false, refreshing: false, touchCount: 2 }), false);
});

const approvedCoach: CoachAccountSummary = {
  auditStatus: "approved",
  id: 1,
  name: "周明",
  pendingBookingCount: 3,
  sport: "羽毛球",
  title: "国家队退役运动员",
};

const release: AppRelease = {
  certificateSha256: "cert",
  forced: false,
  minimumSupportedVersionCode: 3,
  notes: [],
  packageId: "com.zhuguang.coachos",
  publishedAt: 1,
  sha256: "sha",
  sizeBytes: 100,
  versionCode: 4,
  versionName: "1.1.1",
};

test("coach mode only restores for an active approved role", () => {
  assert.equal(resolveAccountMode("coach", ["student", "coach"], approvedCoach), "coach");
  assert.equal(resolveAccountMode("coach", ["student"], approvedCoach), "student");
  assert.equal(resolveAccountMode("coach", ["student", "coach"], { ...approvedCoach, auditStatus: "suspended" }), "student");
});

test("role deep links and update policy are deterministic", () => {
  assert.deepEqual(parseZhuguangDeepLink("zhuguang://coach/appointments/booking-1"), { coachTab: "appointments", mode: "coach" });
  assert.deepEqual(parseZhuguangDeepLink("zhuguang://student/messages/thread-1"), { mode: "student", studentTab: "messages" });
  assert.deepEqual(parseZhuguangDeepLink("zhuguang://updates/latest"), { updates: true });
  assert.equal(getUpdateDecision(3, release, 0, 100), "optional");
  assert.equal(getUpdateDecision(2, release, 0, 100), "forced");
  assert.equal(getUpdateDecision(3, release, 200, 100), "deferred");
  assert.equal(getUpdateDecision(4, release, 0, 100), "current");
});

test("version center distinguishes no update from an offline failure", () => {
  assert.equal(isNoNewReleaseError({ code: "release_not_available" }), true);
  assert.equal(isNoNewReleaseError({ code: "not_found" }), false);
  assert.equal(updateCheckErrorMessage(new DOMException("signal is aborted without reason", "AbortError")), "暂时无法连接更新服务，请检查网络后重试");
  assert.equal(updateCheckErrorMessage({ message: "版本服务维护中" }), "版本服务维护中");
});

test("update permission is read live and only opens settings when required", async () => {
  const allowedCalls: string[] = [];
  const allowedGate = createUpdateResumeGate();
  assert.equal(await ensureUpdateInstallPermission({
    async canInstallPackages() {
      allowedCalls.push("check");
      return { allowed: true };
    },
    async openInstallPermission() {
      allowedCalls.push("settings");
    },
  }, allowedGate), true);
  assert.deepEqual(allowedCalls, ["check"]);
  assert.equal(allowedGate.isWaiting(), false);

  const deniedCalls: string[] = [];
  const deniedGate = createUpdateResumeGate();
  assert.equal(await ensureUpdateInstallPermission({
    async canInstallPackages() {
      deniedCalls.push("check");
      return { allowed: false };
    },
    async openInstallPermission() {
      deniedCalls.push("settings");
    },
  }, deniedGate), false);
  assert.deepEqual(deniedCalls, ["check", "settings"]);
  assert.equal(deniedGate.isWaiting(), true);
});

test("permission resume can continue a pending update only once", () => {
  const gate = createUpdateResumeGate();
  gate.wait();
  assert.equal(gate.claim(false), false);
  assert.equal(gate.isWaiting(), true);
  assert.equal(gate.claim(true), true);
  assert.equal(gate.claim(true), false);
  assert.equal(gate.isWaiting(), false);
});

test("private QA notification routes cover all native channels without private names", () => {
  assert.deepEqual(parsePrivateQaNotification("zhuguang://diagnostics/notification/booking"), {
    body: "你的预约状态已更新，请进入逐光查看。",
    deepLink: "zhuguang://student/bookings",
    targetMode: "student",
    title: "预约进度",
    type: "booking",
  });
  assert.equal(parsePrivateQaNotification("zhuguang://diagnostics/notification/message")?.deepLink, "zhuguang://coach/messages");
  assert.equal(parsePrivateQaNotification("zhuguang://diagnostics/notification/update")?.deepLink, "zhuguang://updates/latest");
  assert.equal(parsePrivateQaNotification("zhuguang://student/messages"), null);
});

test("release rollout uses a stable installation bucket", async () => {
  const first = await stableRolloutBucket("device_beijing_001");
  assert.equal(first, await stableRolloutBucket("device_beijing_001"));
  assert.ok(first >= 0 && first < 100);
});

test("coach demo bookings always end after they start", () => {
  const overview = createDemoCoachOverview(approvedCoach);
  for (const booking of overview.bookings) {
    assert.ok(booking.endTime > booking.time, `${booking.id} has an invalid time range`);
  }
});

test("lock-screen message copy never exposes conversation content", () => {
  const privateMessage = "小宇明天 18:00 可以训练吗？";
  assert.equal(pushLockScreenBody("student_message", privateMessage), "你有一条新的服务消息，请进入逐光查看。");
  assert.equal(pushLockScreenBody("coach_message", privateMessage), "你有一条新的服务消息，请进入逐光查看。");
  assert.equal(pushLockScreenBody("booking_status", "预约已确认"), "预约已确认");
});
