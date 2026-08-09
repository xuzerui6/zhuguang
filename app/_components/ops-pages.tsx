"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudCog,
  Clock3,
  FileCheck2,
  Filter,
  HardDriveDownload,
  PauseCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  UsersRound,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { coaches, matchingRows, pilotBookings } from "../_lib/web-platform";
import styles from "./ops-pages.module.css";

export type OpsSection = "home" | "matching" | "coaches" | "bookings" | "users" | "content" | "releases";

export function OpsPage({ section }: { section: OpsSection }) {
  const [notice, setNotice] = useState("");
  function act(copy: string) { setNotice(copy); window.setTimeout(() => setNotice(""), 2200); }
  let content: React.ReactNode;
  if (section === "matching") content = <MatchingCenter />;
  else if (section === "coaches") content = <CoachOperations onAction={act} />;
  else if (section === "bookings") content = <BookingOperations onAction={act} />;
  else if (section === "users") content = <UserOperations onAction={act} />;
  else if (section === "content") content = <ContentOperations />;
  else if (section === "releases") content = <ReleaseRecords />;
  else content = <OpsHome />;
  return <>{content}{notice ? <div className={styles.toast} role="status"><Check aria-hidden size={16} />{notice}</div> : null}</>;
}

function Heading({ title, copy, action }: { action?: React.ReactNode; copy: string; title: string }) {
  return <header className={styles.heading}><div><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function OpsHome() {
  return (
    <div className={styles.opsPage}>
      <Heading action={<Link href="/ops/matching">进入匹配中心 <ArrowRight aria-hidden size={16} /></Link>} copy="北京私有试点的供需、履约和风险概览。" title="运营工作台" />
      <section className={styles.kpis}>
        <article><span className={styles.green}><UsersRound aria-hidden size={21} /></span><div><p>待匹配需求</p><strong>24</strong><small>较昨日 +8</small></div></article>
        <article><span className={styles.amber}><UserRoundCheck aria-hidden size={21} /></span><div><p>待教练确认</p><strong>9</strong><small>3 单接近响应时限</small></div></article>
        <article><span className={styles.blue}><CalendarCheck2 aria-hidden size={21} /></span><div><p>今日试课</p><strong>6</strong><small>4 个场馆</small></div></article>
        <article><span className={styles.coral}><AlertTriangle aria-hidden size={21} /></span><div><p>待处理风险</p><strong>3</strong><small>均已分配负责人</small></div></article>
      </section>
      <div className={styles.dashboardGrid}>
        <section className={styles.flowPanel}>
          <header><div><h2>今日服务流转</h2><p>从需求提交到试课完成的关键节点</p></div><span>截至 10:30</span></header>
          <div className={styles.flowSteps}><article><span>01</span><strong>新增需求</strong><b>18</b><small>进入匹配池</small></article><i /><article><span>02</span><strong>已推荐教练</strong><b>12</b><small>等待学员选择</small></article><i /><article><span>03</span><strong>待教练确认</strong><b>9</b><small>平均响应 31 分钟</small></article><i /><article><span>04</span><strong>今日试课</strong><b>6</b><small>场馆均已确认</small></article></div>
        </section>
        <aside className={styles.riskPanel}><header><h2>风险提醒</h2><Link href="/ops/users">查看全部</Link></header><article><AlertTriangle aria-hidden size={17} /><div><strong>学员连续 3 次申请改期</strong><p>预约 #ZG240764 · 10分钟前</p></div><ChevronRight aria-hidden size={16} /></article><article><Clock3 aria-hidden size={17} /><div><strong>教练确认即将超时</strong><p>3 笔预约剩余不足 30 分钟</p></div><ChevronRight aria-hidden size={16} /></article><article><ShieldCheck aria-hidden size={17} /><div><strong>资质将在 30 天内到期</strong><p>陈玮 · 儿童体适能认证</p></div><ChevronRight aria-hidden size={16} /></article></aside>
      </div>
      <section className={styles.queuePreview}><header><div><h2>最新匹配需求</h2><p>按更新时间排序，优先处理目标明确且时间临近的需求</p></div><Link href="/ops/matching">打开完整队列</Link></header><div className={styles.previewHeader}><span>学员</span><span>目标</span><span>区域</span><span>推荐教练</span><span>契合度</span><span>下一步</span></div>{matchingRows.slice(0, 4).map((row) => <Link href="/ops/matching" key={row.id}><span><strong>{row.learner}</strong><small>{row.age}岁 · {row.sport}</small></span><span><strong>{row.goal}</strong><small>更新时间 {row.updated}</small></span><span>{row.district}</span><span>{row.coach}</span><b>{row.score}%</b><em>{row.next}</em></Link>)}</section>
    </div>
  );
}

function MatchingCenter() {
  const [selectedId, setSelectedId] = useState<string>(matchingRows[0].id);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<"matching" | "profile" | "contact">("matching");
  const rows = useMemo(() => matchingRows.filter((row) => `${row.learner}${row.goal}${row.coach}${row.sport}`.includes(query.trim())), [query]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? matchingRows[0];
  const recommended = coaches.find((coach) => coach.name === selected.coach);
  function act(copy: string) { setNotice(copy); window.setTimeout(() => setNotice(""), 2000); }
  return (
    <div className={styles.opsPage}>
      <Heading copy="按训练目标、区域、时间、预算和服务对象审阅推荐结果。" title="匹配中心" />
      <section className={styles.matchMetrics}><article><span className={styles.green}><UsersRound aria-hidden size={20} /></span><p>待匹配<strong>24</strong></p></article><article><span className={styles.amber}><UserRoundCheck aria-hidden size={20} /></span><p>待确认<strong>9</strong></p></article><article><span className={styles.blue}><CalendarCheck2 aria-hidden size={20} /></span><p>今日试课<strong>6</strong></p></article></section>
      <div className={styles.matchLayout}>
        <section className={styles.matchTable}>
          <header className={styles.matchTools}><div><button onClick={() => act("已切换到我的默认匹配视图")} type="button">我的视图⌄</button><button onClick={() => act("当前筛选条件已保存为个人视图")} type="button">保存视图</button><button onClick={() => { setQuery(""); act("筛选条件已重置"); }} type="button">重置</button></div><label><Search aria-hidden size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="搜索学员、教练或目标" value={query} /></label></header>
          <div className={styles.advancedFilters}><select aria-label="匹配阶段"><option>全部阶段</option></select><select aria-label="学员来源"><option>全部来源</option></select><select aria-label="运动项目"><option>全部项目</option></select><select aria-label="所在区域"><option>全部区域</option></select><select aria-label="推荐教练"><option>全部教练</option></select><button onClick={() => act("年龄、预算、服务对象与风险筛选已展开")} type="button"><Filter aria-hidden size={15} />更多筛选</button></div>
          <div className={styles.matchHeader}><span /> <span>学员</span><span>目标</span><span>所在区域</span><span>推荐教练</span><span>契合度</span><span>下一步</span><span>更新时间</span></div>
          <div className={styles.matchRows}>{rows.map((row) => (
            <article className={`${styles.matchRow} ${selected.id === row.id ? styles.selectedMatch : ""}`} key={row.id}>
              <button
                aria-label={`查看${row.learner}的匹配详情`}
                className={styles.matchRowOpen}
                onClick={() => { setSelectedId(row.id); setInspectorOpen(true); }}
                type="button"
              />
              <label className={styles.matchCheck}><input aria-label={`选择${row.learner}`} type="checkbox" /></label>
              <span><i>{row.learner.slice(0, 1)}</i><b>{row.learner}<small>{row.age}岁 · {row.sport}</small></b></span>
              <span><b>{row.goal}</b><small>{row.sport}</small></span>
              <span><b>{row.district}</b><small>{row.coach === "徐泽瑞" ? "同区服务" : "通勤范围内"}</small></span>
              <span><i>{row.coach.slice(0, 1)}</i><b>{row.coach}<small>{row.coach === "徐泽瑞" ? "平台试点教练" : "资料已核验"}</small></b></span>
              <strong>{row.score}%<i><b style={{ width: `${row.score}%` }} /></i></strong>
              <em>{row.next}</em>
              <time>{row.updated}</time>
            </article>
          ))}</div>
        </section>
        {inspectorOpen ? <aside className={styles.matchInspector}>
          <header><div><h2>{selected.learner}</h2><p>{selected.age}岁 · {selected.sport} · {selected.district}</p></div><button aria-label="关闭详情" onClick={() => setInspectorOpen(false)} type="button">×</button></header>
          <nav><button className={inspectorTab === "matching" ? styles.inspectorActive : undefined} onClick={() => setInspectorTab("matching")} type="button">匹配详情</button><button className={inspectorTab === "profile" ? styles.inspectorActive : undefined} onClick={() => setInspectorTab("profile")} type="button">学员资料</button><button className={inspectorTab === "contact" ? styles.inspectorActive : undefined} onClick={() => setInspectorTab("contact")} type="button">沟通记录</button></nav>
          {inspectorTab !== "matching" ? <section className={styles.inspectorSummary}><h3>{inspectorTab === "profile" ? "学员资料摘要" : "最近沟通摘要"}</h3><p>{inspectorTab === "profile" ? `${selected.age}岁，北京${selected.district}，训练目标为${selected.goal}。联系方式仅向当前服务人员展示。` : "已在 10:20 完成一次预约前确认，当前没有未处理的服务消息。"}</p></section> : null}
          <section><h3>匹配理由</h3><ul><li><CheckCircle2 aria-hidden size={16} />训练目标与教练专长高度一致</li><li><CheckCircle2 aria-hidden size={16} />区域与服务对象符合当前需求</li><li><CheckCircle2 aria-hidden size={16} />{recommended?.bookable ? "本周有符合条件的真实可约时段" : "尚未发布真实时段，时间项暂不计分"}</li></ul></section>
          <section><header><h3>推荐教练</h3><Link href="/ops/coaches">查看档案</Link></header><div className={styles.recommendedCoach}><Image alt={`${selected.coach}教练`} height={54} src={recommended?.image ?? coaches[0].image} unoptimized width={54} /><span><strong>{selected.coach}<BadgeCheck aria-hidden size={13} /></strong><p>{recommended ? `${recommended.sport} · ${recommended.title}` : selected.sport}</p><small>契合度 {selected.score}%{recommended?.bookable === false ? " · 待发布时段" : ""}</small></span></div></section>
          <section><h3>风险提示</h3><p className={styles.riskNote}><AlertTriangle aria-hidden size={16} />学员近期存在 1 次迟到记录，请在试课前再次确认到场时间。</p></section>
          <section><h3>跟进时间线</h3><ol><li><time>10:24</time><span />系统推荐教练：{selected.coach}</li><li><time>10:20</time><span />运营转为待确认</li><li><time>10:18</time><span />学员提交训练需求</li></ol></section>
          <footer><button onClick={() => act(`已为${selected.learner}分配${selected.coach}教练`)} type="button">分配教练</button><button disabled={recommended?.bookable === false} onClick={() => act("试课任务已创建")} title={recommended?.bookable === false ? "发布真实时段后可创建试课" : undefined} type="button">{recommended?.bookable === false ? "待发布时段" : "创建试课"}</button><button onClick={() => act("需求已暂缓")} type="button">暂缓</button></footer>
        </aside> : <aside className={styles.matchInspectorCollapsed}><button onClick={() => setInspectorOpen(true)} type="button">打开学员详情 <ChevronRight aria-hidden size={16} /></button></aside>}
      </div>
      {notice ? <div className={styles.toast} role="status"><Check aria-hidden size={16} />{notice}</div> : null}
    </div>
  );
}

function CoachOperations({ onAction }: { onAction: (copy: string) => void }) {
  const [expiringOnly, setExpiringOnly] = useState(false);
  const rows = expiringOnly ? coaches.filter((_, index) => index === 3) : coaches;
  return <div className={styles.opsPage}><Heading action={<button aria-pressed={expiringOnly} className={styles.outlineAction} onClick={() => setExpiringOnly((current) => !current)} type="button"><SlidersHorizontal aria-hidden size={16} />{expiringOnly ? "查看全部教练" : "只看需复核"}</button>} copy="查看审核状态、服务能力、响应情况和资质有效期。" title="教练管理" /><section className={styles.entityTable}><header><span>教练</span><span>服务信息</span><span>履约表现</span><span>资质状态</span><span>账号状态</span><span>操作</span></header>{rows.map((coach) => { const index = coaches.findIndex((item) => item.id === coach.id); return <article key={coach.id}><span><Image alt="" height={44} src={coach.image} unoptimized width={44} /><b>{coach.name}<small>{coach.title}</small></b></span><span><strong>{coach.sport} · {coach.district}</strong><small>¥{coach.price}/课时 · {coach.lessons ? `${coach.lessons}节` : "尚无课量"}</small></span><span><strong>{coach.isNew ? "新教练" : `${coach.rating} / 5.0`}</strong><small>{coach.isNew ? "暂无评价与响应数据" : `平均响应 ${9 + index * 4} 分钟`}</small></span><span className={coach.isNew || index === 3 ? styles.statusAmber : styles.statusGreen}>{coach.isNew ? "专项资质待补充" : index === 3 ? "30天内到期" : "全部有效"}</span><span className={coach.bookable ? styles.statusGreen : styles.statusGray}>{coach.bookable ? "正常服务" : "待发布时段"}</span><button onClick={() => onAction(`${coach.name}的运营档案已打开`)} type="button">查看档案</button></article>; })}</section></div>;
}

function BookingOperations({ onAction }: { onAction: (copy: string) => void }) {
  return <div className={styles.opsPage}><Heading copy="集中查看预约状态、教练响应和服务异常。" title="预约履约" /><section className={styles.entityTable}><header><span>预约</span><span>学员</span><span>教练</span><span>时间与场馆</span><span>状态</span><span>操作</span></header>{pilotBookings.map((booking, index) => <article key={booking.id}><span><strong>#{booking.id}</strong><small>{booking.sport} · ¥{booking.price}</small></span><span><strong>{booking.learner}</strong><small>青少年专项提升</small></span><span><strong>周明</strong><small>已认证教练</small></span><span><strong>{booking.schedule}</strong><small>{booking.venue}</small></span><span className={index === 0 ? styles.statusAmber : index === 2 ? styles.statusBlue : styles.statusGreen}>{booking.status}</span><button onClick={() => onAction(`预约 ${booking.id} 的履约详情已打开`)} type="button">查看详情</button></article>)}</section></div>;
}

function UserOperations({ onAction }: { onAction: (copy: string) => void }) {
  const users = [{ name: "徐子轩", age: 12, phone: "138 **** 5678", bookings: 4, risk: "正常" }, { name: "王思涵", age: 14, phone: "136 **** 2091", bookings: 3, risk: "待回访" }, { name: "张子睿", age: 10, phone: "186 **** 4402", bookings: 1, risk: "正常" }, { name: "陈一诺", age: 13, phone: "139 **** 7730", bookings: 6, risk: "改期频繁" }];
  const [query, setQuery] = useState("");
  const rows = users.filter((user) => `${user.name}${user.phone}`.includes(query.trim()));
  return <div className={styles.opsPage}><Heading action={<label className={styles.headingSearch}><Search aria-hidden size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="搜索学员或手机号" value={query} /></label>} copy="按最小展示原则查看学员服务状态与跟进事项。" title="学员服务" /><section className={styles.entityTable}><header><span>学员</span><span>联系方式</span><span>训练目标</span><span>累计预约</span><span>服务状态</span><span>操作</span></header>{rows.map((user) => <article key={user.name}><span><i className={styles.userAvatar}>{user.name.slice(0, 1)}</i><b>{user.name}<small>{user.age}岁 · 北京</small></b></span><span><strong>{user.phone}</strong><small>手机号已验证</small></span><span><strong>专项提升</strong><small>羽毛球 · 青少年</small></span><span><strong>{user.bookings} 次</strong><small>最近 30 天</small></span><span className={user.risk === "正常" ? styles.statusGreen : styles.statusAmber}>{user.risk}</span><button onClick={() => onAction(`${user.name}的服务档案已打开`)} type="button">查看服务档案</button></article>)}</section></div>;
}

function ContentOperations() {
  const [published, setPublished] = useState(["服务协议", "隐私说明", "未成年人保护说明"]);
  const docs = [{ name: "服务协议", version: "v1.3", updated: "2026-07-28" }, { name: "隐私说明", version: "v1.2", updated: "2026-07-28" }, { name: "未成年人保护说明", version: "v1.1", updated: "2026-07-20" }, { name: "预约与取消规则", version: "v1.0", updated: "2026-07-18" }];
  return <div className={styles.opsPage}><Heading copy="维护试点协议、服务规则和官网说明，变更需保留版本记录。" title="内容与协议" /><section className={styles.contentList}>{docs.map((doc) => <article key={doc.name}><FileCheck2 aria-hidden size={22} /><div><h2>{doc.name}</h2><p>{doc.version} · 更新于 {doc.updated}</p></div><span className={published.includes(doc.name) ? styles.statusGreen : styles.statusGray}>{published.includes(doc.name) ? "已发布" : "草稿"}</span><button onClick={() => setPublished((current) => current.includes(doc.name) ? current.filter((item) => item !== doc.name) : [...current, doc.name])} type="button">{published.includes(doc.name) ? "转为草稿" : "发布"}</button></article>)}</section></div>;
}

type OperatorRelease = {
  artifactPresent: boolean;
  certificateSha256: string;
  forced: boolean;
  minimumSupportedVersionCode: number;
  notes: string[];
  publishedAt: number;
  rolloutPercentage: number;
  sha256: string;
  sizeBytes: number;
  status: "draft" | "paused" | "published";
  updatedAt: number;
  versionCode: number;
  versionName: string;
};

const releaseCertificate = "B3:3C:C9:74:31:DB:88:BF:07:02:AE:D7:92:74:D8:F2:BD:5E:D8:81:4D:B8:BB:74:7B:4C:19:63:EA:04:34:7B";

function formatReleaseSize(sizeBytes: number) {
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

function releaseStatus(status: OperatorRelease["status"]) {
  if (status === "published") return "已发布";
  if (status === "paused") return "已暂停";
  return "草稿";
}

async function releasePayload<T>(response: Response) {
  const payload = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || !payload.data) throw new Error(payload.error?.message || "发布服务暂时不可用");
  return payload.data;
}

function ReleaseRecords() {
  const [releases, setReleases] = useState<OperatorRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [artifact, setArtifact] = useState<File | null>(null);
  const [rollouts, setRollouts] = useState<Record<number, number>>({});
  const nextVersionCode = Math.max(0, ...releases.map((release) => release.versionCode)) + 1;

  const load = useCallback(async () => {
    try {
      const data = await releasePayload<OperatorRelease[]>(await fetch("/api/ops/releases", { cache: "no-store" }));
      setReleases(data);
      setRollouts(Object.fromEntries(data.map((release) => [release.versionCode, release.rolloutPercentage])));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "发布服务暂时不可用");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/ops/releases", { cache: "no-store" })
      .then((response) => releasePayload<OperatorRelease[]>(response))
      .then((data) => {
        if (!active) return;
        setReleases(data);
        setRollouts(Object.fromEntries(data.map((release) => [release.versionCode, release.rolloutPercentage])));
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "发布服务暂时不可用");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const act = useCallback(async (action: "notify" | "pause" | "policy" | "publish", release: OperatorRelease) => {
    setBusy(`${release.versionCode}-${action}`);
    try {
      const payload = action === "policy" ? {
        forced: release.forced,
        minimumSupportedVersionCode: release.minimumSupportedVersionCode,
        rolloutPercentage: rollouts[release.versionCode] ?? release.rolloutPercentage,
      } : undefined;
      await releasePayload(await fetch("/api/ops/releases", {
        body: JSON.stringify({ action, release: payload, versionCode: release.versionCode }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }));
      setNotice(action === "notify" ? "版本通知任务已进入队列" : action === "policy" ? "灰度策略已更新" : action === "pause" ? "版本分发已暂停" : "版本已发布");
      window.setTimeout(() => setNotice(""), 2400);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setBusy("");
    }
  }, [load, rollouts]);

  async function createRelease(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!artifact) { setError("请选择正式签名 APK"); return; }
    const versionCode = Number(form.get("versionCode"));
    const versionName = String(form.get("versionName") || "");
    setBusy("create");
    try {
      const upload = new FormData();
      upload.set("artifact", artifact);
      upload.set("versionCode", String(versionCode));
      upload.set("versionName", versionName);
      const uploaded = await releasePayload<{ objectKey: string; sha256: string; sizeBytes: number }>(await fetch("/api/ops/releases", { body: upload, method: "PUT" }));
      await releasePayload(await fetch("/api/ops/releases", {
        body: JSON.stringify({
          action: "create",
          release: {
            certificateSha256: releaseCertificate,
            forced: form.get("forced") === "on",
            minimumSupportedVersionCode: Number(form.get("minimumSupportedVersionCode")),
            notes: String(form.get("notes") || "").split("\n").map((note) => note.trim()).filter(Boolean),
            objectKey: uploaded.objectKey,
            packageId: "com.zhuguang.coachos",
            rolloutPercentage: Number(form.get("rolloutPercentage")),
            sha256: uploaded.sha256,
            sizeBytes: uploaded.sizeBytes,
            versionCode,
            versionName,
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }));
      setArtifact(null);
      setFormOpen(false);
      setNotice("安装包已校验并创建为草稿");
      window.setTimeout(() => setNotice(""), 2400);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "版本创建失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.opsPage}>
      <Heading action={<button className={styles.releaseCreateButton} disabled={Boolean(error) && !releases.length} onClick={() => setFormOpen((current) => !current)} type="button"><UploadCloud aria-hidden size={16} />{formOpen ? "收起" : "上传新版本"}</button>} copy="管理正式签名 APK、灰度比例、最低支持版本与设备通知。" title="版本发布" />
      <section className={`${styles.storageNotice} ${error ? styles.storageError : styles.storageReady}`}>
        {error ? <AlertTriangle aria-hidden size={28} /> : <CloudCog aria-hidden size={28} />}
        <div><h2>{error ? "发布服务需要检查" : loading ? "正在读取发布状态" : "D1 与私有 R2 已连接"}</h2><p>{error || (loading ? "正在从手机 API 获取真实版本记录。" : "APK 保存在非公开 R2，仅通过五分钟下载票据提供给已安装设备。")}</p></div>
        {error ? <button onClick={() => { setLoading(true); void load(); }} type="button"><RefreshCw aria-hidden size={15} />重试</button> : <span>{loading ? "检查中" : `${releases.length} 个版本`}</span>}
      </section>

      {formOpen ? <form className={styles.releaseForm} onSubmit={createRelease}>
        <header><div><h2>创建 Android 版本</h2><p>上传后先进入草稿，确认清单无误再发布。</p></div><ShieldCheck aria-hidden size={22} /></header>
        <label><span>版本号</span><input name="versionName" pattern="\d+\.\d+\.\d+" placeholder="例如 1.2.4" required /></label>
        <label><span>versionCode</span><input defaultValue={nextVersionCode} key={nextVersionCode} min="1" name="versionCode" required type="number" /></label>
        <label><span>最低支持 code</span><input defaultValue="5" min="1" name="minimumSupportedVersionCode" required type="number" /></label>
        <label><span>灰度比例</span><select defaultValue="100" name="rolloutPercentage"><option value="10">10%</option><option value="50">50%</option><option value="100">100%</option></select></label>
        <label className={styles.releaseArtifact}><span>正式 APK</span><input accept=".apk,application/vnd.android.package-archive" onChange={(event) => setArtifact(event.target.files?.[0] ?? null)} required type="file" /><small>{artifact ? `${artifact.name} · ${formatReleaseSize(artifact.size)}` : "仅接受不超过 50 MB 的 .apk"}</small></label>
        <label className={styles.releaseNotes}><span>更新说明</span><textarea name="notes" placeholder={"每行一项，例如：\n优化版本中心状态\n提升启动稳定性"} required rows={3} /></label>
        <label className={styles.releaseForced}><input name="forced" type="checkbox" /><span>设为强制更新</span></label>
        <footer><button disabled={busy === "create"} type="submit">{busy === "create" ? "正在校验并上传" : "创建版本草稿"}</button><button onClick={() => setFormOpen(false)} type="button">取消</button></footer>
      </form> : null}

      <section className={styles.releaseTable}>
        <header><span>版本</span><span>构建与文件</span><span>签名校验</span><span>灰度</span><span>状态</span><span>操作</span></header>
        {!loading && !releases.length ? <div className={styles.releaseEmpty}><HardDriveDownload aria-hidden size={24} /><strong>暂无版本记录</strong><p>上传正式签名 APK 后，版本会先进入草稿。</p></div> : null}
        {releases.map((release) => <article key={release.versionCode}>
          <span><strong>{release.versionName}</strong><small>versionCode {release.versionCode}</small><small>{release.notes[0] || "无更新说明"}</small></span>
          <span><strong>{formatReleaseSize(release.sizeBytes)}</strong><small>{release.artifactPresent ? "R2 文件已核对" : "R2 文件缺失"}</small><small>{new Date(release.updatedAt).toLocaleString("zh-CN", { hour12: false })}</small></span>
          <span><ShieldCheck aria-hidden size={16} /><small>{release.certificateSha256.slice(0, 17)}...</small></span>
          <span className={styles.releaseRollout}><select aria-label={`${release.versionName}灰度比例`} onChange={(event) => setRollouts((current) => ({ ...current, [release.versionCode]: Number(event.target.value) }))} value={rollouts[release.versionCode] ?? release.rolloutPercentage}><option value="10">10%</option><option value="50">50%</option><option value="100">100%</option></select><button disabled={busy === `${release.versionCode}-policy`} onClick={() => void act("policy", release)} type="button">保存</button></span>
          <span className={release.status === "published" ? styles.statusGreen : release.status === "paused" ? styles.statusAmber : styles.statusGray}>{releaseStatus(release.status)}</span>
          <span className={styles.releaseActions}>{release.status === "published" ? <button disabled={busy.startsWith(`${release.versionCode}-`)} onClick={() => void act("pause", release)} type="button"><PauseCircle aria-hidden size={14} />暂停</button> : <button disabled={!release.artifactPresent || busy.startsWith(`${release.versionCode}-`)} onClick={() => void act("publish", release)} type="button">发布</button>}{release.status === "published" ? <button disabled={busy.startsWith(`${release.versionCode}-`)} onClick={() => void act("notify", release)} type="button"><Send aria-hidden size={14} />通知</button> : null}</span>
        </article>)}
      </section>
      {notice ? <div className={styles.toast} role="status"><Check aria-hidden size={16} />{notice}</div> : null}
    </div>
  );
}
