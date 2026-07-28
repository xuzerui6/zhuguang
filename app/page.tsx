"use client";

import { CSSProperties, FormEvent, useMemo, useState } from "react";

type Surface = "command" | "web" | "mobile" | "coach" | "ops";

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
  { id: "coach", label: "教练端", desc: "入驻、线索和服务经营", code: "04" },
  { id: "ops", label: "运营端", desc: "审核、风险和转化看板", code: "05" },
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
  ["1,284", "认证教练", "+18% 本月增长"],
  ["4,692", "本周匹配", "+31% 推荐命中"],
  ["42.8%", "试课转化", "+6.4 环比"],
  ["4.86", "平均评分", "课后回收稳定"],
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

function asVars(vars: Record<string, string>) {
  return vars as CSSProperties;
}

export default function Home() {
  const [surface, setSurface] = useState<Surface>("command");
  const [sport, setSport] = useState("全部项目");
  const [city, setCity] = useState("全部城市");
  const [goal, setGoal] = useState("全部目标");
  const [audience, setAudience] = useState("青少年");
  const [query, setQuery] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(1);
  const [savedCoachIds, setSavedCoachIds] = useState<number[]>([1, 2]);
  const [notice, setNotice] = useState<string[]>([]);
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

  const activeSurface = surfaces.find((item) => item.id === surface) ?? surfaces[0];

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

  function resetFilters() {
    setSport("全部项目");
    setCity("全部城市");
    setGoal("全部目标");
    setAudience("青少年");
    setQuery("");
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

  function updateDraft(field: keyof typeof coachDraft, value: string) {
    setCoachDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="platform-shell">
      <aside className="product-rail" aria-label="平台导航">
        <div className="brand-lockup">
          <span className="brand-mark">ZG</span>
          <div>
            <strong>逐光 Coach OS</strong>
            <small>退役运动员教练服务网络</small>
          </div>
        </div>

        <nav className="rail-nav" aria-label="产品端导航">
          {surfaces.map((item) => (
            <button
              aria-pressed={surface === item.id}
              className={surface === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setSurface(item.id)}
              type="button"
            >
              <span>{item.code}</span>
              <strong>{item.label}</strong>
              <small>{item.desc}</small>
            </button>
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
            <h1>{activeSurface.label}</h1>
            <p>{activeSurface.desc}</p>
          </div>
          <div className="command-actions">
            <input
              aria-label="搜索教练、城市、资质或学员目标"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索教练、城市、资质或学员目标"
              type="search"
              value={query}
            />
            <button className="primary-button" onClick={() => setSurface("command")} type="button">
              开始匹配
            </button>
          </div>
        </header>

        <nav className="mobile-tabs" aria-label="移动端导航">
          {surfaces.map((item) => (
            <button
              aria-pressed={surface === item.id}
              className={surface === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setSurface(item.id)}
              type="button"
            >
              <span>{item.code}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="surface-stage" key={surface}>
          {surface === "command" && (
            <section className="command-grid">
              <div className="page-title">
                <span>教练服务中台</span>
                <h2>把退役运动员的专业能力，转化为可被发现、可被信任、可被预约的服务。</h2>
              </div>

              <div className="metric-row">
                {commandMetrics.map(([value, label, detail], index) => (
                  <article className="metric-tile" key={label} style={asVars({ "--delay": `${index * 55}ms` })}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{detail}</small>
                  </article>
                ))}
              </div>

              <section className="match-workbench panel">
                <div className="section-heading">
                  <div>
                    <span>学员匹配工作台</span>
                    <strong>按目标、基础、预算和位置解释推荐结果</strong>
                  </div>
                  <button onClick={resetFilters} type="button">
                    重置画像
                  </button>
                </div>

                <div className="filter-strip">
                  <label>
                    人群
                    <select onChange={(event) => setAudience(event.target.value)} value={audience}>
                      {filters.audiences.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    项目
                    <select onChange={(event) => setSport(event.target.value)} value={sport}>
                      {filters.sports.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    城市
                    <select onChange={(event) => setCity(event.target.value)} value={city}>
                      {filters.cities.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    目标
                    <select onChange={(event) => setGoal(event.target.value)} value={goal}>
                      {filters.goals.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="coach-table">
                  {filteredCoaches.map((coach, index) => (
                    <button
                      className={coach.id === selectedCoach.id ? "coach-line selected" : "coach-line"}
                      key={coach.id}
                      onClick={() => setSelectedCoachId(coach.id)}
                      style={asVars({ "--accent": coach.accent, "--delay": `${index * 50}ms` })}
                      type="button"
                    >
                      <span className="avatar">{coach.name.slice(0, 1)}</span>
                      <span className="coach-copy">
                        <strong>{coach.name}</strong>
                        <small>
                          {coach.level} · {coach.sport} · {coach.city}
                        </small>
                      </span>
                      <span className="coach-specialty">{coach.strengths.slice(0, 2).join(" / ")}</span>
                      <span className="coach-fit">
                        {coach.fit}
                        <small>Fit</small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="explain-bar">
                  推荐解释：目标匹配 38% · 教学风格 24% · 通勤与预算 22% · 近期可约 16%
                </div>
              </section>

              <aside className="trust-panel panel" style={asVars({ "--accent": selectedCoach.accent })}>
                <div className="trust-head">
                  <div>
                    <span>教练信任档案</span>
                    <h2>{selectedCoach.name}</h2>
                    <p>
                      {selectedCoach.level} · {selectedCoach.title}
                    </p>
                  </div>
                  <em>{selectedCoach.status}</em>
                </div>

                <div className="score-card">
                  <span>Trust & Fit Score</span>
                  <strong>{selectedFit}</strong>
                  <p>{selectedCoach.note}</p>
                </div>

                <div className="trust-list">
                  {trustBars.map(([title, body, value]) => (
                    <div className="trust-row" key={title}>
                      <div>
                        <strong>{title}</strong>
                        <small>{body}</small>
                      </div>
                      <i style={asVars({ "--progress": `${value}%` })} />
                    </div>
                  ))}
                </div>

                <div className="slot-grid">
                  {selectedCoach.availability.map((slot) => (
                    <span key={slot}>{slot}</span>
                  ))}
                </div>
              </aside>

              <div className="ops-rail panel">
                {opsRail.map(([label, value, detail]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{detail}</small>
                  </div>
                ))}
              </div>
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
                  <button className="primary-button" onClick={() => setSurface("command")} type="button">
                    进入平台工作台
                  </button>
                  <button className="secondary-button" onClick={() => setSurface("coach")} type="button">
                    教练申请入驻
                  </button>
                </div>
              </div>

              <div className="visual-panel">
                <img src="/coach-visual.png" alt="教练指导学员训练" />
                <div className="floating-proof">
                  <span>本周最佳匹配</span>
                  <strong>周明 / 羽毛球青训</strong>
                  <small>目标匹配度 94%，今晚 19:30 可试课</small>
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
                  <span>Fit 90+ 优先展示</span>
                  <span>推荐原因可解释</span>
                  <span>底部四入口导航</span>
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
                  <button onClick={() => setSurface("command")} type="button">
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
                      setSurface("command");
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
