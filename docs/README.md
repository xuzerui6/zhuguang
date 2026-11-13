# 逐光项目文档

从[产品首页](../README.md)了解服务与端侧入口；受邀评审先看[产品评审指南](review-guide.md)。

| 主题 | 入口 |
| --- | --- |
| Web 与 API | [根 README](../README.md)、[`wrangler.web.jsonc`](../wrangler.web.jsonc)、[`wrangler.mobile-api.example.jsonc`](../wrangler.mobile-api.example.jsonc) |
| Android、iOS 与桌面 | [原生交付说明](native-apps.md) |
| 微信小程序 | [开发与体验版说明](../miniapp/README.md) |
| 视觉与交互 | [Web 设计系统](design/web-enterprise-design-system.md) |
| CI | [Native Builds 工作流](../.github/workflows/native-builds.yml) |
| 历史记录 | [市场公测收尾](market-beta-release-2026-10-03.md)；历史版本和开关仅代表记录当时 |

## 配置与发布边界

- Web 使用服务端 API 地址 `ZHUGUANG_MOBILE_API_URL`。运营授权以 Web 和 API 一致配置的 `PRIMARY_OPERATOR_EMAIL` 为准。运营密钥、微信 AppSecret、签名材料与真实凭据仅存入受控密钥配置，不进入 Git。
- 渠道键可轮换，仅用于识别渠道，不能代替登录、角色或资源归属检查。主体、备案与客服资料仅使用已核验的真实值。
- 新迁移先在隔离数据库验证历史数据、外键和触发器，再进行兼容性验收。迁移失败先核对实际账本，勿直接重跑或删除数据。
- Web 完成生产构建后，授权发布时使用 `npm run web:worker:deploy`，由脚本生成并使用正确的 Worker 配置。该命令会发布，日常评审只运行本地检查。
- Android 官网和应用内发布分别核对签名、包名、版本、SHA-256、灰度与安装结果。公开下载页显示符合公开分发条件的版本，可能不同于灰度版本。
- 小程序的构建、上传开发版、选为体验版、提交审核和正式发布是不同阶段。任何上线状态以平台实际记录为准。
- Web、API、数据库、Android 与小程序可能按独立节奏交付。确认正在评审的提交、环境和版本，不以本地源码或旧截图推断生产状态。
