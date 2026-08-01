import type { AccountMode, AppRelease, CoachAccountSummary, CoachTab, MobileTab } from "./types";

export type DeepLinkTarget = {
  coachTab?: CoachTab;
  mode?: AccountMode;
  studentTab?: MobileTab;
  updates?: boolean;
};

export type PrivateQaNotification = {
  body: string;
  deepLink: string;
  targetMode: AccountMode;
  title: string;
  type: "booking" | "message" | "update";
};

export function resolveAccountMode(
  storedMode: AccountMode,
  availableModes: AccountMode[],
  coach?: CoachAccountSummary,
): AccountMode {
  return storedMode === "coach" && availableModes.includes("coach") && coach?.auditStatus === "approved"
    ? "coach"
    : "student";
}

export function parseZhuguangDeepLink(url: string): DeepLinkTarget {
  const normalized = url.replace(/^zhuguang:\/\//u, "");
  if (normalized.startsWith("updates")) return { updates: true };
  if (normalized.startsWith("coach/")) {
    const tab = normalized.split("/")[1];
    const map: Record<string, CoachTab> = { appointments: "appointments", messages: "messages", profile: "profile", schedule: "schedule", workspace: "workspace" };
    return { coachTab: map[tab] ?? "workspace", mode: "coach" };
  }
  if (normalized.startsWith("student/")) {
    const tab = normalized.split("/")[1];
    const map: Record<string, MobileTab> = { bookings: "bookings", discover: "discover", home: "home", messages: "messages", profile: "profile" };
    return { mode: "student", studentTab: map[tab] ?? "home" };
  }
  return {};
}

export function parsePrivateQaNotification(url: string): PrivateQaNotification | null {
  const normalized = url.replace(/^zhuguang:\/\//u, "").split("?")[0];
  const type = normalized.startsWith("diagnostics/notification/") ? normalized.split("/")[2] : "";
  if (type === "booking") {
    return {
      body: "你的预约状态已更新，请进入逐光查看。",
      deepLink: "zhuguang://student/bookings",
      targetMode: "student",
      title: "预约进度",
      type,
    };
  }
  if (type === "message") {
    return {
      body: "你有一条新的服务消息，请进入逐光查看。",
      deepLink: "zhuguang://coach/messages",
      targetMode: "coach",
      title: "服务消息",
      type,
    };
  }
  if (type === "update") {
    return {
      body: "逐光有新的安全版本，请前往版本中心查看。",
      deepLink: "zhuguang://updates/latest",
      targetMode: "student",
      title: "版本更新",
      type,
    };
  }
  return null;
}

export function getUpdateDecision(
  currentVersionCode: number,
  release: AppRelease,
  deferredUntil: number,
  now = Date.now(),
): "current" | "optional" | "deferred" | "forced" {
  if (release.versionCode <= currentVersionCode) return "current";
  if (release.forced || currentVersionCode < release.minimumSupportedVersionCode) return "forced";
  return deferredUntil > now ? "deferred" : "optional";
}
