# 逐光 Android 学员端设计系统

Figma 文件：[逐光 Android 学员端 MVP 设计系统](https://www.figma.com/design/AW1eZlwYWJTs34Iql1c32O)

设计基准：

- `zhuguang-mobile-mvp-primary.png`：首页、找教练与核心视觉方向。
- `zhuguang-mobile-mvp-lifecycle.png`：预约、消息、个人中心与服务闭环。
- Figma `99 Reference Capture`：由当前本地可运行手机页面导入的像素级参照。

Figma Starter 最多支持 3 个页面，因此文件采用以下结构：

- `00 Design System`：Foundations 与 Components 分区。
- `01 Product Flows`：Student Flows 与 Coach Workspace 分区。
- `99 Reference Capture`：本地成品页面捕获。

## 设计原则

- 工作型服务平台，不采用广告式大标题或悬浮装饰卡片。
- 信息优先级通过留白、字重、边界和局部色彩表达，不依赖大面积渐变。
- 卡片圆角不超过 8px；图标按钮使用熟悉图形并保证至少 44px 触控区域。
- 首页先回答“在哪里、练什么、为什么推荐”，详情页再承载资质、场地、价格和可约时段。
- 匹配分只在运动项目和审核状态通过后计算，并同时解释命中的目标、区域、时间和预算。

## Tokens

### 颜色

| Token | Value | Usage |
| --- | --- | --- |
| `Brand/Primary` | `#087A50` | 主按钮、选中态、可信状态 |
| `Brand/Strong` | `#05633F` | 按压态和高强调文本 |
| `Brand/Soft` | `#E8F5EF` | 轻量选中背景 |
| `Surface/Canvas` | `#F5F7F6` | 应用背景 |
| `Surface/Default` | `#FFFFFF` | 列表、弹层、工具面 |
| `Text/Primary` | `#101B17` | 主文本 |
| `Text/Secondary` | `#65716C` | 辅助文本 |
| `Text/Subtle` | `#8A948F` | 元信息 |
| `Border/Default` | `#E2E8E5` | 分割线、输入边界 |
| `Status/Info` | `#315F93` | 信息状态 |
| `Status/Warning` | `#A86B16` | 待确认、改期 |
| `Status/Danger` | `#C64F45` | 拒绝、取消、注销 |

### 字体

中文使用 `Noto Sans SC`，系统回退为 `PingFang SC`、`Microsoft YaHei`、sans-serif。字距固定为 `0`。

| Style | Size / Line height | Weight |
| --- | --- | --- |
| Display | 32 / 40 | Medium |
| Heading | 24 / 32 | Medium |
| Title | 18 / 26 | Medium |
| Body | 16 / 24 | Regular |
| Label | 14 / 20 | Medium |
| Meta | 12 / 18 | Regular |

### 间距、圆角与动效

- 间距：`4, 8, 12, 16, 20, 24, 32`。
- 圆角：`4, 6, 8`。
- 动效：Fast `160ms`、Standard `200ms`、Emphasized `280ms`。
- 减少动态效果开启时，取消位移和缩放，只保留即时状态变化。

## 组件清单

- Primary / Secondary Button
- Icon Button
- Search Field
- Filter Sheet
- Segmented Tabs
- Coach Card
- Match Reason
- Credential Row
- Status Pill
- Availability Slot
- Booking Summary
- Message Bubble
- Bottom Navigation Item
- Empty State / Skeleton / Toast

## 页面与状态

- 首页：北京区域、运动分类、训练目标、推荐教练、最近预约。
- 找教练：搜索、运动、区域、价格、日期、服务对象和排序。
- 教练详情：审核状态、经历、场地、时段、价格、评价、匹配原因。
- 预约：学员、场地、时段、需求、费用快照、协议、提交结果。
- 消息：会话列表、未读状态、教练/系统消息、恢复应用立即刷新。
- 我的：档案、收藏、记录、保障、协议、隐私、反馈、注销。
- 教练工作台：待确认、改期、拒绝、排期、消息、完成、线下收款。

## 无障碍与适配

- 验收视口：`360×800`、`390×844`、`412×915`、平板、横屏。
- 交互控件触控区域不小于 `44×44px`。
- 支持 Android 状态栏、底部安全区和软键盘顶起。
- 不以颜色作为唯一状态信息，状态必须同时提供文本或图标。
