"use client";

import type { ReactNode } from "react";

export function ProductFilmLink({ children }: { children: ReactNode }) {
  function openFilm() {
    const section = document.getElementById("product-film");
    if (!section) return;

    window.history.pushState(null, "", "#product-film");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alignSection = () => section.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });

    alignSection();
    window.setTimeout(() => {
      alignSection();
      section.querySelector<HTMLElement>("[data-product-film-control]")?.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 240);
  }

  return <button onClick={openFilm} type="button">{children}</button>;
}
