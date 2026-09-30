"use client";

import { type ReactNode, useRef, useState } from "react";
import styles from "./public-site.module.css";

export function CoachSpotlightCarousel({ children, count }: { children: ReactNode; count: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function updateProgress() {
    const track = trackRef.current;
    const firstCard = track?.firstElementChild as HTMLElement | null;
    if (!track || !firstCard) return;
    const step = firstCard.offsetWidth + Number.parseFloat(getComputedStyle(track).columnGap || "0");
    setActive(Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(step, 1)))));
  }

  return (
    <div className={styles.coachCarouselShell}>
      <div className={`${styles.coachSpotlightGrid} ${count === 1 ? styles.coachSpotlightSingle : ''}`} onScroll={updateProgress} ref={trackRef}>{children}</div>
      {count > 1 ? <div className={styles.coachCarouselProgress} aria-label={`正在查看第 ${Math.min(active + 1, count)} 位，共 ${count} 位教练`}>
        <span>左右滑动查看教练</span>
        <div aria-hidden>{Array.from({ length: count }, (_, index) => <i className={index === active ? styles.activeDot : undefined} key={index} />)}</div>
      </div> : null}
    </div>
  );
}
