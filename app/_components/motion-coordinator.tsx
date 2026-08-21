"use client";

import { useEffect } from "react";

const MOTION_SELECTOR = "[data-motion]";

export function MotionCoordinator() {
  useEffect(() => {
    document.documentElement.classList.add("zg-motion-ready");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canObserve = !reducedMotion && "IntersectionObserver" in window;
    const observed = new WeakSet<HTMLElement>();
    const observer = canObserve ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.motionState = "visible";
        observer?.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.12 }) : null;

    const register = (node: HTMLElement) => {
      if (observed.has(node)) return;
      observed.add(node);
      if (!observer) node.dataset.motionState = "visible";
      else observer.observe(node);
    };
    const scan = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(MOTION_SELECTOR)) register(root);
      root.querySelectorAll<HTMLElement>(MOTION_SELECTOR).forEach(register);
    };

    scan(document);
    const streamObserver = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) scan(node);
      }));
    });
    streamObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      streamObserver.disconnect();
      observer?.disconnect();
    };
  }, []);

  return null;
}
