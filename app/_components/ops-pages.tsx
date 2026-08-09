"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Filter,
  HardDriveDownload,
  PauseCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { coaches, featureFlags, matchingRows, pilotBookings } from "../_lib/web-platform";
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
              <span><b>{row.district}</b><small>距 6.2km</small></span>
              <span><i>{row.coach.slice(0, 1)}</i><b>{row.coach}<small>已认证</small></b></span>
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
          <section><h3>匹配理由</h3><ul><li><CheckCircle2 aria-hidden size={16} />训练目标与教练专长高度一致</li><li><CheckCircle2 aria-hidden size={16} />教练本周有符合条件的可约时段</li><li><CheckCircle2 aria-hidden size={16} />场馆通勤距离在预设范围内</li></ul></section>
          <section><header><h3>推荐教练</h3><Link href="/ops/coaches">查看档案</Link></header><div className={styles.recommendedCoach}><Image alt="周明教练" height={54} src={coaches[0].image} unoptimized width={54} /><span><strong>{selected.coach}<BadgeCheck aria-hidden size={13} /></strong><p>羽毛球 · 国家一级运动员</p><small>契合度 {selected.score}%</small></span></div></section>
          <section><h3>风险提示</h3><p className={styles.riskNote}><AlertTriangle aria-hidden size={16} />学员近期存在 1 次迟到记录，请在试课前再次确认到场时间。</p></section>
          <section><h3>跟进时间线</h3><ol><li><time>10:24</time><span />系统推荐教练：{selected.coach}</li><li><time>10:20</time><span />运营转为待确认</li><li><time>10:18</time><span />学员提交训练需求</li></ol></section>
          <footer><button onClick={() => act(`已为${selected.learner}分配${selected.coach}教练`)} type="button">分配教练</button><button onClick={() => act("试课任务已创建")} type="button">创建试课</button><button onClick={() => act("需求已暂缓")} type="button">暂缓</button></footer>
        </aside> : <aside className={styles.matchInspectorCollapsed}><button onClick={() => setInspectorOpen(true)} type="button">打开学员详情 <ChevronRight aria-hidden size={16} /></button></aside>}
      </div>
      {notice ? <div className={styles.toast} role="status"><Check aria-hidden size={16} />{notice}</div> : null}
    </div>
  );
}

function CoachOperations({ onAction }: { onAction: (copy: string) => void }) {
  const [expiringOnly, setExpiringOnly] = useState(false);
  const rows = expiringOnly ? coaches.filter((_, index) => index === 3) : coaches;
  return <div className={styles.opsPage}><Heading action={<button aria-pressed={expiringOnly} className={styles.outlineAction} onClick={() => setExpiringOnly((current) => !current)} type="button"><SlidersHorizontal aria-hidden size={16} />{expiringOnly ? "查看全部教练" : "只看需复核"}</button>} copy="查看审核状态、服务能力、响应情况和资质有效期。" title="教练管理" /><section className={styles.entityTable}><header><span>教练</span><span>服务信息</span><span>履约表现</span><span>资质状态</span><span>账号状态</span><span>操作</span></header>{rows.map((coach) => { const index = coaches.findIndex((item) => item.id === coach.id); return <article key={coach.id}><span><Image alt="" height={44} src={coach.image} unoptimized width={44} /><b>{coach.name}<small>{coach.title}</small></b></span><span><strong>{coach.sport} · {coach.district}</strong><small>¥{coach.price}/课时 · {coach.lessons}节</small></span><span><strong>{coach.rating} / 5.0</strong><small>平均响应 {9 + index * 4} 分钟</small></span><span className={index === 3 ? styles.statusAmber : styles.statusGreen}>{index === 3 ? "30天内到期" : "全部有效"}</span><span className={styles.statusGreen}>正常服务</span><button onClick={() => onAction(`${coach.name}的运营档案已打开`)} type="button">查看档案</button></article>; })}</section></div>;
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

function ReleaseRecords() {
  return <div className={styles.opsPage}><Heading copy="当前仅保留已构建版本的审计记录，真实 APK 分发暂缓。" title="版本记录" /><section className={styles.storageNotice}><PauseCircle aria-hidden size={28} /><div><h2>APK 在线分发暂未启用</h2><p>由于 R2 存储尚未开通，本页面不会显示上传或发布按钮，也不会向设备返回不可用的下载地址。现有 Android 包继续用于本地私有测试。</p></div><span>R2_ENABLED = false</span></section><section className={styles.releaseTable}><header><span>版本</span><span>构建信息</span><span>签名</span><span>分发状态</span><span>说明</span></header><article><span><strong>1.1.1</strong><small>versionCode 4</small></span><span><strong>Android release APK</strong><small>2026-07-27 21:40</small></span><span><ShieldCheck aria-hidden size={16} />正式签名已验证</span><span className={styles.statusGray}>仅本地测试</span><p>统一双身份与更新中心验收版本</p></article><article><span><strong>1.1.0</strong><small>versionCode 3</small></span><span><strong>Android release APK</strong><small>2026-07-26 18:10</small></span><span><ShieldCheck aria-hidden size={16} />正式签名已验证</span><span className={styles.statusGray}>已归档</span><p>首个统一双身份版本</p></article></section><section className={styles.releaseNext}><HardDriveDownload aria-hidden size={23} /><div><strong>恢复分发的前置条件</strong><p>完成 R2 开通、短时下载票据、HTTPS 手机 API 和真机升级验证后，再开放版本创建与灰度发布。</p></div></section>{featureFlags.r2Updates ? <button type="button">创建版本</button> : null}</div>;
}
