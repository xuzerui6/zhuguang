"use client";

import { useEffect, useState } from "react";
import styles from "./async-states.module.css";

export function LoadingState({ label, variant = "list" }: { label: string; variant?: "detail" | "list" | "table" }) {
  const [visible, setVisible] = useState(false);
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    const reveal = window.setTimeout(() => setVisible(true), 150);
    const explain = window.setTimeout(() => setLongWait(true), 2_000);
    return () => { window.clearTimeout(reveal); window.clearTimeout(explain); };
  }, []);
  if (!visible) return <div className={styles.reserve} aria-hidden />;
  return <div aria-label={longWait ? label : "正在读取内容"} className={styles.loading} data-variant={variant} role="status">
    <div className={styles.skeleton} aria-hidden><span className={styles.heading} /><span className={styles.line} /><span className={styles.lineShort} />{variant !== "detail" ? <><span className={styles.row} /><span className={styles.row} /><span className={styles.row} /></> : <span className={styles.detail} />}</div>
    {longWait ? <p>{label}，网络较慢时会保留现有内容并继续尝试。</p> : null}
  </div>;
}

export function ProgressBar({ label, value }: { label: string; value: number }) {
  const progress = Math.max(0, Math.min(100, Math.round(value)));
  return <div className={styles.progress} role="progressbar" aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress}><span style={{ transform: `scaleX(${progress / 100})` }} /><small>{label} {progress}%</small></div>;
}
