"use client";

import { CSSProperties, FormEvent, useMemo, useState } from "react";

type View = "intro" | "student" | "coach" | "ops";

type Coach = {
  id: number;
  name: string;
  sport: string;
  city: string;
  title: string;
  record: string;
  price: number;
  rating: number;
  lessons: number;
  response: string;
  status: "优先推荐" | "已核验" | "复核中";
  audience: string[];
  goals: string[];
  strengths: string[];
  availability: string;
  story: string;
  accent: string;
};

const coaches: Coach[] = [
  {
    id: 1,
    name: "周明",
    sport: "篮球",
    city: "上海",
    title: "前 CBA 青年队后卫 / 青训专项教练",
    record: "12 年职业训练经历，退役后专注 8-16 岁控运、投篮和比赛阅读。",
    price: 420,
    rating: 4.9,
    lessons: 318,
    response: "12 分钟",
    status: "优先推荐",
    audience: ["青少年", "比赛提升", "校队选拔"],
    goals: ["专项提升", "青训启蒙", "比赛备战"],
    strengths: ["控运节奏", "一对一突破", "比赛决策"],
    availability: "周二/周四晚间，周末上午",
    story: "适合想从兴趣课进入系统训练的学员，课程重视动作细节和对抗中的选择。",
    accent: "#c86a4c",
  },
  {
    id: 2,
    name: "林悦",
    sport: "游泳",
    city: "广州",
    title: "前省队自由泳运动员 / 儿童安全训练教练",
    record: "省队训练背景，持社会体育指导员证，擅长从怕水到规范泳姿的训练过渡。",
    price: 360,
    rating: 4.8,
    lessons: 275,
    response: "25 分钟",
    status: "已核验",
    audience: ["儿童", "成人入门", "体能恢复"],
    goals: ["兴趣入门", "体能改善", "考级训练"],
    strengths: ["水感建立", "自由泳换气", "安全习惯"],
    availability: "工作日白天，周六全天",
    story: "适合初学者和重视安全感的家庭，课程节奏温和但标准清晰。",
    accent: "#2e7fa2",
  },
  {
    id: 3,
    name: "王浩然",
    sport: "乒乓球",
    city: "北京",
    title: "前专业队陪练 / 技战术提升教练",
    record: "长期服务专业队训练，熟悉不同打法的技术修正和战术拆解。",
    price: 520,
    rating: 4.95,
    lessons: 441,
    response: "18 分钟",
    status: "优先推荐",
    audience: ["成人", "青少年", "业余比赛"],
    goals: ["专项提升", "比赛备战", "考级训练"],
    strengths: ["正反手衔接", "发抢体系", "落点变化"],
    availability: "周一/周三/周五晚间",
    story: "适合有一定基础、想突破瓶颈的学员，训练会围绕实战得分方式设计。",
    accent: "#b88a31",
  },
  {
    id: 4,
    name: "陈思雨",
    sport: "羽毛球",
    city: "深圳",
    title: "前国家青年集训队队员 / 私教主理人",
    record: "曾入选国青集训，退役后创办小班训练营，擅长步法和双打配合。",
    price: 680,
    rating: 4.93,
    lessons: 386,
    response: "9 分钟",
    status: "已核验",
    audience: ["白领", "亲子", "比赛提升"],
    goals: ["兴趣入门", "专项提升", "比赛备战"],
    strengths: ["启动步法", "后场杀吊", "双打轮转"],
    availability: "周末下午，工作日晚间",
    story: "适合希望训练效率高、兼顾运动体验的学员，课程常配合视频复盘。",
    accent: "#3f7b5a",
  },
  {
    id: 5,
    name: "赵凌",
    sport: "田径",
    city: "成都",
    title: "前省队短跑运动员 / 体能与跑姿教练",
    record: "短跑专项出身，服务中考体育、成人跑者和团队体能训练。",
    price: 300,
    rating: 4.82,
    lessons: 196,
    response: "36 分钟",
    status: "复核中",
    audience: ["中考体育", "成人跑者", "体能改善"],
    goals: ["体能改善", "考试训练", "专项提升"],
    strengths: ["起跑技术", "跑姿经济性", "下肢爆发力"],
    availability: "周二/周四白天",
    story: "适合目标明确的学员，课程会把速度、力量和伤病预防放在一起设计。",
    accent: "#8f5a43",
  },
  {
    id: 6,
    name: "许洋",
    sport: "足球",
    city: "杭州",
    title: "前中甲梯队球员 / 青少年技术教练",
    record: "职业梯队成长经历，专注青少年基本功、球感和小场景配合。",
    price: 390,
    rating: 4.86,
    lessons: 229,
    response: "21 分钟",
    status: "已核验",
    audience: ["儿童", "青少年", "校队选拔"],
    goals: ["青训启蒙", "专项提升", "比赛备战"],
    strengths: ["第一脚触球", "变向摆脱", "小组配合"],
    availability: "周三晚间，周末全天",
    story: "适合希望建立长期训练习惯的孩子，训练内容兼顾趣味和竞技基础。",
    accent: "#226a5c",
  },
];

const views: Array<{ id: View; label: string; desc: string; code: string }> = [
  { id: "intro", label: "平台介绍", desc: "品牌、信任与服务链路", code: "HOME" },
  { id: "student", label: "学员端", desc: "画像匹配、比较与预约", code: "STU" },
  { id: "coach", label: "教练端", desc: "入驻、线索与经营", code: "COA" },
  { id: "ops", label: "运营端", desc: "审核、排期与转化", code: "OPS" },
];

const sports = ["全部项目", "篮球", "游泳", "乒乓球", "羽毛球", "田径", "足球"];
const cities = ["全部城市", "北京", "上海", "广州", "深圳", "杭州", "成都"];
const goals = ["全部目标", "兴趣入门", "青训启蒙", "专项提升", "比赛备战", "体能改善", "考试训练", "考级训练"];
const budgets = ["不限预算", "400 以下", "400-600", "600 以上"];

const serviceJourney = [
  ["01", "核验供给", "统一审核退役证明、等级证书、执教经历和教学视频。", "已上线"],
  ["02", "智能匹配", "按城市、项目、预算、目标、可约时间生成可解释推荐。", "完善中"],
  ["03", "试课转化", "把咨询、排期、试课反馈和复购建议放入同一闭环。", "完善中"],
  ["04", "教练经营", "给教练提供名片、线索、课包和收入管理。", "规划中"],
];

const opsQueue = [
  ["李辰", "篮球", "前省青年队", "材料待补充", "高"],
  ["孙可", "网球", "一级运动员", "等待视频审核", "中"],
  ["高雅", "游泳", "社会体育指导员", "可进入面谈", "中"],
];

const appointments = [
  ["19:30", "周明", "篮球试课", "待确认场馆"],
  ["20:00", "陈思雨", "羽毛球进阶", "已确认"],
  ["明日 10:00", "林悦", "儿童游泳", "待家长回复"],
];

const coachLeads = [
  ["张同学", "篮球", "校队选拔", "高意向"],
  ["林女士", "羽毛球", "成人兴趣", "待报价"],
  ["陈同学", "田径", "中考体育", "需排期"],
];

const coachPackages = [
  ["青训启蒙包", "6 节起", "动作标准化 + 兴趣建立"],
  ["比赛提升包", "10 节起", "专项技术 + 视频复盘"],
  ["体测冲刺包", "8 节起", "目标拆解 + 每周测评"],
];

const platformStats = [
  ["128", "认证教练", "+18 本月新增"],
  ["31%", "试课转化", "+6.4% 周环比"],
  ["48h", "入驻审核", "材料闭环"],
  ["4.9", "课程评分", "试课后回收"],
];

const pipeline = [
  ["新意向", "26", "咨询进入匹配池", "86%"],
  ["已匹配", "18", "完成教练推荐", "68%"],
  ["待试课", "9", "等待时间确认", "44%"],
  ["已转化", "7", "进入课包沟通", "31%"],
];

function cssVars(vars: Record<string, string>) {
  return vars as CSSProperties;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("intro");
  const [sport, setSport] = useState("全部项目");
  const [city, setCity] = useState("全部城市");
  const [goal, setGoal] = useState("全部目标");
  const [budget, setBudget] = useState("不限预算");
  const [query, setQuery] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(coaches[0].id);
  const [studentLevel, setStudentLevel] = useState("有基础");
  const [ageGroup, setAgeGroup] = useState("青少年");
  const [savedCoachIds, setSavedCoachIds] = useState<number[]>([1, 4]);
  const [messages, setMessages] = useState<string[]>([]);
  const [coachDraft, setCoachDraft] = useState({
    name: "",
    sport: "篮球",
    city: "上海",
    level: "退役运动员",
    price: "400",
    contact: "",
    intro: "",
  });
  const [submittedCoach, setSubmittedCoach] = useState<typeof coachDraft | null>(null);

  const filteredCoaches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return coaches.filter((coach) => {
      const matchSport = sport === "全部项目" || coach.sport === sport;
      const matchCity = city === "全部城市" || coach.city === city;
      const matchGoal = goal === "全部目标" || coach.goals.includes(goal);
      const matchBudget =
        budget === "不限预算" ||
        (budget === "400 以下" && coach.price < 400) ||
        (budget === "400-600" && coach.price >= 400 && coach.price <= 600) ||
        (budget === "600 以上" && coach.price > 600);
      const matchQuery =
        !normalizedQuery ||
        [coach.name, coach.sport, coach.city, coach.title, coach.record, coach.story]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchSport && matchCity && matchGoal && matchBudget && matchQuery;
    });
  }, [sport, city, goal, budget, query]);

  const selectedCoach =
    filteredCoaches.find((coach) => coach.id === selectedCoachId) ??
    filteredCoaches[0] ??
    coaches[0];
  const activeMeta = views.find((view) => view.id === activeView) ?? views[0];
  const savedCoaches = coaches.filter((coach) => savedCoachIds.includes(coach.id));
  const fitScore = useMemo(() => {
    const audienceBonus = selectedCoach.audience.includes(ageGroup) ? 5 : 0;
    const goalBonus = selectedCoach.goals.includes(goal) ? 4 : 0;
    const statusBonus = selectedCoach.status === "优先推荐" ? 3 : selectedCoach.status === "已核验" ? 2 : 0;
    return Math.min(98, Math.round(selectedCoach.rating * 17 + audienceBonus + goalBonus + statusBonus));
  }, [ageGroup, goal, selectedCoach]);
  const draftCompleteness = Math.min(
    100,
    18 +
      (coachDraft.name ? 14 : 0) +
      (coachDraft.contact ? 14 : 0) +
      (coachDraft.intro ? 24 : 0) +
      (coachDraft.price ? 12 : 0) +
      (coachDraft.city ? 9 : 0) +
      (coachDraft.sport ? 9 : 0),
  );

  function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages((current) => [`已为 ${selectedCoach.name} 创建试课跟进，运营端同步进入排期队列`, ...current].slice(0, 3));
  }

  function handleCoachSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedCoach(coachDraft);
  }

  function updateDraft(field: keyof typeof coachDraft, value: string) {
    setCoachDraft((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setSport("全部项目");
    setCity("全部城市");
    setGoal("全部目标");
    setBudget("不限预算");
    setQuery("");
  }

  function toggleSaved(id: number) {
    setSavedCoachIds((current) => (current.includes(id) ? current.filter((coachId) => coachId !== id) : [...current, id]));
  }

  return (
    <main className="platform-shell">
      <aside className="desktop-sidebar" aria-label="平台工作区导航">
        <div className="brand-block">
          <span className="brand-mark">ZG</span>
          <div>
            <strong>逐光教练</strong>
            <small>退役运动员教练服务平台</small>
          </div>
        </div>

        <nav className="desktop-nav" aria-label="平台视图">
          {views.map((view) => (
            <button
              aria-pressed={activeView === view.id}
              className={activeView === view.id ? "nav-card active" : "nav-card"}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              <span className="nav-code">{view.code}</span>
              <span>{view.label}</span>
              <small>{view.desc}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span>今日运营状态</span>
          <strong>26 个试课意向</strong>
          <p>9 个待确认时间，3 位教练资料复核中。</p>
          <div className="status-strip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </aside>

      <section className="main-stage">
        <header className="topbar">
          <div>
            <p className="eyebrow">ZhuGuang Coach OS</p>
            <h1>{activeMeta.label} / {activeMeta.desc}</h1>
          </div>
          <div className="topbar-actions">
            <input
              aria-label="全局搜索"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索教练、项目、城市"
              type="search"
              value={query}
            />
            <button className="primary-button" onClick={() => setActiveView("student")} type="button">
              开始匹配
            </button>
          </div>
        </header>

        <nav className="mobile-tabs" aria-label="移动端导航">
          {views.map((view) => (
            <button
              aria-pressed={activeView === view.id}
              className={activeView === view.id ? "active" : ""}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              <span>{view.code}</span>
              {view.label}
            </button>
          ))}
        </nav>

        <div className="view-frame" key={activeView}>
          {activeView === "intro" && (
            <section className="intro-layout">
              <div className="intro-copy panel hero-panel">
                <span className="section-label">平台定位</span>
                <h2>让优秀退役运动员，被真正需要训练结果的人找到。</h2>
                <p>
                  逐光把教练核验、课程画像、学员匹配、试课跟进和运营审核放在同一条链路里。
                  它不是广告页，而是一个可持续扩展的体育教练服务平台。
                </p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => setActiveView("student")} type="button">
                    查看学员端
                  </button>
                  <button className="secondary-button" onClick={() => setActiveView("coach")} type="button">
                    教练申请入驻
                  </button>
                </div>
              </div>

              <div className="hero-visual">
                <img src="/coach-visual.png" alt="教练指导学员训练" />
                <div className="match-card">
                  <span>本周最佳匹配</span>
                  <strong>周明 / 篮球青训</strong>
                  <small>校队选拔目标，匹配度 94%</small>
                </div>
                <div className="scan-line" aria-hidden="true" />
              </div>

              <div className="metric-grid">
                {platformStats.map(([value, label, hint], index) => (
                  <div className="metric-card panel" key={label} style={cssVars({ "--delay": `${index * 60}ms` })}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                    <small>{hint}</small>
                  </div>
                ))}
              </div>

              <div className="journey-grid">
                {serviceJourney.map(([step, title, body, state], index) => (
                  <article className="journey-card panel" key={step} style={cssVars({ "--delay": `${index * 80}ms` })}>
                    <span>{step}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                    <em>{state}</em>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeView === "student" && (
            <section className="student-layout">
              <aside className="filter-panel panel">
                <div className="panel-heading">
                  <span>学员画像</span>
                  <button onClick={resetFilters} type="button">
                    重置
                  </button>
                </div>
                <label>
                  年龄阶段
                  <select onChange={(event) => setAgeGroup(event.target.value)} value={ageGroup}>
                    <option>儿童</option>
                    <option>青少年</option>
                    <option>成人</option>
                    <option>白领</option>
                  </select>
                </label>
                <label>
                  训练基础
                  <select onChange={(event) => setStudentLevel(event.target.value)} value={studentLevel}>
                    <option>零基础</option>
                    <option>有基础</option>
                    <option>比赛提升</option>
                    <option>考试冲刺</option>
                  </select>
                </label>
                <label>
                  项目
                  <select onChange={(event) => setSport(event.target.value)} value={sport}>
                    {sports.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  城市
                  <select onChange={(event) => setCity(event.target.value)} value={city}>
                    {cities.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  目标
                  <select onChange={(event) => setGoal(event.target.value)} value={goal}>
                    {goals.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  预算
                  <select onChange={(event) => setBudget(event.target.value)} value={budget}>
                    {budgets.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="filter-summary">
                  <strong>{filteredCoaches.length}</strong>
                  <span>位教练符合当前条件</span>
                </div>
              </aside>

              <section className="coach-list-panel panel">
                <div className="section-header">
                  <div>
                    <span>教练库</span>
                    <strong>{filteredCoaches.length} 位匹配教练</strong>
                  </div>
                  <small>核验状态、响应速度、评分与目标适配综合排序</small>
                </div>
                <div className="coach-list">
                  {filteredCoaches.map((coach, index) => (
                    <button
                      className={selectedCoach.id === coach.id ? "coach-row selected" : "coach-row"}
                      key={coach.id}
                      onClick={() => setSelectedCoachId(coach.id)}
                      style={cssVars({ "--accent": coach.accent, "--delay": `${index * 45}ms` })}
                      type="button"
                    >
                      <span className="avatar">{coach.name.slice(0, 1)}</span>
                      <span className="coach-main">
                        <span className="coach-title">
                          <strong>{coach.name}</strong>
                          <em>{coach.status}</em>
                        </span>
                        <small>{coach.title}</small>
                        <span className="meta-line">
                          {coach.city} / {coach.sport} / ￥{coach.price}/课 / {coach.response}响应
                        </span>
                      </span>
                      <span className="score">
                        {coach.rating}
                        <small>{coach.lessons} 课</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="profile-panel panel" style={cssVars({ "--accent": selectedCoach.accent })}>
                <div className="profile-image">
                  <img src="/coach-visual.png" alt="训练场景" />
                </div>
                <div className="profile-head">
                  <span className="avatar large">{selectedCoach.name.slice(0, 1)}</span>
                  <div>
                    <small>{selectedCoach.status}</small>
                    <h2>{selectedCoach.name}</h2>
                    <p>{selectedCoach.title}</p>
                  </div>
                </div>
                <div className="fit-module">
                  <span>当前学员画像</span>
                  <strong>{fitScore}%</strong>
                  <small>
                    {ageGroup} / {studentLevel} / {goal}
                  </small>
                  <div className="progress-track" aria-hidden="true">
                    <i style={cssVars({ "--progress": `${fitScore}%` })} />
                  </div>
                </div>
                <p className="profile-summary">{selectedCoach.story}</p>
                <div className="detail-grid">
                  <span>
                    <small>城市</small>
                    {selectedCoach.city}
                  </span>
                  <span>
                    <small>项目</small>
                    {selectedCoach.sport}
                  </span>
                  <span>
                    <small>单课</small>
                    ￥{selectedCoach.price}
                  </span>
                  <span>
                    <small>评分</small>
                    {selectedCoach.rating}
                  </span>
                </div>
                <div className="tag-section">
                  <h3>擅长方向</h3>
                  <div className="tag-list">
                    {selectedCoach.strengths.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
                <form className="booking-form" onSubmit={handleBooking}>
                  <label>
                    试课时间
                    <select defaultValue={selectedCoach.availability}>
                      <option>{selectedCoach.availability}</option>
                      <option>本周末电话确认</option>
                      <option>工作日晚间优先</option>
                    </select>
                  </label>
                  <label>
                    学员目标
                    <input placeholder="例如：3 个月提升校队选拔水平" required />
                  </label>
                  <div className="button-row">
                    <button className="secondary-button" onClick={() => toggleSaved(selectedCoach.id)} type="button">
                      {savedCoachIds.includes(selectedCoach.id) ? "移出对比" : "加入对比"}
                    </button>
                    <button className="primary-button" type="submit">
                      创建试课跟进
                    </button>
                  </div>
                </form>
                {savedCoaches.length > 0 && (
                  <div className="compare-strip" aria-label="教练对比列表">
                    {savedCoaches.slice(0, 3).map((coach) => (
                      <span key={coach.id}>{coach.name}</span>
                    ))}
                  </div>
                )}
                {messages.length > 0 && (
                  <div className="notice-stack">
                    {messages.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                )}
              </aside>
            </section>
          )}

          {activeView === "coach" && (
            <section className="coach-layout">
              <form className="onboard-form panel" onSubmit={handleCoachSubmit}>
                <div className="section-header">
                  <div>
                    <span>教练入驻</span>
                    <strong>资料采集与审核草稿</strong>
                  </div>
                  <small>教练端浏览器表单</small>
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
                      {sports.slice(1).map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    城市
                    <select onChange={(event) => updateDraft("city", event.target.value)} value={coachDraft.city}>
                      {cities.slice(1).map((item) => (
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
                  <div className="draft-box">
                    <strong>
                      {submittedCoach.city} / {submittedCoach.sport} / {submittedCoach.name || "未命名教练"}
                    </strong>
                    <p>
                      {submittedCoach.level}，建议价格 ￥{submittedCoach.price}/课。{submittedCoach.intro}
                    </p>
                  </div>
                )}
              </form>

              <aside className="coach-console">
                <div className="panel income-panel">
                  <span>资料完整度</span>
                  <strong>{draftCompleteness}%</strong>
                  <p>姓名、联系方式、教学经历会直接影响审核效率和学员信任。</p>
                  <div className="progress-track" aria-hidden="true">
                    <i style={cssVars({ "--progress": `${draftCompleteness}%` })} />
                  </div>
                </div>
                <div className="panel live-card">
                  <span className="section-label">名片预览</span>
                  <div className="profile-head mini">
                    <span className="avatar large">{(coachDraft.name || "教").slice(0, 1)}</span>
                    <div>
                      <small>{coachDraft.level}</small>
                      <h2>{coachDraft.name || "你的教练名片"}</h2>
                      <p>
                        {coachDraft.city} / {coachDraft.sport} / ￥{coachDraft.price}/课
                      </p>
                    </div>
                  </div>
                  <p className="profile-summary preview">
                    {coachDraft.intro || "填写教学优势后，这里会生成学员看到的教练简介。"}
                  </p>
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
                  <div className="section-header compact">
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

          {activeView === "ops" && (
            <section className="ops-layout">
              <div className="panel ops-main">
                <div className="section-header">
                  <div>
                    <span>平台运营</span>
                    <strong>审核、撮合、试课转化</strong>
                  </div>
                  <small>运营端 PC 工作台</small>
                </div>
                <div className="pipeline-grid">
                  {pipeline.map(([title, value, desc, progress], index) => (
                    <article className="pipeline-card" key={title} style={cssVars({ "--delay": `${index * 65}ms` })}>
                      <span>{title}</span>
                      <strong>{value}</strong>
                      <small>{desc}</small>
                      <div className="progress-track" aria-hidden="true">
                        <i style={cssVars({ "--progress": progress })} />
                      </div>
                    </article>
                  ))}
                </div>
                <div className="timeline">
                  {serviceJourney.map(([step, title, body, state]) => (
                    <div className="timeline-item" key={step}>
                      <strong>{step}</strong>
                      <div>
                        <h3>{title}</h3>
                        <p>{body}</p>
                        <em>{state}</em>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="ops-side">
                <div className="panel">
                  <div className="section-header compact">
                    <div>
                      <span>审核队列</span>
                      <strong>3 个待处理</strong>
                    </div>
                  </div>
                  <div className="simple-list">
                    {opsQueue.map(([name, sportName, level, state, priority]) => (
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
                  <div className="section-header compact">
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
      </section>
    </main>
  );
}
