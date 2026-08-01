"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import MobileStudentApp from "./mobile-student-app";

type Surface = "command" | "web" | "mobile" | "apps" | "coach" | "ops";
type DeviceClass = "phone" | "tablet" | "desktop";
type RouteMode = "auto" | "link" | "manual";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type DeviceProfile = {
  deviceClass: DeviceClass;
  os: string;
  browser: string;
  input: string;
  recommendedSurface: Surface;
  title: string;
  detail: string;
};

type NavigatorWithUAData = Navigator & {
  standalone?: boolean;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
};

type NavItem = {
  id: string;
  surface: Surface;
  label: string;
  desc: string;
  code: string;
  badge?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type Coach = {
  id: number;
  name: string;
  sport: string;
  city: string;
  level: string;
  title: string;
  price: number;
  rating: number;
  lessons: number;
  reviewCount: number;
  response: string;
  status: "优先推荐" | "平台已核验" | "复核中";
  fit: number;
  audience: string[];
  goals: string[];
  strengths: string[];
  proof: string[];
  availability: string[];
  note: string;
  accent: string;
};

const surfaces: Array<{ id: Surface; label: string; desc: string; code: string }> = [
  { id: "command", label: "PC 工作台", desc: "匹配、档案、排期和履约", code: "01" },
  { id: "web", label: "浏览器介绍", desc: "面向学员和教练的产品入口", code: "02" },
  { id: "mobile", label: "手机端", desc: "学员移动预约流程", code: "03" },
  { id: "apps", label: "应用版本", desc: "iOS、Android、Windows、Linux、macOS 五端原生工程", code: "04" },
  { id: "coach", label: "教练端", desc: "入驻、线索和服务经营", code: "05" },
  { id: "ops", label: "运营端", desc: "审核、风险和转化看板", code: "06" },
];

const navGroups: NavGroup[] = [
  {
    title: "智能工作台",
    items: [
      { id: "match-queue", surface: "command", label: "推荐队列", desc: "画像、Fit 排序、解释推荐", code: "MQ", badge: "34" },
      { id: "trial-schedule", surface: "command", label: "试课排期", desc: "时间、场地、跟进节奏", code: "TS", badge: "9" },
      { id: "fulfillment", surface: "command", label: "履约回访", desc: "课后反馈、复购、异常处理", code: "FV" },
    ],
  },
  {
    title: "学员服务",
    items: [
      { id: "student-match", surface: "mobile", label: "找教练", desc: "移动端快速匹配与比较", code: "SM" },
      { id: "booking-flow", surface: "mobile", label: "预约确认", desc: "试课确认、提醒、订单状态", code: "BK", badge: "2" },
      { id: "web-entry", surface: "web", label: "网页介绍", desc: "平台价值、信任机制、转化入口", code: "WE" },
    ],
  },
  {
    title: "教练供给",
    items: [
      { id: "coach-onboard", surface: "coach", label: "教练档案", desc: "人工审核、项目、报价与名片", code: "CO" },
      { id: "coach-leads", surface: "coach", label: "线索经营", desc: "咨询、报价、试课转化", code: "CL" },
      { id: "credential-review", surface: "ops", label: "资质复核", desc: "退役经历、证书、视频样片", code: "CR", badge: "7" },
    ],
  },
  {
    title: "运营治理",
    items: [
      { id: "audit-queue", surface: "ops", label: "审核队列", desc: "资料、合同、未成年人保护", code: "AQ", badge: "18" },
      { id: "risk-alerts", surface: "ops", label: "风险预警", desc: "爽约、投诉、服务异常", code: "RA", badge: "3" },
      { id: "conversion-board", surface: "ops", label: "转化看板", desc: "供需缺口、试课转化、复购", code: "CB" },
    ],
  },
  {
    title: "应用交付",
    items: [
      { id: "pwa-install", surface: "apps", label: "浏览器安装", desc: "PWA、离线壳、主屏入口", code: "PW" },
      { id: "native-mobile", surface: "apps", label: "iOS / Android", desc: "Capacitor 原生工程", code: "NA" },
      { id: "native-desktop", surface: "apps", label: "桌面客户端", desc: "Windows、macOS、Linux", code: "DT" },
    ],
  },
];

const coaches: Coach[] = [
  {
    id: 1,
    name: "周明",
    sport: "羽毛球",
    city: "北京",
    level: "国家队退役",
    title: "青少年专项提升教练",
    price: 520,
    rating: 4.92,
    lessons: 386,
    reviewCount: 92,
    response: "9 分钟",
    status: "优先推荐",
    fit: 94,
    audience: ["青少年", "亲子"],
    goals: ["专项提升", "比赛备战", "动作纠错"],
    strengths: ["启动步法", "后场杀吊", "视频复盘"],
    proof: ["国家队档案已核验", "92 条真实课后反馈", "合同 / 保险 / 场地合规"],
    availability: ["今天 19:30", "周四 18:00", "周六 10:00"],
    note: "适合有基础、希望在 6-8 周内建立稳定动作体系的青少年学员。",
    accent: "#0B7A53",
  },
  {
    id: 2,
    name: "林悦",
    sport: "游泳",
    city: "上海",
    level: "省队退役",
    title: "儿童安全与自由泳效率教练",
    price: 420,
    rating: 4.86,
    lessons: 264,
    reviewCount: 71,
    response: "18 分钟",
    status: "平台已核验",
    fit: 91,
    audience: ["儿童", "青少年"],
    goals: ["兴趣入门", "体能改善", "考级训练"],
    strengths: ["水感建立", "换气节奏", "安全习惯"],
    proof: ["省队经历已核验", "儿童课程满意度 97%", "家长课后反馈完整"],
    availability: ["周三 17:30", "周六 09:00", "周日 15:00"],
    note: "适合怕水、零基础或希望动作更省力的学员，课程节奏温和但标准清晰。",
    accent: "#3567A4",
  },
  {
    id: 3,
    name: "王浩然",
    sport: "网球",
    city: "深圳",
    level: "职业队退役",
    title: "启蒙进阶与赛前节奏教练",
    price: 680,
    rating: 4.95,
    lessons: 441,
    reviewCount: 128,
    response: "12 分钟",
    status: "优先推荐",
    fit: 88,
    audience: ["成人", "青少年"],
    goals: ["比赛备战", "专项提升"],
    strengths: ["正反手衔接", "发抢体系", "落点变化"],
    proof: ["职业队履历已核验", "服务 31 位赛事学员", "试课转化率 46%"],
    availability: ["周一 20:00", "周五 19:00", "周日 11:00"],
    note: "适合有基础、想突破瓶颈的学员，训练会围绕实战得分方式设计。",
    accent: "#B45B3D",
  },
  {
    id: 4,
    name: "陈思雨",
    sport: "篮球",
    city: "广州",
    level: "前职业青年队",
    title: "控运与投篮节奏教练",
    price: 460,
    rating: 4.88,
    lessons: 318,
    reviewCount: 84,
    response: "15 分钟",
    status: "平台已核验",
    fit: 86,
    audience: ["青少年", "成人"],
    goals: ["专项提升", "校队选拔"],
    strengths: ["控运节奏", "投篮稳定性", "对抗选择"],
    proof: ["青年队经历已核验", "校队选拔案例 18 个", "训练视频样片完整"],
    availability: ["周二 18:30", "周四 20:00", "周六 14:00"],
    note: "适合从兴趣课进入系统训练的学员，强调动作细节和对抗中的判断。",
    accent: "#7A6231",
  },
];

const filters = {
  sports: ["全部项目", "羽毛球", "游泳", "网球", "篮球"],
  cities: ["全部城市", "北京", "上海", "深圳", "广州"],
  goals: ["全部目标", "兴趣入门", "专项提升", "比赛备战", "动作纠错", "校队选拔", "体能改善", "考级训练"],
  audiences: ["青少年", "儿童", "成人", "亲子"],
};

const commandMetrics = [
  ["24", "待匹配学员", "较昨日 +8", "green"],
  ["12", "高契合推荐", "较昨日 +5", "gold"],
  ["18", "试课待安排", "较昨日 +6", "coral"],
  ["36", "今日试课", "较昨日 +9", "blue"],
  ["23.6%", "7日转化率", "环比 +2.1%", "violet"],
  ["4.8/5", "30日满意度", "环比 +0.2", "sky"],
];

const matchRows = [
  {
    id: 1,
    coachId: 1,
    student: "李明轩",
    profile: "12岁 / 北京",
    demand: "提升比赛成绩",
    tags: ["羽毛球", "单打", "提高反手稳定性"],
    sport: "羽毛球",
    city: "北京",
    audience: "青少年",
    coach: "周明",
    coachMeta: "国家队 · 原国家青年队",
    fit: 92,
    phase: "待确认",
    phaseTone: "success",
    time: "10:24",
    accent: "#3aa483",
  },
  {
    id: 2,
    coachId: 4,
    student: "王思涵",
    profile: "14岁 / 广州",
    demand: "校队选拔",
    tags: ["篮球", "后卫", "控运稳定性"],
    sport: "篮球",
    city: "广州",
    audience: "青少年",
    coach: "陈思雨",
    coachMeta: "前职业青年队 · 后卫专项",
    fit: 88,
    phase: "待匹配",
    phaseTone: "warning",
    time: "09:58",
    accent: "#ee936f",
  },
  {
    id: 3,
    coachId: 4,
    student: "张子睿",
    profile: "10岁 / 深圳",
    demand: "兴趣培养",
    tags: ["篮球", "基础", "控球/投篮"],
    sport: "篮球",
    city: "深圳",
    audience: "儿童",
    coach: "陈思雨",
    coachMeta: "前职业青年队 · 后卫专项",
    fit: 85,
    phase: "试课推荐",
    phaseTone: "info",
    time: "09:12",
    accent: "#748df0",
  },
  {
    id: 4,
    coachId: 2,
    student: "陈一诺",
    profile: "13岁 / 上海",
    demand: "提高专项技术",
    tags: ["游泳", "自由泳", "换气节奏"],
    sport: "游泳",
    city: "上海",
    audience: "青少年",
    coach: "林悦",
    coachMeta: "省队退役 · 儿童安全专项",
    fit: 81,
    phase: "待确认",
    phaseTone: "success",
    time: "昨天 18:45",
    accent: "#ec6f64",
  },
  {
    id: 5,
    coachId: 3,
    student: "刘梓豪",
    profile: "16岁 / 深圳",
    demand: "比赛备战",
    tags: ["网球", "发抢", "比赛节奏"],
    sport: "网球",
    city: "深圳",
    audience: "青少年",
    coach: "王浩然",
    coachMeta: "职业队退役 · 实战进阶",
    fit: 78,
    phase: "待匹配",
    phaseTone: "warning",
    time: "昨天 17:32",
    accent: "#48a997",
  },
  {
    id: 6,
    coachId: 1,
    student: "黄若曦",
    profile: "12岁 / 北京",
    demand: "动作纠错",
    tags: ["羽毛球", "步法", "后场动作"],
    sport: "羽毛球",
    city: "北京",
    audience: "青少年",
    coach: "周明",
    coachMeta: "国家队退役 · 青训专项",
    fit: 76,
    phase: "待确认",
    phaseTone: "success",
    time: "昨天 16:05",
    accent: "#f3a15f",
  },
];

const queuePanels = [
  {
    title: "服务队列",
    total: "18",
    rows: [
      ["试课后跟进", "8"],
      ["已排课续费跟进", "6"],
      ["家长咨询待回复", "3"],
      ["课后反馈待处理", "1"],
    ],
  },
  {
    title: "风险预警",
    total: "7",
    rows: [
      ["中风险 · 李明轩连续3次试课未转化", "10:24"],
      ["低风险 · 王强资质即将过期", "09:34"],
      ["中风险 · 订单异常退款申请", "09:12"],
      ["低风险 · 陈伟30日内投诉偏高", "08:45"],
    ],
  },
  {
    title: "智能建议",
    total: "3",
    rows: [
      ["有 5 位学员契合度提升，建议重新推荐", "推荐"],
      ["周明今日可排课时段 14:00-18:00", "排期"],
      ["本周羽毛球兴趣需求环比上升 18%", "供需"],
    ],
  },
];

const trustBars = [
  ["退役经历", "国家队 / 省队 / 职业队档案核验", 94],
  ["教学评价", "真实课后反馈与复购记录", 86],
  ["安全保障", "合同、保险、场地和未成年人保护", 78],
];

const opsRail = [
  ["资质待审", "18", "需在 4 小时内处理"],
  ["服务异常", "3", "投诉与爽约预警"],
  ["合同待签", "27", "自动提醒学员和教练"],
  ["复购机会", "142", "训练周期满 6 周"],
];

const journey = [
  ["01", "核验供给", "退役经历、证书、执教记录和视频样片进入统一审核。"],
  ["02", "解释匹配", "目标、预算、位置、风格和可约时间共同生成推荐原因。"],
  ["03", "试课转化", "咨询、排期、合同、反馈与复购建议在同一链路里闭环。"],
  ["04", "教练经营", "教练获得名片、线索、课包、收入和口碑管理工具。"],
];

const coachPackages = [
  ["青训启蒙包", "6 节起", "兴趣建立、动作基础、家长反馈"],
  ["比赛提升包", "10 节起", "技术诊断、专项周期、赛前模拟"],
  ["体测冲刺包", "8 节起", "目标拆解、每周测评、伤病预防"],
];

const auditQueue = [
  ["李辰", "篮球", "前省青年队", "材料待补充", "高"],
  ["孙可", "网球", "一级运动员", "等待视频审核", "中"],
  ["高雅", "游泳", "社会体育指导员", "可进入面谈", "中"],
];

const appointments = [
  ["19:30", "周明", "羽毛球试课", "待确认场馆"],
  ["20:00", "陈思雨", "篮球专项提升", "已确认"],
  ["明日 10:00", "林悦", "儿童游泳", "待家长回复"],
];

const coachLeads = [
  ["张同学", "篮球", "校队选拔", "高意向"],
  ["林女士", "羽毛球", "成人兴趣", "待报价"],
  ["陈同学", "游泳", "考级训练", "需排期"],
];

const androidDownloadHref = "/downloads/zhuguang-android-private-1.1.1.apk";

const appEditions = [
  {
    name: "Mobile Native",
    platform: "Android",
    status: "Android 1.1.1 私有签名版",
    body: "同一账号承载学员与认证教练两种模式，覆盖匹配、预约、排期、消息、版本更新与训练档案。",
    actions: ["统一双身份", "Android 7.0+", "安全更新"],
    downloadHref: androidDownloadHref,
  },
  {
    name: "Desktop Native",
    platform: "Windows / Linux / macOS",
    status: "Tauri 工程已接入",
    body: "面向运营和机构使用，以独立桌面窗口进入服务中台，后续可补系统通知、自动更新和本地缓存。",
    actions: ["Windows 安装包", "Linux 安装包", "macOS 安装包"],
    downloadHref: "",
  },
];

const appReadiness = [
  ["Manifest", "应用名称、图标、启动地址和窗口形态已配置"],
  ["Service Worker", "支持离线兜底页和核心静态资源缓存"],
  ["Capacitor", "iOS / Android 原生项目已生成并同步"],
  ["Tauri", "Windows / Linux / macOS 桌面项目已生成"],
  ["Brand Icons", "Android / iOS / Desktop 图标已统一为逐光品牌"],
  ["CI Pipeline", "五端构建工作流已准备，支持手动触发"],
];

const nativeTargets = [
  {
    name: "iOS",
    stack: "Capacitor + Xcode",
    output: ".ipa / TestFlight / App Store",
    status: "工程已生成",
    requirement: "需要 macOS + Xcode + Apple Developer 证书",
  },
  {
    name: "Android",
    stack: "Capacitor + Gradle",
    output: "可安装 APK",
    status: "私有签名版可下载",
    requirement: "Android 7.0+ · Release keystore 仓库外保管 · 仅限受邀试点",
    downloadHref: androidDownloadHref,
  },
  {
    name: "Windows",
    stack: "Tauri + WebView2",
    output: ".exe / .msi",
    status: "桌面壳已生成",
    requirement: "需要 Rust + Microsoft C++ Build Tools + WebView2",
  },
  {
    name: "Linux",
    stack: "Tauri + WebKitGTK",
    output: "AppImage / deb / rpm",
    status: "桌面壳已生成",
    requirement: "需要 Linux 构建机 + Rust + WebKitGTK 系统依赖",
  },
  {
    name: "macOS",
    stack: "Tauri + Xcode",
    output: ".app / .dmg",
    status: "桌面壳已生成",
    requirement: "需要 macOS + Xcode Command Line Tools + Apple 签名证书",
  },
];

const releasePipelines = [
  ["质量检查", "native:check / lint / test", "每次发布前确认前端、PWA、Capacitor、Tauri 配置完整"],
  ["移动端构建", "mobile:android:build / mobile:ios:build", "Android 可在装好 JDK/SDK 后打包，iOS 必须在 macOS/Xcode 上签名"],
  ["桌面端构建", "desktop:build", "Windows、Linux、macOS 由 Tauri 生成系统安装包"],
  ["工具链诊断", "native:toolchain", "本机或 CI 可直接显示哪些平台 ready、哪些平台 blocked"],
];

const publicNav = [
  {
    label: "平台产品",
    anchor: "platform",
    summary: "把教练供给、学员匹配、试课履约和运营治理放进同一套系统。",
    targetSurface: "command" as Surface,
    targetNavId: "match-queue",
    columns: [
      ["核心能力", "教练资质核验", "学员智能匹配", "试课排期", "履约保障"],
      ["全端应用", "浏览器官网", "手机预约流", "PC 工作台", "原生 App"],
    ],
  },
  {
    label: "解决方案",
    anchor: "solutions",
    summary: "针对学员家庭、退役运动员教练和机构运营分别提供清晰入口。",
    targetSurface: "mobile" as Surface,
    targetNavId: "student-match",
    columns: [
      ["学员家庭", "找教练", "比方案", "约试课", "看反馈"],
      ["机构运营", "供需看板", "审核队列", "风险预警", "复购分析"],
    ],
  },
  {
    label: "教练资源",
    anchor: "coach",
    summary: "帮助优秀退役运动员建立可信名片、经营线索和长期课程。",
    targetSurface: "coach" as Surface,
    targetNavId: "coach-onboard",
    columns: [
      ["入驻经营", "资料审核", "课程定价", "线索管理", "收入记录"],
      ["成长支持", "教学样片", "评价体系", "服务标准", "训练模板"],
    ],
  },
  {
    label: "客户案例",
    anchor: "cases",
    summary: "用真实履约链路展示学员成长、教练增收和机构效率。",
    targetSurface: "ops" as Surface,
    targetNavId: "conversion-board",
    columns: [
      ["案例类型", "青训提升", "体测冲刺", "兴趣启蒙", "机构转化"],
      ["关键指标", "满意度", "续课率", "响应时效", "安全记录"],
    ],
  },
  {
    label: "关于我们",
    anchor: "trust",
    summary: "逐光的底层能力是核验、解释、履约和未成年人保护。",
    targetSurface: "ops" as Surface,
    targetNavId: "audit-queue",
    columns: [
      ["平台原则", "真实身份", "专业履历", "服务合规", "数据安全"],
      ["治理机制", "人工复核", "合同保险", "投诉处理", "质量追踪"],
    ],
  },
  {
    label: "帮助中心",
    anchor: "process",
    summary: "把加入平台、预约训练和处理订单的路径拆成可执行步骤。",
    targetSurface: "apps" as Surface,
    targetNavId: "pwa-install",
    columns: [
      ["常见任务", "如何找教练", "如何入驻", "如何排课", "如何安装"],
      ["支持范围", "浏览器", "iOS / Android", "Windows", "macOS / Linux"],
    ],
  },
];

const publicTrustProofs = [
  ["真实身份认证", "退役运动员身份核验", "人工审核双重保障"],
  ["运动员履历校验", "核验证书与历史成绩", "确保专业可靠"],
  ["教学成果验证", "教学经历与学员反馈", "多维评估体系"],
  ["服务合同与保险", "平台标准服务合同", "全程保险保障"],
];

const publicPillars = [
  ["教练资质核验", "退役经历、证书、执教记录、视频样片和服务标准进入统一审核。"],
  ["学员智能匹配", "基于项目、城市、年龄、目标、预算、可约时间和训练风格生成解释型推荐。"],
  ["课程预约管理", "咨询、试课、排期、合同、提醒和评价都在同一条履约链路内完成。"],
  ["全流程履约保障", "课前确认、课后反馈、异常预警、复购建议和未成年人保护形成闭环。"],
];

const publicRolePaths = [
  {
    title: "学员找教练",
    desc: "海量优质教练，智能匹配更合适",
    bullets: ["按项目、地区、水平精准筛选", "查看教练履历与学员评价", "在线沟通，预约试听课程", "课程管理与学习进度跟踪"],
    cta: "去找教练",
    tone: "green",
    surface: "mobile" as Surface,
    navId: "student-match",
  },
  {
    title: "教练合作与工作台",
    desc: "人工审核认证，高效管理学员",
    bullets: ["定向邀请并人工核验专业履历", "预约确认、排期与学员沟通", "数据看板，掌握服务进度", "线下收款记录，状态清晰"],
    cta: "了解教练合作",
    tone: "blue",
    surface: "coach" as Surface,
    navId: "coach-onboard",
  },
  {
    title: "机构运营治理",
    desc: "数字化管理，提升运营效率",
    bullets: ["教练与课程统一管理", "学员数据与成长档案", "运营数据分析与决策支持", "多校区权限与财务管理"],
    cta: "了解机构方案",
    tone: "coral",
    surface: "ops" as Surface,
    navId: "conversion-board",
  },
];

const publicProcessSteps = [
  ["01", "核验教练供给", "实名、退役履历、证书、执教记录和视频样片先进入平台审核。"],
  ["02", "解释匹配原因", "每次推荐都说明目标、水平、位置、风格和可约时间的匹配逻辑。"],
  ["03", "完成试课履约", "咨询、排期、合同、保险、提醒和课后反馈形成统一订单链路。"],
  ["04", "沉淀长期成长", "训练记录、满意度、续课机会和服务风险持续沉淀到学员档案。"],
];

const publicCoachPortraitPositions: Record<number, string> = {
  1: "12.5% 0%",
  2: "87.5% 0%",
  3: "12.5% 100%",
  4: "87.5% 100%",
};

const defaultDeviceProfile: DeviceProfile = {
  deviceClass: "desktop",
  os: "Desktop",
  browser: "Browser",
  input: "键鼠",
  recommendedSurface: "command",
  title: "PC 工作台",
  detail: "适合运营、机构和教练反复处理匹配、排期、审核与履约。",
};

const menuItems = navGroups.flatMap((group) => group.items);

const defaultNavIdBySurface: Record<Surface, string> = {
  command: "match-queue",
  web: "web-entry",
  mobile: "student-match",
  apps: "pwa-install",
  coach: "coach-onboard",
  ops: "audit-queue",
};

const compactNavIds: Record<DeviceClass, string[]> = {
  phone: ["student-match", "booking-flow", "coach-onboard", "pwa-install"],
  tablet: ["student-match", "match-queue", "coach-onboard", "pwa-install"],
  desktop: ["match-queue", "audit-queue", "coach-onboard", "pwa-install"],
};

function getSurfaceFromParam(value: string | null): Surface | null {
  return surfaces.some((item) => item.id === value) ? (value as Surface) : null;
}

function getNavItem(id: string | null) {
  return menuItems.find((item) => item.id === id) ?? null;
}

function getDefaultNavItem(surface: Surface) {
  return getNavItem(defaultNavIdBySurface[surface]) ?? menuItems[0];
}

function detectBrowser(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/Chrome|CriOS/i.test(userAgent)) return "Chrome";
  if (/Safari/i.test(userAgent) && !/Chrome|CriOS|Edg/i.test(userAgent)) return "Safari";
  if (/Firefox|FxiOS/i.test(userAgent)) return "Firefox";
  return "Browser";
}

function detectOS(userAgent: string, platform: string) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || /iOS/i.test(platform)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Mac/i.test(platform)) return "macOS";
  if (/Win/i.test(platform)) return "Windows";
  if (/Linux/i.test(platform) || /X11/i.test(userAgent)) return "Linux";
  return platform || "Unknown OS";
}

function detectDeviceProfile(): DeviceProfile {
  const nav = navigator as NavigatorWithUAData;
  const userAgent = navigator.userAgent;
  const uaPlatform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  const width = window.innerWidth;
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  const mobileUA = Boolean(nav.userAgentData?.mobile) || /Android|iPhone|iPod|Mobile/i.test(userAgent);
  const tabletUA = /iPad|Tablet/i.test(userAgent) || (uaPlatform === "MacIntel" && navigator.maxTouchPoints > 1);
  const viewportPhone = width < 760 || (mobileUA && width < 920);
  const viewportTablet = width < 1180;
  const deviceClass: DeviceClass =
    viewportPhone ? "phone" : tabletUA || (hasCoarsePointer && viewportTablet) || viewportTablet ? "tablet" : "desktop";
  const os = detectOS(userAgent, uaPlatform);
  const browser = detectBrowser(userAgent);
  const input = hasCoarsePointer || deviceClass !== "desktop" ? "触控" : "键鼠";

  if (deviceClass === "phone") {
    return {
      deviceClass,
      os,
      browser,
      input,
      recommendedSurface: "mobile",
      title: isStandalone ? "手机 App 预约流" : "手机端预约流",
      detail: "适合学员和家长快速完成教练匹配、比较、预约与确认。",
    };
  }

  if (deviceClass === "tablet") {
    return {
      deviceClass,
      os,
      browser,
      input,
      recommendedSurface: "mobile",
      title: "平板触控预约流",
      detail: "优先保留移动端的低摩擦决策，必要时可切到 PC 工作台处理运营任务。",
    };
  }

  return {
    deviceClass,
    os,
    browser,
    input,
    recommendedSurface: "command",
    title: isStandalone ? "桌面 App 工作台" : "PC 浏览器工作台",
    detail: "适合高密度查看队列、筛选教练、排期、审核与服务履约。",
  };
}

function asVars(vars: Record<string, string>) {
  return vars as CSSProperties;
}

export default function Home() {
  const [hasEnteredPlatform, setHasEnteredPlatform] = useState(false);
  const [surface, setSurface] = useState<Surface>("command");
  const [activeNavId, setActiveNavId] = useState(defaultNavIdBySurface.command);
  const [routeMode, setRouteMode] = useState<RouteMode>("auto");
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(defaultDeviceProfile);
  const [sport, setSport] = useState("全部项目");
  const [city, setCity] = useState("全部城市");
  const [goal, setGoal] = useState("全部目标");
  const [audience, setAudience] = useState("青少年");
  const [query, setQuery] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(1);
  const [savedCoachIds, setSavedCoachIds] = useState<number[]>([1, 2]);
  const [notice, setNotice] = useState<string[]>([]);
  const [matchGoalFilter, setMatchGoalFilter] = useState("全部需求");
  const [matchPhaseFilter, setMatchPhaseFilter] = useState("全部阶段");
  const [matchSportFilter, setMatchSportFilter] = useState("全部项目");
  const [matchCityFilter, setMatchCityFilter] = useState("全部城市");
  const [onlyHighFit, setOnlyHighFit] = useState(false);
  const [sortHighFitFirst, setSortHighFitFirst] = useState(true);
  const [matchPage, setMatchPage] = useState(1);
  const [matchPageSize, setMatchPageSize] = useState(3);
  const [selectedMatchRowId, setSelectedMatchRowId] = useState(1);
  const [inspectorTab, setInspectorTab] = useState<"profile" | "service" | "risk">("profile");
  const [showAllCredentials, setShowAllCredentials] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [coachDraft, setCoachDraft] = useState({
    name: "",
    sport: "羽毛球",
    city: "北京",
    level: "退役运动员",
    price: "480",
    contact: "",
    intro: "",
  });
  const [submittedCoach, setSubmittedCoach] = useState<typeof coachDraft | null>(null);
  const routeModeRef = useRef(routeMode);
  const hasEnteredPlatformRef = useRef(hasEnteredPlatform);

  const activeSurface = surfaces.find((item) => item.id === surface) ?? surfaces[0];
  const activeNavItem = getNavItem(activeNavId) ?? getDefaultNavItem(surface);
  const recommendedNavItem = getDefaultNavItem(deviceProfile.recommendedSurface);
  const compactNavItems = compactNavIds[deviceProfile.deviceClass]
    .map((id) => getNavItem(id))
    .filter((item): item is NavItem => Boolean(item));
  const routeModeLabel = routeMode === "auto" ? "自动入口" : routeMode === "link" ? "链接入口" : "手动切换";
  const isRecommendedSurface = activeNavItem.id === recommendedNavItem.id;

  useEffect(() => {
    routeModeRef.current = routeMode;
  }, [routeMode]);

  useEffect(() => {
    hasEnteredPlatformRef.current = hasEnteredPlatform;
  }, [hasEnteredPlatform]);

  const filteredCoaches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return coaches.filter((coach) => {
      const bySport = sport === "全部项目" || coach.sport === sport;
      const byCity = city === "全部城市" || coach.city === city;
      const byGoal = goal === "全部目标" || coach.goals.includes(goal);
      const byAudience = coach.audience.includes(audience);
      const byQuery =
        !normalizedQuery ||
        [coach.name, coach.sport, coach.city, coach.level, coach.title, coach.note]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return bySport && byCity && byGoal && byAudience && byQuery;
    });
  }, [audience, city, goal, query, sport]);

  const filteredMatchRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...matchRows]
      .filter((row) => matchGoalFilter === "全部需求" || row.demand === matchGoalFilter)
      .filter((row) => matchPhaseFilter === "全部阶段" || row.phase === matchPhaseFilter)
      .filter((row) => matchSportFilter === "全部项目" || row.sport === matchSportFilter)
      .filter((row) => matchCityFilter === "全部城市" || row.city === matchCityFilter)
      .filter((row) => !onlyHighFit || row.fit >= 85)
      .filter((row) =>
        !normalizedQuery ||
        [row.student, row.profile, row.demand, row.coach, row.coachMeta, ...row.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .sort((left, right) => sortHighFitFirst ? right.fit - left.fit : left.id - right.id);
  }, [
    matchCityFilter,
    matchGoalFilter,
    matchPhaseFilter,
    matchSportFilter,
    onlyHighFit,
    query,
    sortHighFitFirst,
  ]);
  const matchPageCount = Math.max(1, Math.ceil(filteredMatchRows.length / matchPageSize));
  const safeMatchPage = Math.min(matchPage, matchPageCount);
  const visibleMatchRows = filteredMatchRows.slice(
    (safeMatchPage - 1) * matchPageSize,
    safeMatchPage * matchPageSize,
  );
  const selectedMatchRow = matchRows.find((row) => row.id === selectedMatchRowId) ?? matchRows[0];

  const selectedCoach =
    filteredCoaches.find((coach) => coach.id === selectedCoachId) ??
    filteredCoaches[0] ??
    coaches.find((coach) => coach.id === selectedCoachId) ??
    coaches[0];

  const selectedFit = Math.min(
    98,
    selectedCoach.fit +
      (selectedCoach.audience.includes(audience) ? 2 : 0) +
      (goal !== "全部目标" && selectedCoach.goals.includes(goal) ? 2 : 0),
  );

  const savedCoaches = coaches.filter((coach) => savedCoachIds.includes(coach.id));
  const canInstallApp = Boolean(installPrompt) && !appInstalled;
  const completion = Math.min(
    100,
    18 +
      (coachDraft.name ? 14 : 0) +
      (coachDraft.contact ? 14 : 0) +
      (coachDraft.intro ? 24 : 0) +
      (coachDraft.price ? 12 : 0) +
      (coachDraft.city ? 9 : 0) +
      (coachDraft.sport ? 9 : 0),
  );

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js?v=23").catch(() => {
        setNotice((current) => ["应用离线能力暂未注册成功，在线功能不受影响", ...current].slice(0, 3));
      });
    }

    const syncClientState = window.setTimeout(() => {
      const profile = detectDeviceProfile();
      setDeviceProfile(profile);

      if (window.matchMedia("(display-mode: standalone)").matches) {
        setAppInstalled(true);
      }

      const params = new URLSearchParams(window.location.search);
      const requestedSurface = getSurfaceFromParam(params.get("surface"));
      const requestedMenu = getNavItem(params.get("menu"));
      const source = params.get("source");
      const role = params.get("role");

      if (requestedMenu) {
        setHasEnteredPlatform(true);
        setSurface(requestedMenu.surface);
        setActiveNavId(requestedMenu.id);
        setRouteMode("link");
      } else if (requestedSurface) {
        setHasEnteredPlatform(true);
        setSurface(requestedSurface);
        setActiveNavId(getDefaultNavItem(requestedSurface).id);
        setRouteMode("link");
      } else if (source === "native-mobile" || (source === "app" && profile.deviceClass === "phone")) {
        setHasEnteredPlatform(true);
        setSurface("mobile");
        setActiveNavId("student-match");
        setRouteMode("auto");
      } else if (source === "native-desktop" || source === "tauri-dev" || source === "tauri") {
        setHasEnteredPlatform(true);
        setSurface("command");
        setActiveNavId("match-queue");
        setRouteMode("auto");
      } else if (source === "app") {
        setHasEnteredPlatform(true);
        setSurface(profile.recommendedSurface);
        setActiveNavId(getDefaultNavItem(profile.recommendedSurface).id);
        setRouteMode("auto");
      } else if (role === "coach") {
        setHasEnteredPlatform(true);
        setSurface("coach");
        setActiveNavId("coach-onboard");
        setRouteMode("link");
      }
    }, 0);

    const handleViewportChange = () => {
      const profile = detectDeviceProfile();
      setDeviceProfile(profile);

      if (hasEnteredPlatformRef.current && routeModeRef.current === "auto") {
        chooseSurface(profile.recommendedSurface, "auto");
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
      setNotice((current) => ["逐光 App 已安装，可以从桌面或主屏幕直接打开", ...current].slice(0, 3));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      window.clearTimeout(syncClientState);
    };
  }, []);

  function chooseSurface(nextSurface: Surface, mode: RouteMode = "manual", nextNavId?: string) {
    const nextNavItem = nextNavId ? getNavItem(nextNavId) : getDefaultNavItem(nextSurface);
    setSurface(nextNavItem?.surface ?? nextSurface);
    setActiveNavId(nextNavItem?.id ?? defaultNavIdBySurface[nextSurface]);
    setRouteMode(mode);
  }

  function chooseNavItem(item: NavItem, mode: RouteMode = "manual") {
    setSurface(item.surface);
    setActiveNavId(item.id);
    setRouteMode(mode);
  }

  function enterPlatform(nextSurface: Surface = deviceProfile.recommendedSurface, nextNavId?: string) {
    hasEnteredPlatformRef.current = true;
    setHasEnteredPlatform(true);
    chooseSurface(nextSurface, "manual", nextNavId);
    window.requestAnimationFrame(() => {
      window.scrollTo({ behavior: "auto", left: 0, top: 0 });
    });
  }

  function resetFilters() {
    setSport("全部项目");
    setCity("全部城市");
    setGoal("全部目标");
    setAudience("青少年");
    setQuery("");
  }

  function resetMatchFilters() {
    setMatchGoalFilter("全部需求");
    setMatchPhaseFilter("全部阶段");
    setMatchSportFilter("全部项目");
    setMatchCityFilter("全部城市");
    setOnlyHighFit(false);
    setQuery("");
    setMatchPage(1);
  }

  function selectMatchRow(row: (typeof matchRows)[number]) {
    setSelectedMatchRowId(row.id);
    setSelectedCoachId(row.coachId);
  }

  function toggleSaved(id: number) {
    setSavedCoachIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function handleTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice((current) => [`已为 ${selectedCoach.name} 创建试课跟进，运营端同步进入排期队列`, ...current].slice(0, 3));
  }

  function handleCoachSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedCoach(coachDraft);
  }

  async function handleInstallApp() {
    chooseSurface("apps");

    if (!installPrompt) {
      setNotice((current) =>
        [
          "当前浏览器未开放一键安装：电脑端请点地址栏安装图标，手机端请用分享菜单添加到主屏幕",
          ...current,
        ].slice(0, 3),
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setNotice((current) =>
      [
        choice.outcome === "accepted" ? "安装已开始，完成后可作为独立 App 打开" : "已取消安装，可稍后在应用版本页重新安装",
        ...current,
      ].slice(0, 3),
    );
  }

  function updateDraft(field: keyof typeof coachDraft, value: string) {
    setCoachDraft((current) => ({ ...current, [field]: value }));
  }

  if (!hasEnteredPlatform) {
    return (
      <main className="public-shell">
        <header className="public-nav" aria-label="官网导航">
          <button className="public-brand" onClick={() => setHasEnteredPlatform(false)} type="button">
            <Image alt="" height={40} src="/logo-mark.svg" width={40} />
            <strong>逐光 Coach OS</strong>
          </button>
          <nav className="public-nav-menu" aria-label="官网主导航">
            {publicNav.map((group) => (
              <div className="public-menu-item" key={group.label}>
                <a href={`#${group.anchor}`}>{group.label}</a>
                <div className="public-mega-panel">
                  <p>{group.summary}</p>
                  <div>
                    {group.columns.map(([title, ...items]) => (
                      <section key={title}>
                        <strong>{title}</strong>
                        {items.map((item) => (
                          <a href={`#${group.anchor}`} key={item}>{item}</a>
                        ))}
                      </section>
                    ))}
                  </div>
                  <button onClick={() => enterPlatform(group.targetSurface, group.targetNavId)} type="button">
                    进入{group.label}
                  </button>
                </div>
              </div>
            ))}
          </nav>
          <div className="public-mobile-actions">
            <button className="public-mobile-login" onClick={() => enterPlatform()} type="button">
              登录
            </button>
            <details className="public-mobile-menu">
              <summary aria-label="打开官网菜单">
                <span aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </summary>
              <div className="public-mobile-menu-panel">
                {publicNav.map((group) => (
                  <a href={`#${group.anchor}`} key={group.label}>
                    <strong>{group.label}</strong>
                    <span>{group.summary}</span>
                  </a>
                ))}
                <button onClick={() => enterPlatform("coach", "coach-onboard")} type="button">
                  注册教练
                </button>
              </div>
            </details>
          </div>
          <div className="public-nav-actions">
            <button className="secondary-button" onClick={() => enterPlatform()} type="button">
              登录
            </button>
            <button className="primary-button" onClick={() => enterPlatform("coach", "coach-onboard")} type="button">
              注册教练
            </button>
          </div>
        </header>

        <section className="public-marketplace-hero" id="find-coach">
          <div className="public-marketplace-intro">
            <div>
              <span className="public-live-label">退役运动员教练服务平台</span>
              <h1>找到适合你的专业教练</h1>
              <p>先看真实履历、匹配理由、价格与可约时间，再决定是否预约试课。</p>
            </div>
            <div className="public-marketplace-actions">
              <button className="secondary-button" onClick={() => enterPlatform()} type="button">进入平台工作台</button>
              <button className="primary-button" onClick={() => enterPlatform("coach", "coach-onboard")} type="button">教练申请入驻</button>
            </div>
          </div>

          <form
            className="public-coach-search"
            onSubmit={(event) => {
              event.preventDefault();
              if (filteredCoaches[0]) setSelectedCoachId(filteredCoaches[0].id);
              enterPlatform("mobile", "student-match");
            }}
          >
            <label>
              城市
              <select onChange={(event) => setCity(event.target.value)} value={city}>
                {filters.cities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              运动项目
              <select onChange={(event) => setSport(event.target.value)} value={sport}>
                {filters.sports.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              训练目标
              <select onChange={(event) => setGoal(event.target.value)} value={goal}>
                {filters.goals.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              适合人群
              <select onChange={(event) => setAudience(event.target.value)} value={audience}>
                {filters.audiences.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="public-coach-search-query">
              搜索
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="教练、项目、城市或训练关键词"
                type="search"
                value={query}
              />
            </label>
            <button className="primary-button" type="submit">搜索教练</button>
          </form>

          <div className="public-marketplace-body">
            <section className="public-coach-directory" aria-labelledby="public-coach-directory-title">
              <div className="public-directory-heading">
                <div>
                  <span>平台样例供给 · 资料均可展开核验</span>
                  <h2 id="public-coach-directory-title">为你找到 {filteredCoaches.length} 位教练</h2>
                </div>
                <button onClick={resetFilters} type="button">重置条件</button>
              </div>

              <div className="public-coach-results">
                {filteredCoaches.length > 0 ? filteredCoaches.slice(0, 4).map((coach) => (
                  <article className="public-coach-result" key={coach.id}>
                    <span
                      aria-label={`${coach.name}教练头像`}
                      className="public-coach-result-avatar"
                      role="img"
                      style={asVars({ "--portrait-position": publicCoachPortraitPositions[coach.id] })}
                    />
                    <div className="public-coach-result-main">
                      <div>
                        <strong>{coach.name}</strong>
                        <em>已核验</em>
                        <span>{coach.sport} · {coach.title}</span>
                      </div>
                      <p>{coach.level} · {coach.note}</p>
                      <small>★ {coach.rating}（{coach.reviewCount} 条评价） · {coach.city} · {coach.availability[0]} 可约</small>
                      <div>
                        {coach.strengths.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
                      </div>
                    </div>
                    <div className="public-coach-result-score">
                      <span>匹配度</span>
                      <strong>{coach.fit}%</strong>
                      <small>¥{coach.price}/节</small>
                      <button
                        onClick={() => {
                          setSelectedCoachId(coach.id);
                          enterPlatform("mobile", "student-match");
                        }}
                        type="button"
                      >
                        查看并预约
                      </button>
                    </div>
                  </article>
                )) : (
                  <div className="public-coach-empty">
                    <strong>当前条件下暂时没有匹配结果</strong>
                    <p>可以放宽城市、目标或人群条件后再试。</p>
                    <button onClick={resetFilters} type="button">重置筛选</button>
                  </div>
                )}
              </div>
            </section>

            <aside className="public-match-explainer">
              <span>匹配如何工作</span>
              <h2>每一个推荐，都说清楚原因</h2>
              {[
                ["01", "填写需求", "项目、城市、目标、人群与时间"],
                ["02", "解释匹配", "履历、教学方向与可约状态共同计算"],
                ["03", "核对教练", "查看证书、评价、价格与服务规则"],
                ["04", "预约试课", "确认时间、场馆与取消政策"],
              ].map(([step, title, body]) => (
                <div key={step}><b>{step}</b><p><strong>{title}</strong><small>{body}</small></p></div>
              ))}
              <button onClick={() => enterPlatform("mobile", "student-match")} type="button">开始完整匹配</button>
            </aside>
          </div>

          <div className="public-marketplace-trust" aria-label="平台服务原则">
            {[
              ["身份与退役履历", "逐项核验"],
              ["推荐理由", "清晰可解释"],
              ["预约与服务进度", "全程有记录"],
              ["当前展示数据", "产品演示"],
            ].map(([title, detail]) => <span key={title}><strong>{title}</strong><small>{detail}</small></span>)}
          </div>
        </section>

        <section className="public-proof-strip" id="trust" aria-label="平台信任体系">
          {publicTrustProofs.map(([title, body, detail]) => (
            <article key={title}>
              <span aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
                <small>{detail}</small>
              </div>
            </article>
          ))}
        </section>

        <section className="public-how" id="platform">
          <div className="public-section-head">
            <h2>平台如何运转</h2>
            <p>逐光把“找得到教练”升级为“可信任、能履约、可持续成长”的服务系统。</p>
          </div>
          <div className="public-pillar-grid">
            {publicPillars.map(([title, body]) => (
              <article id={title} key={title}>
                <strong>{title}</strong>
                <p>{body}</p>
                <button onClick={() => enterPlatform(title === "教练资质核验" ? "coach" : "mobile")} type="button">
                  了解更多
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="public-role-section" id="solutions">
          <div className="public-section-head">
            <h2>三大角色，一站式服务</h2>
            <p>无论你是学员、教练还是机构，都能在逐光找到适合的解决方案。</p>
          </div>
          <div className="public-role-grid">
            {publicRolePaths.map((path) => (
              <article data-tone={path.tone} id={path.tone === "blue" ? "coach" : path.tone === "coral" ? "cases" : undefined} key={path.title}>
                <div>
                  <span>{path.title.slice(0, 2)}</span>
                  <h3>{path.title}</h3>
                  <p>{path.desc}</p>
                </div>
                <ul>
                  {path.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button onClick={() => enterPlatform(path.surface, path.navId)} type="button">
                  {path.cta}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="public-process" id="process">
          <div className="public-section-head">
            <h2>从核验到复购，流程透明可控</h2>
            <p>每个关键节点都能被记录、追踪和解释，降低优秀教练与学员之间的信任成本。</p>
          </div>
          <div className="public-process-grid">
            {publicProcessSteps.map(([step, title, body]) => (
              <article key={step}>
                <span>{step}</span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="public-final-cta">
            <h2>登录后进入完整平台能力</h2>
            <p>系统会根据手机、平板、桌面或原生 App 环境自动进入最合适的工作界面。</p>
            <div>
              <button className="primary-button" onClick={() => enterPlatform()} type="button">
                登录进入工作台
              </button>
              <button className="secondary-button" onClick={() => enterPlatform("coach", "coach-onboard")} type="button">
                了解教练合作
              </button>
            </div>
          </div>
        </section>

        <section className="public-app-download" id="download">
          <div className="public-app-download-inner">
            <Image alt="" height={52} src="/logo-mark.svg" width={52} />
            <div>
              <span>Android 私有试点版</span>
              <h2>逐光 App 已可下载安装</h2>
              <p>Release 签名、SHA-256 校验与签名指纹均已生成，支持 Android 7.0 及以上系统。</p>
            </div>
            <a download href={androidDownloadHref}>
              下载 Android APK
            </a>
          </div>
        </section>

        <footer className="public-footer">
          <div>
            <Image alt="" height={34} src="/logo-mark.svg" width={34} />
            <span><strong>逐光 Coach OS</strong><small>连接退役运动员教练与真正需要专业训练的学员</small></span>
          </div>
          <nav aria-label="页脚导航">
            <a href="#find-coach">找教练</a>
            <a href="#trust">服务保障</a>
            <a href="#coach">教练合作</a>
            <a href="#download">Android App</a>
            <a href="#process">帮助中心</a>
          </nav>
          <p>当前版本为私有产品演示。正式运营前将补充平台主体、服务协议、隐私政策、未成年人保护与投诉渠道。</p>
        </footer>
      </main>
    );
  }

  const shouldUseStudentMobileApp =
    surface === "mobile" &&
    (deviceProfile.deviceClass === "phone" || activeNavId === "student-match");

  if (shouldUseStudentMobileApp) {
    return (
      <MobileStudentApp
        audience={audience}
        city={city}
        coaches={coaches}
        goal={goal}
        onBook={(coachName) => {
          setNotice((current) => [`已提交 ${coachName} 的试课预约，等待教练确认`, ...current].slice(0, 3));
        }}
        onChangeAudience={setAudience}
        onChangeCity={setCity}
        onChangeGoal={setGoal}
        onChangeSport={setSport}
        onSelectCoach={setSelectedCoachId}
        onToggleSaved={toggleSaved}
        savedCoachIds={savedCoachIds}
        selectedCoachId={selectedCoach.id}
        sport={sport}
      />
    );
  }

  return (
    <main className={`platform-shell is-${deviceProfile.deviceClass}`}>
      <aside className="product-rail" aria-label="平台导航">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Image alt="" height={50} src="/logo-mark.svg" width={50} />
          </span>
          <div>
            <strong>逐光 Coach OS</strong>
            <small>退役运动员教练服务网络</small>
          </div>
        </div>

        <nav className="rail-nav" aria-label="产品任务导航">
          {navGroups.map((group) => (
            <section className="rail-section" key={group.title}>
              <h2>{group.title}</h2>
              <div className="rail-section-items">
                {group.items.map((item) => (
                  <button
                    aria-pressed={activeNavItem.id === item.id}
                    className={activeNavItem.id === item.id ? "active" : ""}
                    key={item.id}
                    onClick={() => chooseNavItem(item)}
                    type="button"
                  >
                    <span>{item.code}</span>
                    <strong>{item.label}</strong>
                    {item.badge && <b>{item.badge}</b>}
                    <small>{item.desc}</small>
                    {recommendedNavItem.id === item.id && <em>推荐</em>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="rail-status">
          <span>今日服务状态</span>
          <strong>34 个待确认试课</strong>
          <p>7 位教练资料复核中，3 个服务异常需要运营处理。</p>
          <div className="mini-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="command-bar">
          <div>
            <span className="eyebrow">ZhuGuang Product Platform</span>
            <h1>{activeNavItem.label}</h1>
            <p>
              {activeSurface.label} · {activeNavItem.desc}
            </p>
          </div>
          <div className="command-actions">
            <input
              aria-label="搜索教练、城市、资质或学员目标"
              onChange={(event) => {
                setQuery(event.target.value);
                setMatchPage(1);
              }}
              placeholder="搜索教练、城市、资质或学员目标"
              type="search"
              value={query}
            />
            <button className="primary-button" onClick={() => chooseSurface(deviceProfile.recommendedSurface)} type="button">
              开始匹配
            </button>
            <button className="secondary-button" onClick={handleInstallApp} type="button">
              {appInstalled ? "已安装" : canInstallApp ? "安装应用" : "应用版本"}
            </button>
          </div>
        </header>

        <section className="smart-handoff panel" aria-label="智能入口">
          <div className="handoff-copy">
            <span>{routeModeLabel}</span>
            <strong>{deviceProfile.title}</strong>
            <p>
              {deviceProfile.os} · {deviceProfile.browser} · {deviceProfile.input}，当前任务：
              {activeNavItem.label} / {activeSurface.label}。{deviceProfile.detail}
            </p>
          </div>
          <div className="handoff-actions">
            <span className={isRecommendedSurface ? "route-pill aligned" : "route-pill"}>
              {isRecommendedSurface ? "已在推荐入口" : `推荐：${recommendedNavItem.label}`}
            </span>
            {!isRecommendedSurface && (
              <button
                className="secondary-button"
                onClick={() => chooseNavItem(recommendedNavItem, "auto")}
                type="button"
              >
                回到推荐入口
              </button>
            )}
          </div>
        </section>

        <nav className="mobile-tabs" aria-label="紧凑端主导航">
          {compactNavItems.map((item) => (
            <button
              aria-pressed={activeNavItem.id === item.id}
              className={activeNavItem.id === item.id ? "active" : ""}
              key={item.id}
              onClick={() => chooseNavItem(item)}
              type="button"
            >
              <span>{item.code}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="surface-stage" key={surface}>
          {surface === "command" && activeNavId === "match-queue" && (
            <section className="enterprise-grid">
              <div className="kpi-strip">
                {commandMetrics.map(([value, label, detail, tone], index) => (
                  <article className="kpi-cell" data-tone={tone} key={label} style={asVars({ "--delay": `${index * 45}ms` })}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{detail}</small>
                    <i aria-hidden="true" />
                  </article>
                ))}
              </div>

              <section className="match-console panel">
                <div className="console-heading">
                  <div>
                    <h2>学员匹配工作台</h2>
                    <p>按需求摘要、推荐教练、契合度、匹配阶段和更新时间统一处理撮合队列。</p>
                  </div>
                  <button
                    aria-pressed={sortHighFitFirst}
                    className="secondary-button compact-action"
                    onClick={() => {
                      setSortHighFitFirst((current) => !current);
                      setMatchPage(1);
                    }}
                    type="button"
                  >
                    {sortHighFitFirst ? "按契合度排序" : "按更新时间排序"}
                  </button>
                </div>

                <div className="console-filters" aria-label="匹配筛选">
                  <label>
                    训练需求
                    <select
                      onChange={(event) => {
                        setMatchGoalFilter(event.target.value);
                        setMatchPage(1);
                      }}
                      value={matchGoalFilter}
                    >
                      {["全部需求", ...Array.from(new Set(matchRows.map((row) => row.demand)))].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    匹配阶段
                    <select
                      onChange={(event) => {
                        setMatchPhaseFilter(event.target.value);
                        setMatchPage(1);
                      }}
                      value={matchPhaseFilter}
                    >
                      {["全部阶段", ...Array.from(new Set(matchRows.map((row) => row.phase)))].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    运动项目
                    <select
                      onChange={(event) => {
                        setMatchSportFilter(event.target.value);
                        setMatchPage(1);
                      }}
                      value={matchSportFilter}
                    >
                      {filters.sports.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    所在区域
                    <select
                      onChange={(event) => {
                        setMatchCityFilter(event.target.value);
                        setMatchPage(1);
                      }}
                      value={matchCityFilter}
                    >
                      {filters.cities.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-check">
                    <input
                      checked={onlyHighFit}
                      onChange={(event) => {
                        setOnlyHighFit(event.target.checked);
                        setMatchPage(1);
                      }}
                      type="checkbox"
                    />
                    只看 85% 以上
                  </label>
                  <button onClick={resetMatchFilters} type="button">
                    重置
                  </button>
                </div>

                <div className="match-table" role="table" aria-label="学员匹配列表">
                  <div className="match-row table-head" role="row">
                    <span role="columnheader">学员信息</span>
                    <span role="columnheader">需求摘要</span>
                    <span role="columnheader">推荐教练</span>
                    <span role="columnheader">契合度</span>
                    <span role="columnheader">匹配阶段</span>
                    <span role="columnheader">更新时间</span>
                    <span role="columnheader">操作</span>
                  </div>
                  {visibleMatchRows.map((row, index) => (
                    <div
                      className={row.id === selectedMatchRow.id ? "match-row selected" : "match-row"}
                      key={row.id}
                      style={asVars({ "--accent": row.accent, "--delay": `${index * 48}ms` })}
                      role="row"
                    >
                      <span className="student-cell" role="cell">
                        <b>{row.student.slice(0, 1)}</b>
                        <span>
                          <strong>{row.student}</strong>
                          <small>{row.profile}</small>
                        </span>
                      </span>
                      <span className="demand-cell" role="cell">
                        <strong>{row.demand}</strong>
                        <small>{row.tags.join(" · ")}</small>
                      </span>
                      <span className="coach-cell" role="cell">
                        <strong>{row.coach}</strong>
                        <small>{row.coachMeta}</small>
                      </span>
                      <span className="fit-cell" role="cell">
                        <strong>{row.fit}%</strong>
                        <i style={asVars({ "--progress": `${row.fit}%` })} />
                      </span>
                      <span className={`phase-pill ${row.phaseTone}`} role="cell">{row.phase}</span>
                      <span className="time-cell" role="cell">{row.time}</span>
                      <span role="cell">
                        <button className="row-actions" onClick={() => selectMatchRow(row)} type="button">
                          {row.id === selectedMatchRow.id ? "已选" : "查看"}
                        </button>
                      </span>
                    </div>
                  ))}
                  {visibleMatchRows.length === 0 && (
                    <div className="match-table-empty" role="row">
                      <span role="cell">没有符合当前条件的学员匹配记录。请放宽筛选条件后重试。</span>
                    </div>
                  )}
                </div>

                <div className="table-footer">
                  <span>共 {filteredMatchRows.length} 条</span>
                  <div>
                    <button disabled={safeMatchPage === 1} onClick={() => setMatchPage((page) => Math.max(1, page - 1))} type="button">上一页</button>
                    {Array.from({ length: matchPageCount }, (_, index) => index + 1).map((page) => (
                      <button
                        aria-current={safeMatchPage === page ? "page" : undefined}
                        className={safeMatchPage === page ? "active" : ""}
                        key={page}
                        onClick={() => setMatchPage(page)}
                        type="button"
                      >
                        {page}
                      </button>
                    ))}
                    <button disabled={safeMatchPage === matchPageCount} onClick={() => setMatchPage((page) => Math.min(matchPageCount, page + 1))} type="button">下一页</button>
                  </div>
                  <select
                    aria-label="每页条数"
                    onChange={(event) => {
                      setMatchPageSize(Number(event.target.value));
                      setMatchPage(1);
                    }}
                    value={matchPageSize}
                  >
                    <option value="3">3 条/页</option>
                    <option value="6">6 条/页</option>
                  </select>
                </div>
              </section>

              <aside className="trust-inspector panel" style={asVars({ "--accent": selectedCoach.accent })}>
                <div aria-label="教练详情视图" className="inspector-tabs" role="tablist">
                  {[
                    ["profile", "教练信任档案"],
                    ["service", "服务队列"],
                    ["risk", "风险预警"],
                  ].map(([id, label]) => (
                    <button
                      aria-selected={inspectorTab === id}
                      className={inspectorTab === id ? "active" : ""}
                      key={id}
                      onClick={() => setInspectorTab(id as typeof inspectorTab)}
                      role="tab"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="inspector-hero">
                  <div>
                    <h2>{selectedCoach.name}</h2>
                    <p>
                      {selectedCoach.level} / {selectedCoach.sport} / {selectedCoach.lessons} 节履约
                    </p>
                    <small>ID：COACH000{selectedCoach.id}2345 · Trust & Fit {selectedFit}</small>
                  </div>
                  <strong>{selectedCoach.rating}</strong>
                </div>

                {inspectorTab === "profile" && (
                  <>
                    <section className="inspector-section">
                      <h3>资质与认证</h3>
                      {[
                        ...selectedCoach.proof,
                        ...(showAllCredentials ? ["实名信息与收款主体一致", "最近一次人工复核：2026-07-28"] : []),
                      ].map((item) => (
                        <div className="cert-row" key={item}>
                          <span>{item}</span>
                          <em>已认证</em>
                        </div>
                      ))}
                      <button onClick={() => setShowAllCredentials((current) => !current)} type="button">
                        {showAllCredentials ? "收起补充资质" : "查看全部资质"}
                      </button>
                    </section>
                    <section className="inspector-section">
                      <h3>履历与荣誉</h3>
                      <ul>
                        <li>{selectedCoach.level}经历已完成档案核验</li>
                        <li>{selectedCoach.lessons} 节平台服务记录</li>
                        <li>{selectedCoach.reviewCount} 条可追溯学员评价</li>
                      </ul>
                    </section>
                    <section className="inspector-section">
                      <h3>教学能力</h3>
                      {trustBars.map(([title, body, value]) => (
                        <div className="skill-row" key={title}>
                          <span>
                            <strong>{title}</strong>
                            <small>{body}</small>
                          </span>
                          <i style={asVars({ "--progress": `${value}%` })} />
                        </div>
                      ))}
                    </section>
                  </>
                )}

                {inspectorTab === "service" && (
                  <>
                    <section className="inspector-section inspector-service-summary">
                      <h3>当前匹配任务</h3>
                      <strong>{selectedMatchRow.student} · {selectedMatchRow.demand}</strong>
                      <p>{selectedMatchRow.tags.join(" / ")}</p>
                    </section>
                    <section className="inspector-section">
                      <h3>近期可约时段</h3>
                      {selectedCoach.availability.map((item) => (
                        <div className="cert-row" key={item}><span>{item}</span><em>可排期</em></div>
                      ))}
                      <button
                        onClick={() => chooseNavItem(getNavItem("trial-schedule") ?? activeNavItem)}
                        type="button"
                      >
                        进入试课排期
                      </button>
                    </section>
                    <section className="inspector-section">
                      <h3>服务备注</h3>
                      <p>{selectedCoach.note}</p>
                    </section>
                  </>
                )}

                {inspectorTab === "risk" && (
                  <>
                    <section className="inspector-section risk-safe">
                      <h3>合规与风险</h3>
                      <strong>96 / 100</strong>
                      <i style={asVars({ "--progress": "96%" })} />
                      <p>近 90 天无投诉、爽约或资质过期记录，可进入优先推荐池。</p>
                    </section>
                    <section className="inspector-section">
                      <h3>监测项目</h3>
                      {["身份与收款主体一致", "证书仍在有效期", "近 30 天履约正常", "未成年人服务记录完整"].map((item) => (
                        <div className="cert-row" key={item}><span>{item}</span><em>正常</em></div>
                      ))}
                    </section>
                  </>
                )}
              </aside>

              <div className="queue-grid">
                {queuePanels.map((panel) => (
                  <section className="queue-panel panel" key={panel.title}>
                    <div className="mini-heading">
                      <strong>{panel.title}（{panel.total}）</strong>
                      <button
                        onClick={() => {
                          if (panel.title === "服务队列") chooseNavItem(getNavItem("trial-schedule") ?? activeNavItem);
                          else if (panel.title === "风险预警") chooseNavItem(getNavItem("fulfillment") ?? activeNavItem);
                          else setNotice((current) => ["已刷新智能建议列表", ...current].slice(0, 3));
                        }}
                        type="button"
                      >
                        查看更多
                      </button>
                    </div>
                    <div className="queue-list">
                      {panel.rows.map(([label, value]) => (
                        <div className="queue-row" key={label}>
                          <span>{label}</span>
                          <em>{value}</em>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          )}

          {surface === "command" && activeNavId === "trial-schedule" && (
            <section className="command-task-view">
              <div className="command-task-summary panel">
                <div>
                  <span className="eyebrow">Trial Scheduling</span>
                  <h2>试课排期</h2>
                  <p>把待确认预约、教练可约时间、场馆与家长回复放进同一条排期队列。</p>
                </div>
                <div>
                  <strong>9</strong><span>待排期</span>
                  <strong>3</strong><span>场馆待确认</span>
                  <strong>2</strong><span>时间冲突</span>
                </div>
              </div>
              <section className="schedule-board panel">
                <div className="section-heading">
                  <div><span>今天</span><strong>7 月 30 日 · 周四</strong></div>
                  <button
                    className="secondary-button"
                    onClick={() => setNotice((current) => ["排期视图已刷新", ...current].slice(0, 3))}
                    type="button"
                  >
                    刷新可约时段
                  </button>
                </div>
                <div className="schedule-columns">
                  {[
                    ["待确认", "4", ["19:30 周明 / 李明轩", "20:00 陈思雨 / 王思涵"]],
                    ["场馆确认中", "3", ["18:30 林悦 / 陈一诺", "周六 10:00 周明 / 黄若曦"]],
                    ["已排期", "12", ["14:00 王浩然 / 刘梓豪", "15:30 陈思雨 / 张子睿"]],
                  ].map(([title, total, rows]) => (
                    <section key={title as string}>
                      <header><strong>{title as string}</strong><span>{total as string}</span></header>
                      {(rows as string[]).map((row) => (
                        <article key={row}>
                          <span>{row.split(" ")[0]}</span>
                          <strong>{row.slice(row.indexOf(" ") + 1)}</strong>
                          <button
                            onClick={() => setNotice((current) => [`已打开排期：${row}`, ...current].slice(0, 3))}
                            type="button"
                          >
                            处理
                          </button>
                        </article>
                      ))}
                    </section>
                  ))}
                </div>
              </section>
            </section>
          )}

          {surface === "command" && activeNavId === "fulfillment" && (
            <section className="command-task-view">
              <div className="command-task-summary panel">
                <div>
                  <span className="eyebrow">Service Fulfillment</span>
                  <h2>履约回访</h2>
                  <p>集中处理课后反馈、续课机会与异常服务，避免问题散落在聊天记录里。</p>
                </div>
                <div>
                  <strong>8</strong><span>课后待回访</span>
                  <strong>6</strong><span>续课机会</span>
                  <strong>3</strong><span>服务异常</span>
                </div>
              </div>
              <section className="fulfillment-board panel">
                <div className="section-heading">
                  <div><span>服务队列</span><strong>按优先级处理</strong></div>
                  <small>最近更新：刚刚</small>
                </div>
                <div className="fulfillment-list">
                  {[
                    ["高", "李明轩 · 周明", "试课后 24 小时未完成回访", "课后回访"],
                    ["中", "陈一诺 · 林悦", "本周期已完成 6 节，建议续课评估", "续课机会"],
                    ["高", "王思涵 · 陈思雨", "场馆临时变更，等待家长确认", "服务异常"],
                    ["低", "刘梓豪 · 王浩然", "已提交课后视频，等待教练点评", "反馈待处理"],
                  ].map(([priority, title, body, type]) => (
                    <article key={title}>
                      <span data-priority={priority}>{priority}</span>
                      <div><strong>{title}</strong><p>{body}</p><small>{type}</small></div>
                      <button
                        onClick={() => setNotice((current) => [`已进入处理：${title}`, ...current].slice(0, 3))}
                        type="button"
                      >
                        处理
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          )}

          {surface === "web" && (
            <section className="web-grid">
              <div className="web-hero panel">
                <span className="eyebrow">浏览器端产品入口</span>
                <h2>让优秀退役运动员，被真正需要训练结果的人找到。</h2>
                <p>
                  逐光不是教练广告墙，而是从资质核验、学员画像、可解释推荐、试课排期到服务履约的一套交易平台。
                </p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => chooseSurface(deviceProfile.recommendedSurface)} type="button">
                    进入推荐入口
                  </button>
                  <button className="secondary-button" onClick={() => chooseSurface("coach")} type="button">
                    教练申请入驻
                  </button>
                </div>
              </div>

              <div className="visual-panel">
                <Image
                  alt="教练指导学员训练"
                  fill
                  priority
                  sizes="(max-width: 1260px) 100vw, 40vw"
                  src="/coach-visual-v23.webp"
                  unoptimized
                />
                <div className="floating-proof">
                  <span>本周最佳匹配</span>
                  <strong>周明 / 羽毛球青训</strong>
                  <small>推荐依据已计算 · 时段以教练确认结果为准</small>
                </div>
              </div>

              <div className="journey-grid">
                {journey.map(([step, title, body]) => (
                  <article className="journey-card panel" key={step}>
                    <span>{step}</span>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {surface === "mobile" && (
            <section className="mobile-product-grid">
              <div className="mobile-spec panel">
                <span className="eyebrow">手机端学员流程</span>
                <h2>移动端只保留高频任务：匹配、比较、预约、确认。</h2>
                <p>
                  适合家长和学员快速决策。每张教练卡片都显示 Fit 分数、真实身份、近期可约时间和推荐解释。
                </p>
                <div className="spec-list">
                  <span>五项条件综合排序</span>
                  <span>推荐原因可解释</span>
                  <span>底部五入口导航</span>
                </div>
              </div>

              <div className="phone-frame" aria-label="手机端预览">
                <div className="phone-top">
                  <strong>逐光</strong>
                  <span>{city === "全部城市" ? "北京" : city} · {sport === "全部项目" ? "羽毛球" : sport}</span>
                </div>
                <h2>为孩子匹配合适的退役运动员教练</h2>
                <p>目标、预算、位置和训练风格都会进入推荐解释。</p>
                <div className="phone-search">
                  <span>训练目标</span>
                  <strong>{goal === "全部目标" ? "青少年专项提升" : goal}</strong>
                  <button onClick={() => chooseSurface(deviceProfile.recommendedSurface)} type="button">
                    重算匹配
                  </button>
                </div>
                <div className="phone-section-title">
                  <strong>推荐教练</strong>
                  <span>Fit 90+</span>
                </div>
                {coaches.slice(0, 2).map((coach) => (
                  <button
                    className="phone-coach"
                    key={coach.id}
                    onClick={() => {
                      setSelectedCoachId(coach.id);
                      chooseSurface(deviceProfile.recommendedSurface);
                    }}
                    type="button"
                  >
                    <span className="avatar">{coach.name.slice(0, 1)}</span>
                    <span>
                      <strong>{coach.name}</strong>
                      <small>{coach.level} · {coach.strengths[0]}</small>
                      <em>{coach.availability[0]} 可试课</em>
                    </span>
                    <b>{coach.fit}</b>
                  </button>
                ))}
                <div className="phone-explain">
                  <strong>为什么推荐周明？</strong>
                  <small>目标匹配高、通勤近、最近三个月青少年评价稳定。</small>
                </div>
                <div className="phone-nav">
                  <span className="active">匹配</span>
                  <span>教练</span>
                  <span>预约</span>
                  <span>我的</span>
                </div>
              </div>
            </section>
          )}

          {surface === "apps" && (
            <section className="app-grid">
              <div className="app-hero panel">
                <div>
                  <span className="eyebrow">Application Suite</span>
                  <h2>iOS、Android、Windows、Linux、macOS 使用同一套服务中台能力</h2>
                  <p>
                    当前已接入 PWA、Capacitor 和 Tauri 三层交付。Android 私有试点版使用独立 release keystore 签名，iOS 工程将在 macOS 完成签名后提供。
                  </p>
                </div>
                <div className="app-hero-actions">
                  <a className="primary-button" download href={androidDownloadHref}>
                    下载 Android APK
                  </a>
                  <button className="secondary-button" onClick={handleInstallApp} type="button">
                    {appInstalled ? "网页应用已安装" : canInstallApp ? "安装网页应用" : "PWA 安装说明"}
                  </button>
                </div>
              </div>

              <div className="app-edition-grid">
                {appEditions.map((edition, index) => (
                  <article className="app-edition panel" key={edition.name} style={asVars({ "--delay": `${index * 70}ms` })}>
                    <div className="app-device" aria-hidden="true">
                      <span>{index === 0 ? "Phone" : "Desktop"}</span>
                      <i />
                      <b />
                    </div>
                    <div>
                      <span>{edition.platform}</span>
                      <h3>{edition.name}</h3>
                      <em>{edition.status}</em>
                      <p>{edition.body}</p>
                      <div className="app-chip-row">
                        {edition.actions.map((item) => (
                          <strong key={item}>{item}</strong>
                        ))}
                      </div>
                      {edition.downloadHref && (
                        <a className="app-download-link" download href={edition.downloadHref}>
                          下载 Android 私有版
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <aside className="app-readiness panel">
                <div className="section-heading compact">
                  <div>
                    <span>交付状态</span>
                    <strong>应用化检查</strong>
                  </div>
                  <small>{appInstalled ? "已安装" : canInstallApp ? "可一键安装" : "可手动安装"}</small>
                </div>
                <div className="readiness-list">
                  {appReadiness.map(([title, body]) => (
                    <div className="readiness-item" key={title}>
                      <b />
                      <span>
                        <strong>{title}</strong>
                        <small>{body}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </aside>

              <section className="native-targets panel">
                <div className="section-heading compact">
                  <div>
                    <span>目标平台</span>
                    <strong>五端原生交付矩阵</strong>
                  </div>
                </div>
                <div className="target-grid">
                  {nativeTargets.map((target) => (
                    <article className="target-card" key={target.name}>
                      <span>{target.status}</span>
                      <h3>{target.name}</h3>
                      <strong>{target.stack}</strong>
                      <p>{target.output}</p>
                      <small>{target.requirement}</small>
                      {"downloadHref" in target && target.downloadHref && (
                        <a className="target-download-link" download href={target.downloadHref}>
                          下载 APK
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="release-pipeline panel">
                <div className="section-heading compact">
                  <div>
                    <span>发布能力</span>
                    <strong>构建流水线和本机诊断</strong>
                  </div>
                  <small>GitHub Actions / Local CLI</small>
                </div>
                <div className="pipeline-list">
                  {releasePipelines.map(([title, command, body]) => (
                    <article className="pipeline-row" key={title}>
                      <span>{title}</span>
                      <strong>{command}</strong>
                      <p>{body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="native-roadmap panel">
                <div className="section-heading compact">
                  <div>
                    <span>下一阶段</span>
                    <strong>原生 App 封装路线</strong>
                  </div>
                </div>
                <div className="roadmap-grid">
                  <div>
                    <strong>Mobile Native</strong>
                    <p>用 Capacitor 封装当前前端，补推送、相册/文件上传、定位和应用商店素材。</p>
                  </div>
                  <div>
                    <strong>Desktop Native</strong>
                    <p>用 Tauri 封装 PC 工作台，补系统托盘、自动更新、桌面通知和本地缓存。</p>
                  </div>
                  <div>
                    <strong>Shared Core</strong>
                    <p>产品逻辑、权限、教练档案、订单履约和运营审核保持同源，减少多端维护成本。</p>
                  </div>
                </div>
              </section>
            </section>
          )}

          {surface === "coach" && (
            <section className="coach-grid">
              <form className="onboard-form panel" onSubmit={handleCoachSubmit}>
                <div className="section-heading">
                  <div>
                    <span>教练端</span>
                    <strong>入驻资料和名片草稿</strong>
                  </div>
                  <small>{completion}% 完整</small>
                </div>
                <div className="form-grid">
                  <label>
                    姓名
                    <input
                      onChange={(event) => updateDraft("name", event.target.value)}
                      placeholder="请输入真实姓名"
                      required
                      value={coachDraft.name}
                    />
                  </label>
                  <label>
                    项目
                    <select onChange={(event) => updateDraft("sport", event.target.value)} value={coachDraft.sport}>
                      {filters.sports.slice(1).map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    城市
                    <select onChange={(event) => updateDraft("city", event.target.value)} value={coachDraft.city}>
                      {filters.cities.slice(1).map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    背景
                    <select onChange={(event) => updateDraft("level", event.target.value)} value={coachDraft.level}>
                      <option>退役运动员</option>
                      <option>前专业队队员</option>
                      <option>高水平运动员</option>
                      <option>持证专项教练</option>
                    </select>
                  </label>
                  <label>
                    单课价格
                    <input
                      min="100"
                      onChange={(event) => updateDraft("price", event.target.value)}
                      type="number"
                      value={coachDraft.price}
                    />
                  </label>
                  <label>
                    联系方式
                    <input
                      onChange={(event) => updateDraft("contact", event.target.value)}
                      placeholder="手机号或微信"
                      required
                      value={coachDraft.contact}
                    />
                  </label>
                </div>
                <label>
                  教学优势与经历
                  <textarea
                    onChange={(event) => updateDraft("intro", event.target.value)}
                    placeholder="例如：省队训练经历，擅长青少年启蒙、比赛备战、动作纠错。"
                    required
                    value={coachDraft.intro}
                  />
                </label>
                <button className="primary-button" type="submit">
                  生成入驻草稿
                </button>
                {submittedCoach && (
                  <div className="draft-result">
                    <strong>
                      {submittedCoach.city} / {submittedCoach.sport} / {submittedCoach.name || "未命名教练"}
                    </strong>
                    <p>
                      {submittedCoach.level}，建议价格 ¥{submittedCoach.price}/课。{submittedCoach.intro}
                    </p>
                  </div>
                )}
              </form>

              <aside className="coach-side">
                <div className="panel completion-card">
                  <span>资料完整度</span>
                  <strong>{completion}%</strong>
                  <i style={asVars({ "--progress": `${completion}%` })} />
                  <p>姓名、联系方式和教学经历会直接影响审核效率和学员信任。</p>
                </div>

                <div className="panel coach-card-preview">
                  <span>名片预览</span>
                  <div className="trust-head compact">
                    <div>
                      <h2>{coachDraft.name || "你的教练名片"}</h2>
                      <p>
                        {coachDraft.city} · {coachDraft.sport} · ¥{coachDraft.price}/课
                      </p>
                    </div>
                    <em>{coachDraft.level}</em>
                  </div>
                  <p>{coachDraft.intro || "填写教学优势后，这里会生成学员看到的教练简介。"}</p>
                </div>

                <div className="package-grid">
                  {coachPackages.map(([name, count, desc]) => (
                    <article className="package-card panel" key={name}>
                      <span>{count}</span>
                      <strong>{name}</strong>
                      <small>{desc}</small>
                    </article>
                  ))}
                </div>

                <div className="panel">
                  <div className="section-heading compact">
                    <div>
                      <span>新线索</span>
                      <strong>待跟进</strong>
                    </div>
                  </div>
                  <div className="simple-list">
                    {coachLeads.map(([name, sportName, target, state]) => (
                      <div className="simple-item" key={name}>
                        <div>
                          <strong>{name}</strong>
                          <small>
                            {sportName} / {target}
                          </small>
                        </div>
                        <em>{state}</em>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          )}

          {surface === "ops" && (
            <section className="ops-grid">
              <div className="panel ops-main">
                <div className="section-heading">
                  <div>
                    <span>运营端</span>
                    <strong>审核、撮合、试课转化</strong>
                  </div>
                  <small>适合 PC 端反复处理</small>
                </div>
                <div className="pipeline-grid">
                  {opsRail.map(([label, value, detail], index) => (
                    <article className="pipeline-card" key={label} style={asVars({ "--delay": `${index * 55}ms` })}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{detail}</small>
                      <i style={asVars({ "--progress": `${72 - index * 12}%` })} />
                    </article>
                  ))}
                </div>
                <div className="timeline">
                  {journey.map(([step, title, body]) => (
                    <div className="timeline-item" key={step}>
                      <strong>{step}</strong>
                      <div>
                        <h3>{title}</h3>
                        <p>{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="ops-side">
                <div className="panel">
                  <div className="section-heading compact">
                    <div>
                      <span>审核队列</span>
                      <strong>3 个待处理</strong>
                    </div>
                  </div>
                  <div className="simple-list">
                    {auditQueue.map(([name, sportName, level, state, priority]) => (
                      <div className="simple-item audit-item" key={name}>
                        <div>
                          <strong>{name}</strong>
                          <small>
                            {sportName} / {level}
                          </small>
                        </div>
                        <em>{priority}优先级</em>
                        <span>{state}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <div className="section-heading compact">
                    <div>
                      <span>今日预约</span>
                      <strong>排期状态</strong>
                    </div>
                  </div>
                  <div className="simple-list">
                    {appointments.map(([time, coachName, title, state]) => (
                      <div className="simple-item" key={`${time}-${coachName}`}>
                        <div>
                          <strong>{time}</strong>
                          <small>
                            {coachName} / {title}
                          </small>
                        </div>
                        <em>{state}</em>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          )}
        </div>

        <section className="persistent-dock" aria-label="当前操作">
          <div>
            <span>已保存对比</span>
            <strong>{savedCoaches.map((coach) => coach.name).join("、") || "暂无"}</strong>
          </div>
          <form onSubmit={handleTrial}>
            <button className="secondary-button" onClick={() => toggleSaved(selectedCoach.id)} type="button">
              {savedCoachIds.includes(selectedCoach.id) ? "移出对比" : "加入对比"}
            </button>
            <button className="primary-button" type="submit">
              创建试课跟进
            </button>
          </form>
        </section>

        {notice.length > 0 && (
          <div className="notice-stack" aria-live="polite">
            {notice.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
