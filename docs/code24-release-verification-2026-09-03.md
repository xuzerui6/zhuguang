# Code 24 全栈修复验收与发布记录

## 范围与约束

本轮依据 `docs/zhuguang-full-stack-audit-2026-09-02.md` 顶部 2026-09-03 范围，以及用户后续明确的生产迁移、部署、覆盖安装和更新发布授权实施。

- 北京经营、唯一运营邮箱规则保持不变。
- 经营主体、备案、商户、客服公开信息不属于本轮修复阻塞；现有空值隐藏不变。
- R2 不公开；在线交易、公开指标和售后证据上传不开启。
- 不在生产创建模拟课程、评价或支付记录，不卸载 App，不清除设备数据。

## 已实施修复

1. Web 会话：统一设备 Cookie；SSR、直接导航、平台接口均可续期；原子刷新令牌轮换；可信 Web 同一请求短时加密回执；退出撤销整个设备会话族。
2. 预约展示：共享终态、完成异议、支付和评价展示模型；移除固定处理时效及错误教练/场馆兜底；终态不展示待确认操作。
3. 完成确认：稳定幂等键；最终决定、事件、课程状态、通知或异议工单在同一事务落库；重复决定返回首次结果，相反决定返回 409。
4. 真实来源：五类实体存在性校验和统一分类；公开评价视图同时检查评价、预约、账号和教练资格，QA/未分类不进入正文或评分。
5. Android：API 24 主题和签名检查分支；无签名凭据 Debug/Release Lint；正式打包仍强制仓库外签名；跨端经历、标题与资质分离。
6. 额外回归：拒绝伪造教练身份请求头；CORS 放行新版 `x-booking-flow`；新旧预约按记录自身流程版本履约，不因全局开关改变历史流程。
7. 测试发布：指定已登记 Android 安装的短期 canary，仅指定版本有效，不影响公开下载和其他设备的稳定灰度。
8. 线上检查追加回归：运营匿名/伪造认证返回 401，可信代理的非运营邮箱返回 403；运营公开教练计数排除演示、未审核和非北京资料。两项均先复现失败再修复。

## 迁移与数据保护

正式迁移前账本至 0014。以下增量迁移不删除或改写旧字段：

| 迁移 | 内容 |
| --- | --- |
| 0015 | 北京项目/区域、多对多供给和内部跟进时间 |
| 0016 | 预约契约快照、完成确认、私有证据结构 |
| 0017 | 默认关闭的测试交易、退款、对账结构 |
| 0018 | 可空来源分类及分类事件 |
| 0019 | 刷新令牌原子占用与加密幂等回执 |
| 0020 | 完成决定幂等记录及不可变保护 |
| 0021 | 五类实体统一分类 |
| 0022 | 公开评价来源视图、分类事件不可变保护 |

备份：`C:/Users/16013/.zhuguang/backups/2026-09-03/pre-code24-evening.sql`，不进入 Git。

备份 SHA-256：`4c583b0ef1205a80f5955673ff1136e3c1fb49139ebdad10830386f0feab128d`。

恢复测试在内存数据库中完成；45 张旧表全部旧列数据指纹不变，integrity=ok，外键错误为 0。证据：`artifacts/qa/code24/d1-restore-validation.json`。

## 发布前版本

- API：`2d81294d-81db-4959-b60b-63eaeff4c2a5`
- Web：`287f8e6b-1dc1-4007-95c6-8e672454d23a`
- 网页候选预览：`8b27f6f1-6444-41d1-8078-7179a6829b0c`
- 真机原版本：`1.3.7 / code 22`
- 新 APK：`outputs/releases/zhuguang-android-private-1.3.9.apk`
- 新 APK SHA-256：`3a6e507b7cbddb2c190fa9c02b34c9380ed0c3d2afa2f713f74e8447dc936d79`
- 证书：`B3:3C:C9:74:31:DB:88:BF:07:02:AE:D7:92:74:D8:F2:BD:5E:D8:81:4D:B8:BB:74:7B:4C:19:63:EA:04:34:7B`

## 验收记录

- 单元/API：69 通过，1 项真实时钟长测单独执行并通过，共 70 项通过。
- 服务端渲染：15/15 通过。
- TypeScript、ESLint、生产构建、native:check、正式签名验证通过。
- Android Debug/Release Lint：0 错误、22 条非阻断警告；未启用 baseline 隐藏错误。
- APK 合并权限无位置、电话、存储、QUERY_ALL_PACKAGES。
- 本地 workerd 六个并发可信刷新只有一个后继会话；退出后后继和回执均不能恢复登录。
- 云端预览在 390x844、768x1024、1280x800、1440x900 检查公开详情及学员/教练/运营匿名保护，无横向溢出。
- 首页四尺寸、移动菜单打开/关闭/焦点恢复已检查。

## 最终结果

- 31 分钟真实时钟测试通过：第 16、31 分钟各轮换一次，会话均有效；未修改系统时间。证据：`artifacts/qa/code24/session-soak.json`。
- 正式 D1 已按顺序应用 0015–0022；迁移后外键错误为 0。旧预约、费用和历史事件未改写。日志：`artifacts/qa/code24/production-migrations.log`。
- 正式 API 最终版本：`de034968-2bdc-4613-97ac-898dff5a66d5`。它是在 `c8331deb-cf11-4ceb-a320-733ada6692c4` 修复代码上删除临时 canary 配置形成的版本。
- 正式网站版本：`8b27f6f1-6444-41d1-8078-7179a6829b0c`，即已验收的预览版本，100% 流量。
- `BEIJING_CATALOG_V2_ENABLED=true`；仅发布真实通州田径供给。三位真实教练关联已核对，运营公开教练数为 3。
- `FULFILLMENT_V2_ENABLED=false`、`ONLINE_TRANSACTION_ENABLED=false`、`PUBLIC_TRUST_METRICS_ENABLED=false`、`SUPPORT_EVIDENCE_ENABLED=false`，`PAYMENT_PROVIDER=none`。旧客户端继续使用旧履约流程。
- code 24 先发布 10%，对本机登记安装设置两小时精确 canary；App 发现更新、下载校验、vivo 安装确认成功后扩至 100%，非强制，最低 code 5。code 22 保持可回退分发；canary secret 已删除。
- vivo V1955A 最终为 `com.zhuguang.coachos 1.3.9 / code 24`。首次安装时间仍为 2026-08-09；本次升级时间 2026-09-03 21:11，没有卸载或清数据。
- 从真机重新提取安装包，SHA-256 与上述构建清单完全一致。昵称、1 位收藏教练、14 条预约、12 节完成课程和教练权限均保留。
- 真机完成/取消/失效分组及完成课程时间线正确；完成课程保留评价和联系入口，没有待确认按钮。真实业务写入未在生产模拟。
- 断开 Wi-Fi、冷启动后显示离线页面；恢复网络后预约和未读数恢复，原移动数据关闭状态保持不变。有限 logcat 未发现 AndroidRuntime/WebView 错误。
- 官网下载页显示 1.3.9/code 24；公开五分钟票据实际下载 6,289,846 字节，SHA 与本地及真机一致，MIME 为 APK，文件名为 `zhuguang-android-1.3.9.apk`。
- `www` 301 保留路径与查询；媒体 200/ETag 304；CORS 返回正式 Origin 并支持 `x-booking-flow`；两个 R2 bucket 无公开域名，r2.dev 关闭。
- 真实已登录账号进入学员、徐泽瑞教练、运营及版本中心成功；四视口预约/教练/运营无横向溢出或权限误报。20 个菜单页面只读巡检通过。
- 本轮未重新发送 SES 验证码或远程 JPush 消息；已有会话、消息读取及刷新验证不等同于重新完成邮件或推送到达测试。

## 修改与证据索引

完整工作树文件清单：`artifacts/qa/code24/changed-files.json`，包含本轮修改和中断前保留的改动；未自动提交或推送。

- 会话：`app/_lib/web-auth-refresh.ts`、`web-session.ts`、`web-security.ts`、`proxy.ts`、邮箱刷新/退出路由及平台代理。
- 预约：`shared/booking-presentation.ts`、`shared/completion-idempotency.ts`、网页学员/教练页面、Android 预约视图、双身份壳及 API 客户端。
- 服务端：`server/api/repository.ts`、`operations.ts`、`expansion.ts`、`releases.ts`、`router.ts`、`contracts.ts`。
- 迁移：`drizzle/0015_*.sql` 至 `0022_*.sql`；禁止删除式逆迁移。
- Android：Gradle、Manifest、API 分支、values/values-v27 主题及 `native/mobile/www` 构建资源。
- 工程检查：`scripts/native-lint.mjs`、`verify-d1-upgrade.mjs`、`qa-local-session.mjs`、`configure-release-canary.ps1`、CI 与 package scripts。
- 保留的公开页完善：页脚、移动导航、咨询/隐私请求、目录卡片、运营页面及对应样式。
- 回归测试：`tests/api-integration.test.ts`、`mobile-domain.test.ts`、`web-platform.test.ts`、`rendered-html.test.mjs`。
- 截图和运行证据：`artifacts/qa/code24/owner-bookings-*.png`、`owner-ops-*.png`、`owner-coach-workspace-*.png`、`device-after-code24.png`、`device-ended-code24.png`、`device-offline-code24.png`。
- 菜单/视口结果：`production-route-audit.json`、`owner-bookings.json`、`owner-workspaces.json`、`cloud-browser-pages.json`，均位于 `artifacts/qa/code24`。

## 回滚

1. 新功能异常先将对应开关设为 false。履约 V2 保持关闭；若以后启用，历史流程版本由预约记录决定。
2. Web/API 可回退上述已记录 Worker 版本；保留全部增量表和数据，不执行 DROP 或破坏性逆迁移。
3. 数据异常暂停后续写入，先验证备份并设计补偿迁移；不直接以旧备份覆盖上线后的有效业务。
4. APK 异常暂停 code 24，保留 code 22 稳定分发；已升级设备不强制降级，修复后使用更高版本号。
5. `RELEASE_CANARY_JSON` 在验收后删除；自动有效期最长 24 小时，暂停版本始终不会被其恢复。

## 技术残余风险

- 预览子域名未加入正式 Turnstile 域名清单，因此预览不能作为 SES 实际登录验收证据；正式站需单独验证。
- 本地 workerd 随现有 Wrangler 支持 2026-05-22，正式配置为 2026-08-01；边缘实际行为以云端验收为准。
- 未运行 Android API 24 模拟器；兼容性来自 Lint、API 分支和 Android 13 vivo 真机，不等于全部 OEM 测试。
- Lint 警告包含构建工具版本、备份规则、图标资源和未使用资源，后续升级工具链单独处理。
- 真实历史数据未自动归类；公开评分可能暂为空，这是有意避免将 QA 数据展示为真实业务。
- vivo 浅色背景上的系统状态栏图标对比度仍可优化；本轮未将 OEM 外观问题冒充为全设备兼容验收。
- 更新已由系统安装、安装包 SHA 和安装登记 code 24 三重验证，但本次未见 code 24 的 `app_update_events` 事件入库；更新事件遥测完整性仍需后续检查，不影响本次安装成功证据。
- 离线冷启动验证了页面可用和联网恢复，不保证全部预约正文都被长期持久缓存；新履约 V2 写流程仍以隔离 API 并发测试为证据，生产保持关闭。
