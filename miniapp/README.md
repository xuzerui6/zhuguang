# 逐光微信小程序

这是逐光学员端与教练端共用的小程序工程，基于 Taro 4 和 React 18。学员默认进入任务型首页，已审核并绑定账号的教练可以从“我的”切换到教练工作台。

## 当前能力

- 学员：首页任务、真实供给分类、大图推荐教练轮播、收藏、指定时间预约、消息会话、课程评价和个人中心。
- 教练：工作台、预约确认/拒绝/反提案、接单状态与日程、消息会话和资料审核申请。
- 预约：学员指定北京时间、60/90/120 分钟、当前城市的审核场馆或自填地点，价格由服务端最终确认。
- 数据：读取逐光正式 API；刷新失败保留当前成功内容并提供重试，不以内置北京资料冒充另一城市供给。
- 城市：北京、长春；定位只由用户点击触发，坐标不上传或持久化。
- 我的：学员档案可查看、编辑和新增；教练入驻资料提交后须由运营审核，通过后开通教练身份与接单。

## 本地构建

```powershell
npm --prefix miniapp install
npm --prefix miniapp run typecheck
npm --prefix miniapp run build:weapp
```

使用微信开发者工具打开 `miniapp` 目录，工具会从 `dist` 读取编译结果。提交到 Git 的 `project.config.json` 保持 `touristappid`，本机通过已忽略的 `project.private.config.json` 使用正式 AppID，避免把各开发者的私有工具配置提交到仓库。

## 正式接入前配置

1. 注册微信小程序并把真实 AppID 写入未提交的 `project.private.config.json`。
2. 在微信公众平台将 `https://api.beijingzhuguang.top` 配置为 request、uploadFile 与 downloadFile 合法域名；离线资料图片仍可能从 `https://beijingzhuguang.top` 读取，因此也将主域名加入 downloadFile 合法域名。
3. 运行 `scripts/set-wechat-miniapp-secret.ps1`，在隐藏提示中输入刚刚重置的 AppSecret。脚本会把 AppID 和 AppSecret 写入 Cloudflare Worker Secret，并执行启用微信登录的正式构建；AppSecret 不能进入本目录或聊天记录。
4. 构建时注入 `TARO_APP_API_ORIGIN`、`TARO_APP_CHANNEL_KEY`，并在后端迁移和密钥就绪后设置 `TARO_APP_WECHAT_LOGIN_ENABLED=true`。
5. 教练图片同样由 `https://api.beijingzhuguang.top` 的受控公开媒体接口提供，私有 R2 bucket 不配置公共域名。
6. 使用开发者工具打开本目录，真机验收微信 code 交换、邮箱关联、角色恢复、收藏、预约、会话、下拉刷新和弱网恢复。

开发者工具需要在“设置 → 安全设置”开启服务端口。预览不等于体验版上传；体验版通过后仍需用户明确确认，才可提交微信审核或发布。

模糊定位默认关闭：本账号上传曾返回 `-80424 getFuzzyLocation is not authorized`。获得公众平台对应接口授权、补齐用户隐私保护指引后，使用 `scripts/invoke-miniapp-build.ps1 -EnableWechatLogin -EnableFuzzyLocation` 构建并再次真机验收。未授权时使用手动城市切换，不声明或调用该接口。

## 公众平台资料

- 名称：`逐光运动教练`
- 备选：`逐光北京运动教练`、`北京逐光运动教练`
- 简介：`为北京和长春学员提供已核验运动教练查询、咨询与预约服务。学员指定训练时间和地点，教练确认后生效。`
- 服务范围：北京、长春；没有真实供给的项目只显示入口与空状态。
- 头像：现有光轨 Z 品牌图标
- 服务类目：只选择个人主体后台实际提供、并与体育教练信息及预约工具相符的类目；不选择交易、医疗或保险类目。

运营端不会出现在小程序中。体验版验证完成前，不提交微信审核或正式发布。

微信 AppSecret、OpenID、UnionID 和 `session_key` 不得进入构建产物或 Git。服务端只持久化 OpenID/UnionID 的不可逆哈希，`session_key` 不落库。
