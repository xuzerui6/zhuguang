# 逐光运动教练服务平台

逐光连接经过资料核验的专业运动教练与学员家庭。仓库同时包含公开官网、学员平台、教练工作台、运营后台、Cloudflare 手机 API，以及 Capacitor Android 和 Tauri 桌面客户端。

## 本地开发

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
npm run test:unit
npm run lint
npm run build
```

常驻预览服务应在后台终端运行；健康检查完成后不要等待服务进程退出。

## 正式域名

- 官网：`https://beijingzhuguang.top`
- 手机 API：`https://api.beijingzhuguang.top`
- Android 包名：`com.zhuguang.coachos`

官网允许匿名访问。`/student`、`/coach-workspace` 和 `/ops` 根据服务端会话与角色授权保护，客户端菜单不参与权限判定。

## 网站权限

网站 Worker 运行环境使用以下变量：

- `ZHUGUANG_MOBILE_API_URL`
- `ZHUGUANG_COACH_EMAILS`：逗号分隔的已审核教练邮箱
- `ZHUGUANG_OPS_EMAILS`：逗号分隔的运营邮箱
- `ZHUGUANG_OPERATOR_API_SECRET`：秘密
- `ZHUGUANG_PILOT_APP_KEY`：秘密
- `SITE_OPERATOR_NAME`：经营主体名称，可选
- `SITE_SUPPORT_EMAIL`、`SITE_SUPPORT_PHONE`：客服联系方式，可选
- `SITE_COMPLAINT_CONTACT`：投诉渠道，可选
- `SITE_ICP_NUMBER`、`SITE_PUBLIC_SECURITY_NUMBER`：备案信息，可选

可选的经营与备案字段为空时，页脚会隐藏整项；不得使用占位资料发布。

匿名用户没有工作区权限；登录账号默认只有学员权限；教练与运营权限只从服务端配置授予。

## 手机 API

Worker 配置位于 `wrangler.mobile-api.jsonc`，使用 D1 `DB`、私有教练媒体 `MEDIA` 和私有安装包 `RELEASES`。短信和 JPush 参数未配置时，界面必须保持明确的不可用或模拟状态。

## Android 发布

签名文件与密码必须保存在仓库外。正式构建脚本从 Windows DPAPI 保护的用户配置读取凭据：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\invoke-android-release.ps1 -VersionName 1.2.4 -VersionCode 9
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-android-release.ps1 -VersionName 1.2.5 -VersionCode 10 -PauseVersionCode 8
```

构建输出包含签名 APK、SHA-256、包名、版本和证书指纹。应用内更新仍需要 Android 的未知来源授权与系统安装确认。

## 关键检查

- `npm run brand:icons`：从“光轨 Z”母版生成多端图标
- `npm run native:check`：校验原生资源、adaptive icon 和通知图标
- `npm run mobile:web:build`：构建 Capacitor Web 资源
- `scripts/run-browser-qa.mjs`：使用 Playwright 检查关键路由与视口

教练资料、评价、课量、时段和平台规模不得使用未核验数据冒充真实运营数据。
