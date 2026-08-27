import type { PullRefreshState } from "./types";

export const PULL_REFRESH_THRESHOLD = 72;
export const PULL_REFRESH_MAX_DISTANCE = 104;

export function pullRefreshDistance(rawDistance: number) {
  if (!Number.isFinite(rawDistance) || rawDistance <= 0) return 0;
  if (rawDistance <= PULL_REFRESH_THRESHOLD) return rawDistance;
  return Math.min(
    PULL_REFRESH_MAX_DISTANCE,
    PULL_REFRESH_THRESHOLD + (rawDistance - PULL_REFRESH_THRESHOLD) * 0.28,
  );
}

export function pullRefreshState(distance: number): PullRefreshState {
  if (distance <= 0) return "idle";
  return distance >= PULL_REFRESH_THRESHOLD ? "armed" : "pulling";
}

export function isVerticalPull(deltaX: number, deltaY: number) {
  return deltaY > 0 && deltaY > Math.abs(deltaX) * 1.15;
}

export function canStartPullRefresh(input: {
  atTop: boolean;
  blocked: boolean;
  refreshing: boolean;
  touchCount: number;
}) {
  return input.atTop && !input.blocked && !input.refreshing && input.touchCount === 1;
}
