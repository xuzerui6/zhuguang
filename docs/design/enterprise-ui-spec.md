# 逐光 Coach OS 企业级 UI 方案

## 定位

逐光不再表现为广告介绍页，而是一个面向退役运动员教练供给、学员匹配、试课履约和运营治理的全平台服务系统。

核心界面按环境自动分流：

- 未登录根路径：先进入公开官网介绍，建立信任、说明平台机制，并提供登录、预约找教练、注册教练入口。
- 登录/进入后：再展示平台操作界面，按设备和来源进入 PC 工作台、手机预约流或原生应用壳。
- PC / 桌面端：推荐队列、审核队列、教练入驻、应用交付。
- 手机端：找教练、预约确认、教练入驻、浏览器安装。
- 原生壳：iOS、Android、Windows、Linux、macOS 共享同一套入口与品牌资产。

## 设计参考方向

- 公开官网首页：白底产品感、清晰首屏、真实产品预览和下探式信息架构，参考 Apple Fitness+ 的产品清晰度、Strava 的运动社区和跨端叙事、BetterUp 的企业级导航与信任背书。
- 企业级工作台：高密度、低装饰、强表格扫描能力，参考飞书多维表格、钉钉宜搭、Linear、Stripe Dashboard 的信息层级。
- 移动端服务流：少入口、强任务路径、卡片化决策，参考 Apple / Airbnb / 大众点评的移动预约体验。
- 设计系统：8px 内圆角、清晰分割线、克制阴影、绿色品牌主色配合中性色和状态色。

## 视觉 Token

- Brand: `#078348`
- Brand Dark: `#07131a`
- Canvas: `#f7f9f8`
- Surface: `#ffffff`
- Surface Soft: `#f5f7f6`
- Border: `rgba(7, 19, 26, 0.10)`
- Text Primary: `#07131a`
- Text Secondary: `#5d6f66`
- Radius: `8px`
- Font Stack: `Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, Arial, sans-serif`

## 关键界面

### 公开官网首页

- 顶部多级菜单：平台产品、解决方案、教练资源、客户案例、关于我们、帮助中心。
- 首屏 H1：`让专业运动员，成为每个学员的长期教练`。
- 首屏产品信号：左侧价值表达和转化入口，右侧组合展示手机找教练流与 PC 运营工作台。
- 信任条：真实身份认证、运动员履历校验、教学成果验证、服务合同与保险。
- 三角色服务入口：学员找教练、教练入驻经营、机构运营治理。
- 流程区：核验教练供给、解释匹配原因、完成试课履约、沉淀长期成长。

### PC 工作台

- 深色分组侧栏：智能工作台、学员服务、教练供给、运营治理、应用交付。
- 顶部命令栏：当前任务、搜索、开始匹配、应用版本。
- 自动入口卡片：根据设备/来源自动说明当前推荐入口。
- KPI Strip：待匹配学员、高契合推荐、试课待安排、今日试课、7日转化率、30日满意度。
- 学员匹配工作台：筛选器、表格、契合度、阶段、更新时间、操作。
- 教练信任档案：资质认证、履历荣誉、教学能力、合规风险。
- 服务队列：服务队列、风险预警、智能建议。

### 手机端

- 自动进入“找教练”，不要求用户手动选择端类型。
- 保留高频任务：匹配、比较、预约、确认。
- 手机卡片展示 Fit 分、教练身份、可约时间和推荐解释。
- 底部四入口导航：匹配、教练、预约、我的。

## Figma

- 文件：逐光 Coach OS - Enterprise Homepage V18
- URL: https://www.figma.com/design/J9CGnw7hUc9gTDljq6aWOC
- 状态：文件可创建；当前 Figma MCP 的 metadata/library/use_figma 写入接口对该 fileKey 返回 `INVALID_ARGUMENT`，需要账号 seat 或 Figma 连接恢复后继续写入画板。

## QA 截图

- 桌面截图：`outputs/qa-enterprise-desktop.png`
- 手机截图：`outputs/qa-enterprise-mobile.png`
- 官网入口概念图：`docs/design/zhuguang-public-landing-concept.png`
- 企业级官网首页概念图：`docs/design/zhuguang-enterprise-homepage-v18-concept.png`
- 设计概念图：`docs/design/zhuguang-enterprise-dashboard-concept.png`

## 验证结论

- `npm run lint` 通过。
- `npm test` 通过，包含生产构建和 SSR UI 断言。
- `npm run native:check` 通过。
- 桌面 1440px：无横向溢出，匹配表操作列完整显示。
- 手机 390px + iPhone UA：自动进入手机端预约流，`scrollWidth === clientWidth`，无 console error 和请求失败。
