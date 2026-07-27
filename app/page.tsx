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
    accent: "#ef7f5a",
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
    accent: "#d9a441",
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
    accent: "#4a8f67",
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
    accent: "#226a5c",
  },
];

const sports = ["全部项目", "篮球", "游泳", "乒乓球", "羽毛球", "田径", "足球"];
const cities = ["全部城市", "北京", "上海", "广州", "深圳", "杭州", "成都"];
const goals = ["全部目标", "兴趣入门", "青训启蒙", "专项提升", "比赛备战", "体能改善", "考试训练", "考级训练"];
const budgets = ["不限预算", "400以下", "400-600", "600以上"];

const operatingMetrics = [
  ["128", "认证教练池"],
  ["31%", "试课转化目标"],
  ["4.9", "课程好评均值"],
  ["48h", "入驻审核时效"],
];

const trustSignals = [
  ["01", "身份核验", "退役证明、专业队经历、运动等级和证书材料进入统一审核档案。"],
  ["02", "课程画像", "把教练擅长项目、适合人群、训练目标和可约时间整理成可比较信息。"],
  ["03", "试课闭环", "学员试课后回收体验、结果和复购意愿，持续优化推荐排序。"],
  ["04", "安全边界", "补充场馆、保险、未成年人沟通和训练强度提示，降低交易风险。"],
];

const packages = [
  ["启蒙试课", "1v1 或 1v2", "适合兴趣入门、儿童初学和成人体验", "¥199 起"],
  ["专项提升", "4-8课训练包", "围绕技术短板、体能基础和阶段目标设计", "¥1280 起"],
  ["比赛备战", "周期训练", "校队选拔、业余比赛、中考体育专项冲刺", "定制报价"],
];

const planBlocks = [
  ["定位", "专业退役运动员教练撮合平台", "用身份核验、训练履历和真实课程评价，解决学员不敢选、教练没渠道的双边痛点。"],
  ["冷启动", "先做单城单项目的高质量供给", "建议从你最熟悉的项目切入，先招募20-50位可信教练，人工撮合验证转化。"],
  ["收入", "抽佣 + 认证 + 训练营", "第一阶段按试课和正式课抽佣，第二阶段做教练认证会员、寒暑假训练营和场馆合作。"],
];

const roadmap = [
  ["01", "供给", "完成教练资料模板、身份审核、首批教练邀约。"],
  ["02", "撮合", "上线筛选、试课意向、人工跟进和评价回收。"],
  ["03", "复购", "沉淀训练计划、套餐课和教练成长工具。"],
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("match");
  const [sport, setSport] = useState("全部项目");
  const [city, setCity] = useState("全部城市");
  const [goal, setGoal] = useState("全部目标");
  const [budget, setBudget] = useState("不限预算");
  const [query, setQuery] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(coaches[0].id);
  const [inquiries, setInquiries] = useState<string[]>([]);
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

    return coaches.filter((coachItem) => {
      const matchSport = sport === "全部项目" || coachItem.sport === sport;
      const matchCity = city === "全部城市" || coachItem.city === city;
      const matchGoal = goal === "全部目标" || coachItem.goals.includes(goal);
      const matchBudget =
        budget === "不限预算" ||
        (budget === "400以下" && coachItem.price < 400) ||
        (budget === "400-600" && coachItem.price >= 400 && coachItem.price <= 600) ||
        (budget === "600以上" && coachItem.price > 600);
      const matchQuery =
        !normalizedQuery ||
        [coachItem.name, coachItem.sport, coachItem.city, coachItem.title, coachItem.record, coachItem.story]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchSport && matchCity && matchGoal && matchBudget && matchQuery;
    });
  }, [sport, city, goal, budget, query]);

  const selectedCoach =
    filteredCoaches.find((coachItem) => coachItem.id === selectedCoachId) ??
    filteredCoaches[0] ??
    coaches[0];

  function updateDraft(field: keyof typeof coachDraft, value: string) {
    setCoachDraft((current) => ({ ...current, [field]: value }));
  }

  function handleInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInquiries((current) => [`已向 ${selectedCoach.name} 发送试课意向`, ...current].slice(0, 3));
  }

  function handleCoachSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedCoach(coachDraft);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">ZG</span>
          <div>
            <p className="eyebrow">Coach Intelligence Marketplace</p>
            <h1>逐光教练平台</h1>
          </div>
        </div>
        <nav className="tabs" aria-label="平台模块">
          {[
            ["match", "找教练"],
            ["onboard", "教练入驻"],
            ["plan", "创业方案"],
          ].map(([id, label]) => (
            <button
              aria-pressed={activeTab === id}
              className={activeTab === id ? "tab active" : "tab"}
              key={id}
              onClick={() => setActiveTab(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="draft-badge">私有打磨版</div>
      </header>

      <section className="product-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span>退役运动员教练</span>
            <span>可信履历</span>
            <span>精准试课</span>
          </div>
          <h2>把冠军级训练经验，变成学员可以信任、可以预约的服务。</h2>
          <p>
            第一版以高质量教练池为核心：学员按项目、城市、目标和预算快速筛选；教练通过标准化资料入驻，进入平台审核与推荐。
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setActiveTab("match")} type="button">
              开始匹配
            </button>
            <button className="secondary-button" onClick={() => setActiveTab("plan")} type="button">
              查看创业方案
            </button>
          </div>
        </div>

        <div className="hero-media">
          <img src="/coach-visual.png" alt="专业教练在室内训练馆指导学员训练" />
          <div className="media-card media-card-top">
            <span>履历可信度</span>
            <strong>96%</strong>
          </div>
          <div className="media-card media-card-bottom">
            <span>下次可约</span>
            <strong>今晚 19:30</strong>
          </div>
        </div>
      </section>

      <section className="metric-strip" aria-label="平台关键运营指标">
        {operatingMetrics.map(([value, label]) => (
          <div className="metric-tile" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="trust-section" aria-label="平台信任体系">
        <div className="section-heading">
          <p className="eyebrow">Trust System</p>
          <h2>让学员敢下单，让教练愿意长期留在平台。</h2>
        </div>
        <div className="trust-grid">
          {trustSignals.map(([number, title, body]) => (
            <article className="trust-card" key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {activeTab === "match" && (
        <section className="workspace" aria-label="学员找教练">
          <aside className="filter-panel">
            <div>
              <p className="eyebrow">学员需求</p>
              <h3>精确筛选</h3>
            </div>

            <label>
              搜索
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="教练、城市、项目、训练目标"
                type="search"
                value={query}
              />
            </label>

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

            <button
              className="secondary-button full-button"
              onClick={() => {
                setSport("全部项目");
                setCity("全部城市");
                setGoal("全部目标");
                setBudget("不限预算");
                setQuery("");
              }}
              type="button"
            >
              重置条件
            </button>
          </aside>

          <section className="results-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">推荐排序</p>
                <h3>{filteredCoaches.length} 位高匹配教练</h3>
              </div>
              <span className="status-pill">身份核验优先</span>
            </div>

            <div className="coach-list">
              {filteredCoaches.map((coachItem) => (
                <button
                  className={selectedCoach.id === coachItem.id ? "coach-card selected" : "coach-card"}
                  key={coachItem.id}
                  onClick={() => setSelectedCoachId(coachItem.id)}
                  style={{ "--accent": coachItem.accent } as React.CSSProperties}
                  type="button"
                >
                  <span className="avatar" aria-hidden="true">
                    {coachItem.name.slice(0, 1)}
                  </span>
                  <span className="coach-main">
                    <span className="coach-title-row">
                      <strong>{coachItem.name}</strong>
                      <em>{coachItem.city}</em>
                    </span>
                    <small>{coachItem.title}</small>
                    <span className="chip-row">
                      <span>{coachItem.sport}</span>
                      <span>¥{coachItem.price}/课</span>
                      <span>{coachItem.response}响应</span>
                    </span>
                  </span>
                  <span className="score">
                    {coachItem.rating}
                    <small>{coachItem.lessons}课</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <aside className="detail-panel" style={{ "--accent": selectedCoach.accent } as React.CSSProperties}>
            <div className="detail-head">
              <span className="avatar large" aria-hidden="true">
                {selectedCoach.name.slice(0, 1)}
              </span>
              <div>
                <p className="eyebrow">{selectedCoach.verified}</p>
                <h3>{selectedCoach.name}</h3>
                <p>{selectedCoach.title}</p>
              </div>
            </div>

            <p className="coach-story">{selectedCoach.story}</p>

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
                <small>好评</small>
                {selectedCoach.rating}
              </span>
            </div>

            <div className="section-block">
              <h4>履历摘要</h4>
              <p>{selectedCoach.record}</p>
            </div>

            <div className="section-block">
              <h4>擅长方向</h4>
              <div className="tag-list">
                {selectedCoach.strengths.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className="section-block">
              <h4>适合人群</h4>
              <div className="tag-list">
                {selectedCoach.audience.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

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
                训练目标
                <input placeholder="例如：3个月提升校队选拔水平" required />
              </label>
              <button className="primary-button" type="submit">
                发送试课意向
              </button>
            </form>

            {inquiries.length > 0 && (
              <div className="notice-stack" aria-live="polite">
                {inquiries.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </aside>
        </section>
      )}

      {activeTab === "onboard" && (
        <section className="onboard-layout" aria-label="教练入驻">
          <form className="onboard-form" onSubmit={handleCoachSubmit}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">教练端工作台</p>
                <h3>提交入驻资料</h3>
              </div>
              <span className="status-pill">审核后进入推荐池</span>
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
              生成入驻草稿
            </button>
          </form>

          <aside className="review-panel">
            <p className="eyebrow">平台审核标准</p>
            <h3>把“专业”转化成可被信任的资料</h3>
            <ul className="check-list">
              <li>运动员身份、参赛成绩或专业队经历</li>
              <li>教练证、社会体育指导员证、场馆资质</li>
              <li>可授课时间、价格、城市和适合人群</li>
              <li>教学视频、课程评价和安全责任边界</li>
            </ul>

            {submittedCoach && (
              <div className="draft-preview">
                <p className="eyebrow">已生成草稿</p>
                <h4>
                  {submittedCoach.city} · {submittedCoach.sport} · {submittedCoach.name || "未命名教练"}
                </h4>
                <p>
                  {submittedCoach.level}，建议价格 ¥{submittedCoach.price}/课。{submittedCoach.intro}
                </p>
                <span>下一步：上传证明材料并进入人工审核。</span>
              </div>
            )}
          </aside>
        </section>
      )}

      {activeTab === "plan" && (
        <section className="plan-layout" aria-label="创业方案">
          <div className="plan-hero">
            <p className="eyebrow">创业方案</p>
            <h2>先做可信供给，再做训练服务网络。</h2>
            <p>
              早期不要追求覆盖所有项目。把一个城市、一个项目、一个客群跑透，验证教练获客、学员试课、课程复购和评价回流。
            </p>
          </div>

          <div className="plan-grid">
            {planBlocks.map(([label, title, body]) => (
              <article className="plan-card" key={title}>
                <span>{label}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>

          <div className="strategy-split">
            <section className="roadmap">
              <p className="eyebrow">90天路线图</p>
              {roadmap.map(([step, title, body]) => (
                <div className="timeline-item" key={step}>
                  <strong>{step}</strong>
                  <div>
                    <h4>{title}</h4>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </section>

            <section className="roadmap">
              <p className="eyebrow">关键经营指标</p>
              {[
                ["教练入驻通过率", "衡量供给质量和审核效率"],
                ["咨询到试课转化率", "衡量匹配是否准确"],
                ["试课到复购率", "衡量教练真实交付"],
                ["单教练月均成交", "衡量平台是否真的帮教练赚钱"],
              ].map(([name, meaning]) => (
                <div className="metric-item" key={name}>
                  <strong>{name}</strong>
                  <span>{meaning}</span>
                </div>
              ))}
            </section>
          </div>
        </section>
      )}

      <section className="package-section" aria-label="课程产品">
        <div className="section-heading">
          <p className="eyebrow">Training Products</p>
          <h2>把教练能力包装成清晰可买的课程产品。</h2>
        </div>
        <div className="package-grid">
          {packages.map(([name, format, body, price]) => (
            <article className="package-card" key={name}>
              <div>
                <span>{format}</span>
                <h3>{name}</h3>
              </div>
              <p>{body}</p>
              <strong>{price}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
