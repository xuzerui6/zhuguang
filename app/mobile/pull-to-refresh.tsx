"use client";

import { ArrowDown, CircleCheck, CircleX, RefreshCw } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { impact, isNativeMobile } from "./device";
import {
  canStartPullRefresh,
  isVerticalPull,
  PULL_REFRESH_THRESHOLD,
  pullRefreshDistance,
  pullRefreshState,
} from "./pull-refresh-domain";
import type { PullRefreshResult, PullRefreshState } from "./types";

const BLOCKED_TARGETS = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='dialog']",
  ".zg-sheet-backdrop",
  ".zg-filter-summary",
  ".zg-coach-rail",
  ".zg-message-composer",
].join(",");

const stateCopy: Record<PullRefreshState, string> = {
  idle: "",
  pulling: "下拉刷新",
  armed: "松手刷新",
  refreshing: "正在刷新",
  success: "已更新",
  error: "刷新失败，请重试",
};

function stateIcon(state: PullRefreshState) {
  if (state === "refreshing") return RefreshCw;
  if (state === "success") return CircleCheck;
  if (state === "error") return CircleX;
  return ArrowDown;
}

function targetIsBlocked(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(BLOCKED_TARGETS));
}

function keyboardIsOpen() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable='true']")) return true;
  const viewport = window.visualViewport;
  return Boolean(viewport && viewport.height < window.innerHeight * 0.76);
}

export function PullToRefresh({
  disabled = false,
  onRefresh,
}: {
  disabled?: boolean;
  onRefresh: () => Promise<PullRefreshResult>;
}) {
  const [state, setState] = useState<PullRefreshState>("idle");
  const [distance, setDistance] = useState(0);
  const [message, setMessage] = useState("");
  const gesture = useRef({ active: false, crossed: false, startX: 0, startY: 0 });
  const frame = useRef<number | null>(null);
  const pendingDistance = useRef(0);
  const stateRef = useRef<PullRefreshState>("idle");
  const resetTimer = useRef<number | null>(null);
  const native = isNativeMobile();

  const commitState = useCallback((next: PullRefreshState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const commitDistance = useCallback((next: number) => {
    pendingDistance.current = next;
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      const visualDistance = pullRefreshDistance(pendingDistance.current);
      setDistance(visualDistance);
      const nextState = pullRefreshState(visualDistance);
      if (nextState !== stateRef.current && !["refreshing", "success", "error"].includes(stateRef.current)) {
        commitState(nextState);
      }
      if (nextState === "armed" && !gesture.current.crossed) {
        gesture.current.crossed = true;
        void impact("light");
      } else if (nextState === "pulling") {
        gesture.current.crossed = false;
      }
    });
  }, [commitState]);

  const settle = useCallback((nextState: "success" | "error", copy?: string) => {
    commitState(nextState);
    setMessage(copy || stateCopy[nextState]);
    setDistance(52);
    if (nextState === "success") void impact("light");
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setDistance(0);
      commitState("idle");
      setMessage("");
    }, nextState === "success" ? 720 : 1_100);
  }, [commitState]);

  useEffect(() => {
    if (!native || disabled) return;

    const onTouchStart = (event: TouchEvent) => {
      const blocked = targetIsBlocked(event.target) || keyboardIsOpen() || Boolean(document.querySelector("[aria-modal='true']"));
      const atTop = window.scrollY <= 1 && (document.scrollingElement?.scrollTop ?? 0) <= 1;
      if (!canStartPullRefresh({ atTop, blocked, refreshing: stateRef.current === "refreshing", touchCount: event.touches.length })) return;
      const touch = event.touches[0];
      gesture.current = { active: true, crossed: false, startX: touch.clientX, startY: touch.clientY };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture.current.active || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.current.startX;
      const deltaY = touch.clientY - gesture.current.startY;
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) >= Math.abs(deltaY)) {
        gesture.current.active = false;
        commitDistance(0);
        return;
      }
      if (!isVerticalPull(deltaX, deltaY)) return;
      event.preventDefault();
      commitDistance(deltaY);
    };

    const finishGesture = () => {
      if (!gesture.current.active) return;
      gesture.current.active = false;
      const shouldRefresh = pendingDistance.current >= PULL_REFRESH_THRESHOLD;
      pendingDistance.current = 0;
      gesture.current.crossed = false;
      if (!shouldRefresh) {
        setDistance(0);
        commitState("idle");
        return;
      }
      if (!navigator.onLine) {
        settle("error", "当前离线，无法刷新");
        return;
      }
      commitState("refreshing");
      setMessage(stateCopy.refreshing);
      setDistance(52);
      void onRefresh()
        .then((result) => settle(result.status, result.message))
        .catch((error: unknown) => settle("error", error instanceof Error ? error.message : undefined));
    };

    const cancelGesture = () => {
      gesture.current.active = false;
      gesture.current.crossed = false;
      pendingDistance.current = 0;
      if (stateRef.current !== "refreshing") {
        setDistance(0);
        commitState("idle");
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", finishGesture, { passive: true });
    document.addEventListener("touchcancel", cancelGesture, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", finishGesture);
      document.removeEventListener("touchcancel", cancelGesture);
    };
  }, [commitDistance, commitState, disabled, native, onRefresh, settle]);

  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  if (!native) return null;

  const icon = stateIcon(state);
  const progress = Math.min(1, distance / PULL_REFRESH_THRESHOLD);
  const visible = state !== "idle" || distance > 0;
  return (
    <div
      aria-hidden={!visible}
      className={`zg-pull-refresh is-${state}`}
      data-visible={visible}
      style={{ "--zg-pull-distance": `${distance}px` } as React.CSSProperties}
    >
      <span className="zg-pull-refresh-icon">
        {state === "pulling" || state === "armed" ? (
          <MorphIcon aria-hidden from={ArrowDown} progress={progress} reducedMotion="user" size={21} strokeWidth={2.2} to={RefreshCw} />
        ) : (
          <MorphIcon aria-hidden icon={icon} reducedMotion="user" size={21} spring="snappy" strokeWidth={2.2} />
        )}
      </span>
      <span aria-live="polite" className="zg-pull-refresh-copy">{message || stateCopy[state]}</span>
    </div>
  );
}
