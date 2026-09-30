import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const project = readJson("project.config.json");
const privateProject = existsSync(path.join(root, "project.private.config.json"))
  ? readJson("project.private.config.json")
  : {};
const appId = String(privateProject.appid || project.appid || "");
const apiOrigin = process.env.TARO_APP_API_ORIGIN || "https://api.beijingzhuguang.top";
const loginEnabled = process.env.TARO_APP_WECHAT_LOGIN_ENABLED === "true";
const channelKey = process.env.TARO_APP_CHANNEL_KEY || "";
const failures = [];

if (loginEnabled && (!/^wx[a-z0-9]{16}$/iu.test(appId) || appId === "touristappid")) {
  failures.push("启用微信登录时必须在 project.private.config.json 配置真实 AppID");
}
if (loginEnabled && channelKey.length < 16) failures.push("启用微信登录时必须安全注入应用渠道标识");
if (!apiOrigin.startsWith("https://")) failures.push("正式 API 必须使用 HTTPS");
if (apiOrigin !== "https://api.beijingzhuguang.top") failures.push("小程序正式 API 必须限定为 api.beijingzhuguang.top");

const requiredPages = [
  "pages/index/index",
  "pages/coach-detail/index",
  "pages/booking/index",
  "pages/account-link/index",
  "pages/conversation/index",
  "pages/coach-request/index",
  "pages/profile-edit/index",
  "pages/learner-profile/index",
  "pages/coach-profile-edit/index",
  "pages/review/index",
  "pages/coach-application/index",
];
if (existsSync(path.join(root, "dist/app.json"))) {
  const app = readJson("dist/app.json");
  const fuzzyEnabled = process.env.TARO_APP_FUZZY_LOCATION_ENABLED === "true";
  if (Boolean(app.requiredPrivateInfos?.includes("getFuzzyLocation")) !== fuzzyEnabled) failures.push("模糊定位构建声明与能力开关不一致");
  for (const page of requiredPages) {
    if (!app.pages?.includes(page)) failures.push(`构建产物缺少页面：${page}`);
  }
}

const forbidden = ["WECHAT_MINIAPP_APP_SECRET", "session_key", "TENCENTCLOUD_SECRET_KEY"];
for (const directory of ["src", "dist"]) {
  if (!existsSync(path.join(root, directory))) continue;
  const files = [];
  const walk = (current) => {
    for (const entry of readFileEntries(current)) {
      if (entry.isDirectory()) walk(path.join(current, entry.name));
      else files.push(path.join(current, entry.name));
    }
  };
  walk(path.join(root, directory));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const marker of forbidden) {
      if (source.includes(marker)) failures.push(`${path.relative(root, file)} 包含禁止进入客户端的标识 ${marker}`);
    }
  }
}

if (existsSync(path.join(root, "dist"))) {
  const runtimeEnvMarker = "process.env.TARO_APP_";
  const walkDist = (current) => {
    for (const entry of readFileEntries(current)) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) walkDist(target);
      else if (/\.(?:js|wxml|json)$/iu.test(entry.name) && readFileSync(target, "utf8").includes(runtimeEnvMarker)) {
        failures.push(`${path.relative(root, target)} 仍包含未替换的 Node 环境变量，真机将无法启动`);
      }
    }
  };
  walkDist(path.join(root, "dist"));
}

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Miniapp readiness OK: appId=${appId === "touristappid" ? "tourist preview" : "configured"}, login=${loginEnabled ? "enabled" : "disabled"}, api=${apiOrigin}`);

function readFileEntries(directory) {
  return readdirSync(directory, { withFileTypes: true });
}
