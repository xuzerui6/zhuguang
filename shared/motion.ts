export type NavigationMotionIntent = "tab" | "push" | "pop" | "role";
export type NavigationMotionDirection = "backward" | "forward" | "none";

export type NavigationMotionState = {
  direction: NavigationMotionDirection;
  intent: NavigationMotionIntent;
  sequence: number;
};

export const MOTION_DURATION_MS = {
  instant: 120,
  tab: 170,
  content: 220,
  role: 260,
} as const;

export const STUDENT_TAB_ORDER = ["home", "discover", "bookings", "messages", "profile"] as const;
export const COACH_TAB_ORDER = ["workspace", "appointments", "schedule", "messages", "profile"] as const;
export const MINIAPP_COACH_TAB_ORDER = ["workspace", "requests", "schedule", "messages", "profile"] as const;

export function tabDirection<T extends string>(order: readonly T[], current: T, next: T): NavigationMotionDirection {
  if (current === next) return "none";
  const currentIndex = order.indexOf(current);
  const nextIndex = order.indexOf(next);
  if (currentIndex < 0 || nextIndex < 0) return "none";
  return nextIndex > currentIndex ? "forward" : "backward";
}

export function nextMotion(
  current: NavigationMotionState,
  intent: NavigationMotionIntent,
  direction: NavigationMotionDirection,
): NavigationMotionState {
  return { direction, intent, sequence: current.sequence + 1 };
}

function pathArea(pathname: string) {
  if (pathname.startsWith("/coach-workspace")) return "coach";
  if (pathname.startsWith("/student")) return "student";
  if (pathname.startsWith("/ops")) return "ops";
  return "public";
}

const routeOrder: Record<string, readonly string[]> = {
  coach: ["/coach-workspace", "/coach-workspace/appointments", "/coach-workspace/schedule", "/coach-workspace/messages", "/coach-workspace/profile"],
  ops: ["/ops", "/ops/matching", "/ops/bookings", "/ops/coaches", "/ops/profile-review", "/ops/users", "/ops/reviews", "/ops/support", "/ops/content", "/ops/audit", "/ops/releases"],
  student: ["/student", "/student/coaches", "/student/bookings", "/student/messages", "/student/training", "/student/profile"],
};

function routeIndex(area: string, pathname: string) {
  const routes = routeOrder[area];
  if (!routes) return -1;
  const exact = routes.indexOf(pathname);
  if (exact >= 0) return exact;
  return routes.findIndex((route) => route !== `/${area}` && pathname.startsWith(`${route}/`));
}

export function webRouteMotion(previousPath: string | null, nextPath: string): Pick<NavigationMotionState, "direction" | "intent"> {
  if (!previousPath || previousPath === nextPath) return { direction: "none", intent: "tab" };
  const previousArea = pathArea(previousPath);
  const nextArea = pathArea(nextPath);
  if (previousArea !== nextArea) return { direction: "none", intent: "role" };
  const knownRoutes = routeOrder[nextArea] ?? [];
  const previousIsTab = knownRoutes.includes(previousPath);
  const nextIsTab = knownRoutes.includes(nextPath);
  if (previousIsTab && !nextIsTab && nextPath.startsWith(`${previousPath}/`)) return { direction: "forward", intent: "push" };
  if (!previousIsTab && nextIsTab && previousPath.startsWith(`${nextPath}/`)) return { direction: "backward", intent: "pop" };
  const previousIndex = routeIndex(nextArea, previousPath);
  const nextIndex = routeIndex(nextArea, nextPath);
  if (previousIndex >= 0 && nextIndex >= 0) {
    return { direction: nextIndex >= previousIndex ? "forward" : "backward", intent: "tab" };
  }
  const previousDepth = previousPath.split("/").filter(Boolean).length;
  const nextDepth = nextPath.split("/").filter(Boolean).length;
  return nextDepth < previousDepth
    ? { direction: "backward", intent: "pop" }
    : { direction: "forward", intent: "push" };
}
