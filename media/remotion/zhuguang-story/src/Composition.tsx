import { Audio } from "@remotion/media";
import { AbsoluteFill, Composition, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";

const FPS = 30;
const SCENE = 180;
const green = "#087a46";
const dark = "#06130f";
const ivory = "#ecfff2";
const captions = [
  "专业训练，从真实目标开始。先说明项目、区域和你想达到的目标。",
  "查看经过确认的教练档案，比较经历、方向和服务是否适合。",
  "从咨询到教练确认，每一步都有状态，费用和安排清楚可查。",
  "课程结束不是终点。把每一次训练，变成持续可见的进步。",
];

const enter = (frame: number, delay = 0) => interpolate(frame, [delay, delay + 20], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const sceneOpacity = (frame: number) => interpolate(frame, [0, 10, 168, 180], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

function Caption({ index }: { index: number }) {
  const frame = useCurrentFrame();
  return <div style={{ background: "rgba(3,13,9,.78)", borderRadius: 6, bottom: 142, color: ivory, fontSize: 28, left: "50%", lineHeight: 1.5, opacity: enter(frame, 16), padding: "13px 24px", position: "absolute", textAlign: "center", translate: "-50% 0", width: 1320, zIndex: 30 }}>{captions[index]}</div>;
}

function Brand({ full = false }: { full?: boolean }) {
  return <div style={{ alignItems: "center", bottom: 74, display: "flex", gap: 18, left: 132, position: "absolute", zIndex: 20 }}><Img src={staticFile("assets/icon.png")} style={{ borderRadius: 16, height: 64, width: 64 }} /><strong style={{ color: ivory, fontSize: 30 }}>{full ? "逐光运动教练服务平台" : "逐光"}</strong></div>;
}

function GoalScene() {
  const frame = useCurrentFrame();
  const sceneExit = interpolate(frame, [SCENE - 12, SCENE], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <AbsoluteFill style={{ background: dark, opacity: sceneExit }}>
    <Img src={staticFile("assets/hero.webp")} style={{ height: "100%", objectFit: "cover", scale: interpolate(frame, [0, 178], [1.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), width: "100%" }} />
    <AbsoluteFill style={{ background: "linear-gradient(90deg,rgba(2,12,8,.94),rgba(2,12,8,.56) 48%,rgba(2,12,8,.06))" }} />
    <div style={{ left: 132, position: "absolute", top: 132, width: 1060 }}><p style={{ color: "#75d5a2", fontSize: 28, fontWeight: 800, margin: 0, opacity: enter(frame, 5) }}>先说清楚，你想练什么</p><h1 style={{ color: ivory, fontSize: 94, lineHeight: 1.1, margin: "28px 0", opacity: enter(frame, 16), translate: `0 ${interpolate(frame, [16, 36], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px` }}>专业训练，<br />从真实目标开始</h1><p style={{ color: "rgba(236,255,242,.72)", fontSize: 31, lineHeight: 1.7, opacity: enter(frame, 34) }}>项目、区域、时间和训练目标进入同一份需求档案。</p></div>
    <Brand full /><Caption index={0} />
  </AbsoluteFill>;
}

const coaches = [
  ["徐泽瑞", "田径 · 通州区", "assets/coach-xu.webp"],
  ["张展祁", "田赛专项 · 通州区", "assets/coach-zhang.webp"],
  ["郝健壮", "田径专项 · 通州区", "assets/coach-hao.webp"],
];

function CoachesScene() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#f6f8f7", color: "#101815", opacity: sceneOpacity(frame), padding: "76px 132px" }}><p style={{ color: green, fontSize: 27, fontWeight: 800, margin: 0 }}>真实教练档案</p><h2 style={{ fontSize: 66, lineHeight: 1.15, margin: "16px 0 34px" }}>看经历，也看服务是否适合</h2><div style={{ display: "grid", gap: 26, gridTemplateColumns: "repeat(3,1fr)" }}>{coaches.map(([name, meta, image], index) => <article key={name} style={{ background: "#fff", border: "1px solid #dfe5e1", height: 720, opacity: enter(frame, 14 + index * 8), overflow: "hidden", translate: `0 ${interpolate(frame, [14 + index * 8, 34 + index * 8], [34, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px` }}><Img src={staticFile(image)} style={{ height: 520, objectFit: "cover", objectPosition: "center 18%", width: "100%" }} /><div style={{ padding: "27px 30px" }}><strong style={{ display: "block", fontSize: 36 }}>{name}</strong><span style={{ color: green, display: "block", fontSize: 21, marginTop: 12 }}>{meta}</span></div></article>)}</div><Caption index={1} /></AbsoluteFill>;
}

const steps = [["01", "沟通训练需求", "不制造虚假时段，先确认目标和场地。"], ["02", "教练确认后生效", "课程信息和费用快照保持清晰。"]];

function ServiceScene() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#edf5f1", color: "#101815", opacity: sceneOpacity(frame), padding: "66px 132px" }}><p style={{ color: green, fontSize: 27, fontWeight: 800, margin: 0 }}>服务状态清楚可见</p><div style={{ background: "#fff", border: "1px solid #d8e1dc", borderRadius: 24, boxShadow: "0 38px 90px rgba(5,35,22,.14)", display: "grid", gap: 50, gridTemplateColumns: "1fr 360px", height: 835, marginTop: 24, opacity: enter(frame, 8), overflow: "hidden", padding: 54, scale: interpolate(frame, [8, 30], [.985, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}><div><h2 style={{ fontSize: 68, lineHeight: 1.15, margin: "8px 0 44px" }}>从咨询到确认，<br />每一步都有记录</h2><div style={{ display: "grid", gap: 28 }}>{steps.map(([number, title, copy], index) => <div key={number} style={{ borderTop: "1px solid #d9e2dd", display: "grid", gap: 20, gridTemplateColumns: "58px 1fr", opacity: enter(frame, 32 + index * 12), paddingTop: 28, translate: `${interpolate(frame, [32 + index * 12, 52 + index * 12], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px 0` }}><b style={{ color: green, fontSize: 21 }}>{number}</b><div><strong style={{ fontSize: 31 }}>{title}</strong><p style={{ color: "#66736d", fontSize: 22, lineHeight: 1.55, margin: "9px 0 0" }}>{copy}</p></div></div>)}</div></div><Img src={staticFile("assets/app.webp")} style={{ alignSelf: "end", border: "10px solid #17251f", borderRadius: 38, height: 700, objectFit: "cover", objectPosition: "top", width: 322 }} /></div><Caption index={2} /></AbsoluteFill>;
}

function FinalScene() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: dark, color: ivory, opacity: sceneOpacity(frame), padding: "120px 132px" }}><p style={{ color: "#75d5a2", fontSize: 28, fontWeight: 800, margin: 0, opacity: enter(frame, 5) }}>训练不是一次交易</p><div style={{ background: "#ff835c", height: 8, marginTop: 54, scale: `${enter(frame, 18)} 1`, transformOrigin: "left", width: 180 }} /><h2 style={{ fontSize: 96, lineHeight: 1.12, margin: "38px 0 28px", maxWidth: 1300, opacity: enter(frame, 12), translate: `0 ${interpolate(frame, [12, 32], [32, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px` }}>把每一次训练，<br />变成持续可见的进步</h2><p style={{ color: "rgba(236,255,242,.72)", fontSize: 31, opacity: enter(frame, 34) }}>教练、预约、沟通与训练记录，都在逐光。</p><Brand /><div style={{ bottom: 84, color: "rgba(236,255,242,.62)", fontSize: 25, position: "absolute", right: 132 }}>beijingzhuguang.top</div><Caption index={3} /></AbsoluteFill>;
}

function ProductFilm() {
  return <AbsoluteFill style={{ background: dark, fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif' }}><Sequence durationInFrames={SCENE}><GoalScene /></Sequence><Sequence durationInFrames={SCENE} from={SCENE}><CoachesScene /></Sequence><Sequence durationInFrames={SCENE} from={SCENE * 2}><ServiceScene /></Sequence><Sequence durationInFrames={SCENE} from={SCENE * 3}><FinalScene /></Sequence>{[0, 1, 2, 3].map((index) => <Sequence durationInFrames={SCENE - 12} from={index * SCENE + 12} key={index}><Audio src={staticFile(`audio/scene-${index + 1}.wav`)} volume={0.92} /></Sequence>)}</AbsoluteFill>;
}

export function MyComposition() {
  return <Composition component={ProductFilm} durationInFrames={24 * FPS} fps={FPS} height={1080} id="ZhuguangProductFilm" width={1920} />;
}
