"use client";

import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MOTION_DURATION_MS, type NavigationMotionDirection, type NavigationMotionIntent, webRouteMotion } from "../../shared/motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => document.documentElement.setAttribute("data-motion", media.matches ? "reduced" : "full");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return <LazyMotion features={domAnimation} strict><MotionConfig reducedMotion="user">{children}</MotionConfig></LazyMotion>;
}

type SceneProps = {
  children: ReactNode;
  className?: string;
  direction: NavigationMotionDirection;
  intent: NavigationMotionIntent;
  sceneKey: string;
};

function sceneOffset(intent: NavigationMotionIntent, direction: NavigationMotionDirection) {
  if (intent === "tab") return { enterX: 0, exitX: 0, enterY: 0 };
  if (intent === "role") return { enterX: 0, exitX: 0, enterY: 4 };
  if (direction === "backward" || intent === "pop") return { enterX: -10, exitX: 5, enterY: 0 };
  return { enterX: 10, exitX: -5, enterY: 0 };
}

function Scene({ children, className, direction, intent, sceneKey }: SceneProps) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const offset = sceneOffset(intent, direction);
  const duration = reducedMotion ? 0.08 : (intent === "role" ? MOTION_DURATION_MS.role : intent === "tab" ? MOTION_DURATION_MS.tab : MOTION_DURATION_MS.content) / 1000;
  useEffect(() => {
    if (intent !== "push" || direction !== "forward") return;
    const frame = window.requestAnimationFrame(() => {
      const title = sceneRef.current?.querySelector<HTMLElement>("h1");
      if (!title) return;
      if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [direction, intent, sceneKey]);
  return (
    <m.div
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      aria-hidden={!present}
      className={className}
      data-motion-intent={intent}
      exit={{ opacity: 0, scale: reducedMotion || intent !== "role" ? 1 : 0.995, x: reducedMotion ? 0 : offset.exitX, y: 0 }}
      initial={{ opacity: 0, scale: reducedMotion || intent !== "role" ? 1 : 0.995, x: reducedMotion ? 0 : offset.enterX, y: reducedMotion ? 0 : offset.enterY }}
      key={sceneKey}
      ref={sceneRef}
      style={{ pointerEvents: present ? "auto" : "none" }}
      transition={{ duration, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </m.div>
  );
}

export function MotionStage(props: SceneProps & { stageClassName?: string }) {
  const { stageClassName, ...scene } = props;
  return <div className={stageClassName ?? "zg-motion-stage"}><AnimatePresence initial={false} mode="sync" custom={scene.direction}><Scene {...scene} key={scene.sceneKey} /></AnimatePresence></div>;
}

export function RouteTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const [routes, setRoutes] = useState<{ current: string; previous: string | null }>({ current: routeKey, previous: null });
  if (routes.current !== routeKey) setRoutes({ current: routeKey, previous: routes.current });
  const motion = webRouteMotion(routes.previous, routeKey);
  return <MotionStage className="zg-route-transition" direction={motion.direction} intent={motion.intent} sceneKey={routeKey}>{children}</MotionStage>;
}
