import type { AccountMode, AppRelease, CoachAccountSummary, CoachTab, MobileTab } from "./types";

export type DeepLinkTarget = {
  coachTab?: CoachTab;
  mode?: AccountMode;
  studentTab?: MobileTab;
  updates?: boolean;
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

