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
import { isNoNewReleaseError, updateCheckErrorMessage } from "../app/mobile/update/update-domain";
import { stableRolloutBucket } from "../server/api/releases";
import { pushLockScreenBody } from "../server/api/push";

const preferences: MatchPreferences = {
  audience: "青少年",
  budget: 600,
  city: "北京",
  desiredTime: "周末",
  district: "朝阳区",
  goal: "专项提升",
  sport: "羽毛球",
};

test("matching applies the locked 30/25/25/15/5 weights", () => {
  assert.deepEqual(getMatchResult(demoCoaches[0], preferences).score, 100);
  assert.equal(getMatchResult(demoCoaches[0], { ...preferences, goal: "兴趣入门" }).score, 70);
  assert.deepEqual(getMatchResult(demoCoaches[2], preferences), { eligible: false, reasons: [], score: 0 });
  assert.deepEqual(getMatchResult({ ...demoCoaches[0], verified: false }, preferences), { eligible: false, reasons: [], score: 0 });
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
