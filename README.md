# 逐光运动教练服务平台

逐光服务北京与吉林长春，帮助学员家庭查找已核验的运动教练、发起预约并记录训练进展。教练可以管理预约、日程和训练记录，运营人员负责资料审核、服务支持与版本管理。

[访问官网](https://beijingzhuguang.top/) · [查找教练](https://beijingzhuguang.top/coaches) · [下载 Android](https://beijingzhuguang.top/download) · [产品评审指南](docs/review-guide.md) · [项目文档](docs/README.md)

## 产品入口

| 入口 | 适合谁 | 能做什么 |
| --- | --- | --- |
| 官网 | 家长、学员、访客 | 按城市查找教练，查看已公开资料，了解课程或发起咨询 |
| 学员端 | 已登录的学员家庭 | 管理学员档案，指定训练时间和地点，与教练协商并查看训练记录 |
| 教练工作台 | 已核验教练 | 处理预约与反提案，管理日程、消息、履约和训练记录 |
| 运营后台 | 获授权的运营人员 | 审核教练及资料、处理工单、管理经营设置与版本 |
| Android | 学员与教练 | 在同一 App 内切换授权身份；安装包和版本信息以下载页为准 |
| 微信小程序 | 受邀测试者 | 学员和教练双身份开发版；正式发布状态以微信公众平台为准 |

预约由教练确认后生效。公开项目、教练、课程与场馆以实际审核和发布结果为准。线上支付、退款和分账暂未开放。iOS 与桌面工程是开发交付入口，不代表已对外发布。

## 本地开发

建议使用 Node.js 24（与 CI 一致）。私有仓库须先获得访问权限。

```bash
npm ci
npm run dev
```

按终端输出的本地地址打开网站。需要验证登录、写操作或第三方集成时，使用独立测试 API、测试账号和测试数据；不要在正式环境制造预约、订单或通知。

```bash
npm run typecheck
npm run lint
npm test
```

`npm test` 运行单元/API 测试、生产构建及 SSR 回归。移动端入口见[原生交付说明](docs/native-apps.md)和[小程序开发说明](miniapp/README.md)。

## 工程结构

| 目录 | 职责 |
| --- | --- |
| `app/` | Next.js 路由、Vinext 网页构建、三个工作区与共享移动 UI |
| `server/api/`、`worker/` | Cloudflare Workers API、会话、角色授权与业务处理 |
| `db/`、`drizzle/` | D1 数据模型与按顺序执行的增量迁移 |
| `shared/` | 跨端业务模型、规则与展示逻辑 |
| `native/mobile/`、`android/`、`ios/` | Capacitor 移动工程；Android 包名 `com.zhuguang.coachos` |
| `miniapp/` | Taro 微信小程序 |
| `tests/`、`.github/workflows/` | 自动化回归和 CI 检查 |

正式 API 位于 [api.beijingzhuguang.top](https://api.beijingzhuguang.top/api/v1/health)。网页工作区由服务端验证会话和角色；客户端菜单仅用于导航。D1 和 R2 绑定由运行环境提供，媒体和 APK 存储保持私有。

评审反馈请使用仓库的 [Issues](https://github.com/xuzerui6/zhuguang/issues)，敏感问题通过私下渠道报告。更多配置、验收和发布边界见[项目文档](docs/README.md)。
