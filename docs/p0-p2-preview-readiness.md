# 逐光 P0/P1 与北京业务扩展预览说明

## 边界

- 经营城市固定为北京，目录、教练服务区域、场馆、咨询和预约写入均校验北京 16 区。
- 本轮迁移只新增表、索引和可空字段，不删除或改写历史数据。
- 正式环境的新增能力开关全部保持关闭；没有执行正式 D1 迁移、Worker 发布或 Android 分发。
- 测试交易只允许 `APP_ENV != production` 且 `PAYMENT_PROVIDER=test`，生产环境会硬拒绝。

## Cloudflare Worker 职责

- `zhuguang-web`：承载官网、响应式工作台和同源 API 代理。它不直接保存业务密钥到浏览器，也不应直接读取私有 R2。
- `zhuguang-mobile-api`：承载 `/api/v1`、D1 业务数据、私有教练媒体、私有 Android 安装包、登录、预约、消息、审核和通知调度。
- Sites 旧版本只作为不绑定正式域名的回退，不应继续承担正式域名流量。

## 功能开关

| 配置 | 正式默认 | 启用前置 |
| --- | --- | --- |
| `BEIJING_CATALOG_V2_ENABLED` | `false` | 目录迁移、真实教练与项目/区域关系人工核验 |
| `FULFILLMENT_V2_ENABLED` | `false` | 完成确认、异议与售后流程验收 |
| `SUPPORT_EVIDENCE_ENABLED` | `false` | 私有 `EVIDENCE` R2、保存期限和客服责任人 |
| `ONLINE_TRANSACTION_ENABLED` | `false` | 真实商户、收费/退款/发票规则；测试提供者不得用于生产 |
| `PAYMENT_PROVIDER` | `none` | 预览测试可用 `test`，生产不得使用 |
| `PUBLIC_TRUST_METRICS_ENABLED` | `false` | 历史账号与预约完成真实/QA 分类 |

## 增量迁移

- `0015_beijing_service_catalog.sql`：北京 16 区、运动项目目录及教练多对多关系。
- `0016_booking_contract_and_evidence.sql`：不可变预约快照、完成确认和私有售后附件元数据。
- `0017_transaction_sandbox.sql`：支付订单、尝试、退款、退款事件和对账批次。
- `0018_trust_metric_provenance.sql`：数据分类、指标资格和核验事件。

回滚优先关闭开关并回退 Worker 版本。增量表和可空字段保留；如需修正数据，新增补偿迁移，不直接删除正式数据。

## 生产启用阻塞

- 真实经营主体名称。
- 客服邮箱、客服电话和投诉联系方式。
- ICP 备案号、公安备案号和公安备案链接。
- 正式取消、退款、平台收费和发票责任规则及版本号。
- 支付提供方、商户号、证书、回调密钥和结算账户。
- 售后证据保存期限、客服处理责任人和公开处理规则。
- 任何保险产品、承保机构和真实合同；缺失时不展示保险能力。
- 历史账号、预约、评价和工单的真实业务/QA 分类确认。
- 新增教练、项目、场馆的真实资料和人工审核结果。

## 页脚真实配置

只有提供真实值后才设置：`SITE_OPERATOR_NAME`、`SITE_SUPPORT_EMAIL`、`SITE_SUPPORT_PHONE`、`SITE_COMPLAINT_CONTACT`、`SITE_ICP_NUMBER`、`SITE_PUBLIC_SECURITY_NUMBER`、`SITE_PUBLIC_SECURITY_URL`。空值或格式错误会整项隐藏。
