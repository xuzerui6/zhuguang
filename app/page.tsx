"use client";

import { FormEvent, useMemo, useState } from "react";

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
  verified: string;
  audience: string[];
  goals: string[];
  strengths: string[];
  availability: string;
  story: string;
  status: "已核验" | "复核中" | "优先推荐";
  accent: string;
};

const coaches: Coach[] = [
  {
    id: 1,
    name: "周明",
    sport: "篮球",
    city: "上海",
    title: "前CBA青年队后卫 / 青训专项教练",
    record: "12年职业训练经历，退役后专注8-16岁控运与比赛阅读。",
    price: 420,
    rating: 4.9,
    lessons: 318,
    response: "12分钟",
    verified: "退役运动员身份已核验",
    audience: ["青少年", "比赛提升", "校队选拔"],
    goals: ["专项提升", "青训启蒙", "比赛备战"],
    strengths: ["控运节奏", "一对一突破", "比赛决策"],
    availability: "周二/四晚间，周末上午",
    story: "适合想从兴趣课进入系统训练的学员，课程重视动作细节和对抗中的选择。",
    status: "优先推荐",
    accent: "#d66f51",
  },
  {
    id: 2,
    name: "林悦",
    sport: "游泳",
    city: "广州",
    title: "前省队自由泳运动员 / 儿童安全训练教练",
    record: "省队训练背景，持社会体育指导员证，擅长从怕水到规范泳姿。",
    price: 360,
    rating: 4.8,
    lessons: 275,
    response: "25分钟",
    verified: "证书与运动经历已核验",
    audience: ["儿童", "成人入门", "体能恢复"],
    goals: ["兴趣入门", "体能改善", "考级训练"],
    strengths: ["水感建立", "自由泳换气", "安全习惯"],
    availability: "工作日白天，周六全天",
    story: "适合初学者和重视安全感的家庭，课程节奏温和但标准明确。",
    status: "已核验",
    accent: "#2f7f9f",
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
    response: "18分钟",
    verified: "专业队经历已核验",
    audience: ["成人", "青少年", "业余比赛"],
    goals: ["专项提升", "比赛备战", "考级训练"],
    strengths: ["正反手衔接", "发抢体系", "落点变化"],
    availability: "周一/三/五晚间",
    story: "适合有一定基础、想突破瓶颈的学员，训练会围绕实战得分方式设计。",
    status: "优先推荐",
    accent: "#bf8b2f",
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
    response: "9分钟",
    verified: "高水平运动员身份已核验",
    audience: ["白领", "亲子", "比赛提升"],
    goals: ["兴趣入门", "专项提升", "比赛备战"],
    strengths: ["启动步法", "后场杀吊", "双打轮转"],
    availability: "周末下午，工作日晚间",
    story: "适合希望训练效率高、兼顾运动体验的学员，课程常配合视频复盘。",
    status: "已核验",
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
    response: "36分钟",
    verified: "运动员等级与证书已核验",
    audience: ["中考体育", "成人跑者", "体能改善"],
    goals: ["体能改善", "考试训练", "专项提升"],
    strengths: ["起跑技术", "跑姿经济性", "下肢爆发力"],
    availability: "周二/四/日",
    story: "适合目标明确的学员，课程会把速度、力量和伤病预防放在一起设计。",
    status: "复核中",
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
    response: "21分钟",
    verified: "梯队经历已核验",
    audience: ["儿童", "青少年", "校队选拔"],
    goals: ["青训启蒙", "专项提升", "比赛备战"],
    strengths: ["第一脚触球", "变向摆脱", "小组配合"],
    availability: "周三晚间，周末全天",
    story: "适合希望建立长期训练习惯的孩子，训练内容会兼顾趣味和竞技基础。",
    status: "已核验",
    accent: "#226a5c",
  },
];

const sports = ["全部项目", "篮球", "游泳", "乒乓球", "羽毛球", "田径", "足球"];
const cities = ["全部城市", "北京", "上海", "广州", "深圳", "杭州", "成都"];
const goals = ["全部目标", "兴趣入门", "青训启蒙", "专项提升", "比赛备战", "体能改善", "考试训练", "考级训练"];
const budgets = ["不限预算", "400以下", "400-600", "600以上"];

const dashboardStats = [
  ["128", "认证教练"],
  ["26", "待跟进试课"],
  ["31%", "咨询转化"],
  ["4.9", "平均评分"],
];

const verificationItems = ["身份材料", "运动履历", "证书资质", "教学视频", "安全边界"];
const reviewQueue = [
  ["李辰", "篮球", "前省青年队", "材料待补充"],
  ["孙可", "网球", "一级运动员", "等待视频审核"],
  ["高雅", "游泳", "社会体育指导员", "可进入面谈"],
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("library");
  const [sport, setSport] = useState("全部项目");
  const [city, setCity] = useState("全部城市");
  const [goal, setGoal] = useState("全部目标");
  const [budget, setBudget] = useState("不限预算");
  const [query, setQuery] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(coaches[0].id);
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
        (budget === "400以下" && coach.price < 400) ||
        (budget === "400-600" && coach.price >= 400 && coach.price <= 600) ||
        (budget === "600以上" && coach.price > 600);
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

  function updateDraft(field: keyof typeof coachDraft, value: string) {
    setCoachDraft((current) => ({ ...current, [field]: value }));
  }

  function handleInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages((current) => [`已为 ${selectedCoach.name} 创建试课跟进`, ...current].slice(0, 3));
  }

  function handleCoachSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedCoach(coachDraft);
  }

  return (
    <main className="platform-shell">
      <aside className="side-nav">
        <div className="brand-block">
          <span className="brand-mark">ZG</span>
          <div>
            <strong>逐光教练</strong>
            <small>私有服务平台</small>
          </div>
        </div>

        <nav className="module-nav" aria-label="平台模块">
          {[
            ["library", "教练库"],
            ["onboard", "入驻审核"],
            ["ops", "运营看板"],
          ].map(([id, label]) => (
            <button
              aria-pressed={activeTab === id}
              className={activeTab === id ? "nav-item active" : "nav-item"}
              key={id}
              onClick={() => setActiveTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="side-card">
          <span>本周服务状态</span>
          <strong>稳定运营</strong>
          <p>26个试课意向，9个待确认时间，3个教练资料复核中。</p>
        </div>

        <div className="side-metrics">
          <span>
            <strong>48h</strong>
            入驻审核
          </span>
          <span>
            <strong>92%</strong>
            资料完整率
          </span>
        </div>
      </aside>

      <section className="workbench">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Service Console</p>
            <h1>教练匹配与履历审核工作台</h1>
          </div>
          <div className="header-actions">
            <input
              aria-label="全局搜索"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索教练、项目、城市"
              type="search"
              value={query}
            />
            <button className="primary-button" onClick={() => setActiveTab("onboard")} type="button">
              新教练入驻
            </button>
          </div>
        </header>

        <section className="stat-row" aria-label="关键指标">
          {dashboardStats.map(([value, label]) => (
            <div className="stat-card" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        {activeTab === "library" && (
          <section className="library-grid" aria-label="教练库">
            <aside className="filter-panel">
              <div className="panel-title">
                <span>筛选条件</span>
                <button
                  onClick={() => {
                    setSport("全部项目");
                    setCity("全部城市");
                    setGoal("全部目标");
                    setBudget("不限预算");
                    setQuery("");
                  }}
                  type="button"
                >
                  重置
                </button>
              </div>
              <label>
                运动项目
                <select onChange={(event) => setSport(event.target.value)} value={sport}>
                  {sports.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                所在城市
                <select onChange={(event) => setCity(event.target.value)} value={city}>
                  {cities.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                训练目标
                <select onChange={(event) => setGoal(event.target.value)} value={goal}>
                  {goals.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                单课预算
                <select onChange={(event) => setBudget(event.target.value)} value={budget}>
                  {budgets.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </aside>

            <section className="coach-directory">
              <div className="section-bar">
                <div>
                  <span>教练库</span>
                  <strong>{filteredCoaches.length} 位匹配</strong>
                </div>
                <small>按核验状态、响应速度、复购评分排序</small>
              </div>

              <div className="coach-list">
                {filteredCoaches.map((coach) => (
                  <button
                    className={selectedCoach.id === coach.id ? "coach-row selected" : "coach-row"}
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    style={{ "--accent": coach.accent } as React.CSSProperties}
                    type="button"
                  >
                    <span className="avatar">{coach.name.slice(0, 1)}</span>
                    <span className="coach-info">
                      <span>
                        <strong>{coach.name}</strong>
                        <em>{coach.status}</em>
                      </span>
                      <small>{coach.title}</small>
                      <span className="meta-line">
                        {coach.city} · {coach.sport} · ¥{coach.price}/课 · {coach.response}响应
                      </span>
                    </span>
                    <span className="coach-score">
                      {coach.rating}
                      <small>{coach.lessons}课</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="profile-panel" style={{ "--accent": selectedCoach.accent } as React.CSSProperties}>
              <div className="facility-thumb">
                <img src="/coach-visual.png" alt="训练场景缩略图" />
              </div>
              <div className="profile-head">
                <span className="avatar large">{selectedCoach.name.slice(0, 1)}</span>
                <div>
                  <p>{selectedCoach.verified}</p>
                  <h2>{selectedCoach.name}</h2>
                  <span>{selectedCoach.title}</span>
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
                  ¥{selectedCoach.price}
                </span>
                <span>
                  <small>评分</small>
                  {selectedCoach.rating}
                </span>
              </div>

              <section className="profile-section">
                <h3>核验材料</h3>
                <div className="check-grid">
                  {verificationItems.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </section>

              <section className="profile-section">
                <h3>擅长方向</h3>
                <div className="tag-list">
                  {selectedCoach.strengths.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </section>

              <form className="booking-form" onSubmit={handleInquiry}>
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
                  <input placeholder="例如：3个月提升校队选拔水平" required />
                </label>
                <button className="primary-button" type="submit">
                  创建试课跟进
                </button>
              </form>

              {messages.length > 0 && (
                <div className="notice-stack" aria-live="polite">
                  {messages.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              )}
            </aside>
          </section>
        )}

        {activeTab === "onboard" && (
          <section className="onboard-grid" aria-label="入驻审核">
            <form className="onboard-form" onSubmit={handleCoachSubmit}>
              <div className="section-bar">
                <div>
                  <span>教练入驻</span>
                  <strong>标准化资料采集</strong>
                </div>
                <small>用于人工核验与推荐池排序</small>
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
                  运动项目
                  <select onChange={(event) => updateDraft("sport", event.target.value)} value={coachDraft.sport}>
                    {sports.slice(1).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  授课城市
                  <select onChange={(event) => updateDraft("city", event.target.value)} value={coachDraft.city}>
                    {cities.slice(1).map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  身份背景
                  <select onChange={(event) => updateDraft("level", event.target.value)} value={coachDraft.level}>
                    <option>退役运动员</option>
                    <option>前专业队队员</option>
                    <option>高水平运动员</option>
                    <option>持证专项教练</option>
                  </select>
                </label>
                <label>
                  建议单课价格
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
                生成审核草稿
              </button>
            </form>

            <aside className="review-panel">
              <div className="section-bar compact">
                <div>
                  <span>审核队列</span>
                  <strong>3 个待处理</strong>
                </div>
              </div>
              <div className="queue-list">
                {reviewQueue.map(([name, sportName, level, state]) => (
                  <div className="queue-item" key={name}>
                    <span className="avatar small">{name.slice(0, 1)}</span>
                    <div>
                      <strong>{name}</strong>
                      <small>
                        {sportName} · {level}
                      </small>
                    </div>
                    <em>{state}</em>
                  </div>
                ))}
              </div>

              {submittedCoach && (
                <div className="draft-preview">
                  <span>已生成草稿</span>
                  <strong>
                    {submittedCoach.city} · {submittedCoach.sport} · {submittedCoach.name || "未命名教练"}
                  </strong>
                  <p>
                    {submittedCoach.level}，建议价格 ¥{submittedCoach.price}/课。{submittedCoach.intro}
                  </p>
                </div>
              )}
            </aside>
          </section>
        )}

        {activeTab === "ops" && (
          <section className="ops-grid" aria-label="运营看板">
            <div className="ops-card wide">
              <div className="section-bar">
                <div>
                  <span>运营目标</span>
                  <strong>先把可信供给做深，再扩城市和项目</strong>
                </div>
                <small>90天验证路径</small>
              </div>
              <div className="timeline">
                {[
                  ["01", "供给", "完成20-50位教练邀约、履历审核和资料标准化。"],
                  ["02", "撮合", "上线试课意向、人工跟进和学员评价回收。"],
                  ["03", "复购", "沉淀套餐课、训练计划和教练增长工具。"],
                ].map(([step, title, body]) => (
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

            <div className="ops-card">
              <span>收入模型</span>
              <strong>试课撮合抽佣</strong>
              <p>早期用试课和正式课抽佣验证交易闭环，后续再做认证会员、训练营和场馆合作。</p>
            </div>
            <div className="ops-card">
              <span>关键风险</span>
              <strong>履历可信与交付一致</strong>
              <p>必须把身份审核、真实评价、教学视频和安全边界做成平台基础设施。</p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
