"use client";

import { useEffect, type ReactNode } from "react";

export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => document.documentElement.setAttribute("data-motion", media.matches ? "reduced" : "full");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return children;
}

export function RouteTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  return <div className="zg-route-transition" key={routeKey}>{children}</div>;
}
