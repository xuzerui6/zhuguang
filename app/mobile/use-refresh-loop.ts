"use client";
import { useEffect, useMemo } from "react";
import { createRefreshLoop } from "./network-policy";
import type { PullRefreshResult } from "./types";

export function useRefreshLoop(task: () => Promise<PullRefreshResult>, enabled: boolean) {
  const loop = useMemo(() => createRefreshLoop(task, {
    set: (callback, delay) => window.setTimeout(callback, delay),
    clear: (id) => window.clearTimeout(id as number | undefined),
  }, () => document.visibilityState === "visible" && navigator.onLine), [task]);
  useEffect(() => { if (enabled) loop.start(); return () => loop.stop(); }, [enabled, loop]);
  return loop.run;
}
