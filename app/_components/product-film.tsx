"use client";

import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProductFilmManifest } from "../_lib/product-film";
import styles from "./public-site.module.css";

export function ProductFilm({ manifest }: { manifest: ProductFilmManifest }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAutoplayed = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video || !("IntersectionObserver" in window)) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const constrained = Boolean(connection?.saveData || connection?.effectiveType === "2g");
    if (reducedMotion || constrained || /MicroMessenger/i.test(navigator.userAgent)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting && !hasAutoplayed.current) {
        hasAutoplayed.current = true;
        video.play().catch(() => setPlaying(false));
      } else if (!entry.isIntersecting && !video.paused) {
        video.pause();
      }
    }, { threshold: 0.56 });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (ended) {
      video.currentTime = 0;
      setEnded(false);
    }
    if (video.paused) await video.play(); else video.pause();
  }

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  }

  return (
    <div className={styles.filmPlayer} ref={containerRef}>
      <video
        aria-label={manifest.title}
        className={styles.filmVideo}
        height={manifest.height}
        muted={muted}
        onEnded={() => { setEnded(true); setPlaying(false); }}
        onError={() => setFailed(true)}
        onPause={() => setPlaying(false)}
        onPlay={() => { setFailed(false); setPlaying(true); }}
        playsInline
        poster={manifest.poster}
        preload="metadata"
        ref={videoRef}
        width={manifest.width}
      >
        {manifest.sources.map((source) => <source key={source.src} src={source.src} type={source.type} />)}
        <track kind="captions" label="简体中文" src={manifest.captions} srcLang="zh-CN" />
      </video>
      <div className={styles.filmShade} aria-hidden />
      <div className={styles.filmControls}>
        <button aria-label={ended ? "重新播放" : playing ? "暂停影片" : "播放影片"} data-product-film-control onClick={togglePlayback} type="button">
          {ended ? <RotateCcw aria-hidden size={20} /> : playing ? <Pause aria-hidden size={20} /> : <Play aria-hidden size={20} />}
        </button>
        <div><strong>{failed ? "影片暂时无法加载" : manifest.title}</strong><span>{failed ? "仍可继续浏览完整服务流程" : `约 ${manifest.durationSeconds} 秒 · 默认静音`}</span></div>
        <button aria-label={muted ? "开启影片声音" : "关闭影片声音"} onClick={toggleSound} type="button">
          {muted ? <VolumeX aria-hidden size={20} /> : <Volume2 aria-hidden size={20} />}
        </button>
      </div>
    </div>
  );
}
