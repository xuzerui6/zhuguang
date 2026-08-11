import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.ZHUGUANG_QA_URL ?? "http://127.0.0.1:3001";
const runtimeModules = process.env.CODEX_NODE_MODULES;
if (!runtimeModules) throw new Error("CODEX_NODE_MODULES is required for browser QA");

const require = createRequire(join(runtimeModules, "playwright", "package.json"));
const { chromium } = require("playwright");
await mkdir("artifacts/qa", { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { checks: [], consoleErrors: [] };

function collectErrors(page, prefix = "") {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${prefix}${message.text()}`);
  });
  page.on("pageerror", (error) => report.consoleErrors.push(`${prefix}${error.message}`));
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  collectErrors(page);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  report.checks.push({ name: "home title", value: await page.title() });
  report.checks.push({ name: "home overflow", value: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  report.checks.push({ name: "home heading", value: await page.locator("h1").first().innerText() });
  await page.screenshot({ path: "artifacts/qa/home-1440.png", fullPage: true });

  await page.goto(`${baseUrl}/coaches?sport=%E7%94%B0%E5%BE%84&district=%E9%80%9A%E5%B7%9E%E5%8C%BA`, { waitUntil: "networkidle" });
  report.checks.push({ name: "directory result", value: await page.getByText("徐泽瑞", { exact: true }).count() > 0 });
  report.checks.push({ name: "directory url", value: page.url() });
  report.checks.push({ name: "directory overflow", value: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  await page.screenshot({ path: "artifacts/qa/coaches-1440.png", fullPage: true });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageMobile = await mobile.newPage();
  collectErrors(pageMobile, "mobile: ");
  await pageMobile.goto(`${baseUrl}/coaches?sport=%E7%94%B0%E5%BE%84&district=%E9%80%9A%E5%B7%9E%E5%8C%BA`, { waitUntil: "networkidle" });
  report.checks.push({ name: "mobile overflow", value: await pageMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  report.checks.push({ name: "mobile inspector hidden", value: await pageMobile.locator("aside[aria-label*='教练摘要']").isHidden() });
  await pageMobile.locator("a[aria-label='打开徐泽瑞教练详情']").click();
  await pageMobile.waitForURL("**/coaches/5");
  report.checks.push({ name: "mobile detail route", value: pageMobile.url() });
  report.checks.push({ name: "mobile detail overflow", value: await pageMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  await pageMobile.screenshot({ path: "artifacts/qa/coach-5-mobile.png", fullPage: true });
  await pageMobile.goto(`${baseUrl}/ops`, { waitUntil: "networkidle" });
  report.checks.push({ name: "anonymous ops protected", value: await pageMobile.getByText("需要登录", { exact: true }).count() === 1 });
  await mobile.close();

  const authenticatedHeaders = {
    "oai-authenticated-user-email": "xuzerui6@gmail.com",
    "oai-authenticated-user-full-name": encodeURIComponent("徐泽瑞"),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    "oai-authenticated-user-id": "qa-owner-account",
  };
  const workspace = await browser.newContext({
    extraHTTPHeaders: authenticatedHeaders,
    viewport: { width: 1280, height: 800 },
  });
  const workspacePage = await workspace.newPage();
  collectErrors(workspacePage, "workspace: ");
  for (const route of ["/student", "/coach-workspace/bookings", "/coach-workspace/schedule", "/ops", "/ops/coaches"]) {
    await workspacePage.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    report.checks.push({ name: `${route} authorized`, value: await workspacePage.getByText("需要登录", { exact: true }).count() === 0 });
    report.checks.push({ name: `${route} overflow`, value: await workspacePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  }
  await workspacePage.goto(`${baseUrl}/coach-workspace/schedule`, { waitUntil: "networkidle" });
  await workspacePage.screenshot({ path: "artifacts/qa/coach-workspace-1280.png", fullPage: true });
  await workspacePage.goto(`${baseUrl}/ops/coaches`, { waitUntil: "networkidle" });
  await workspacePage.screenshot({ path: "artifacts/qa/ops-coaches-1280.png", fullPage: true });
  await workspace.close();

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    const responsive = await browser.newContext({ viewport });
    const responsivePage = await responsive.newPage();
    collectErrors(responsivePage, `${viewport.width}x${viewport.height}: `);
    await responsivePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    report.checks.push({
      name: `home ${viewport.width}x${viewport.height} overflow`,
      value: await responsivePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    });
    if (viewport.width === 360) await responsivePage.screenshot({ path: "artifacts/qa/home-360.png", fullPage: true });
    await responsive.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
if (report.consoleErrors.length || report.checks.some((check) => check.value === false)) process.exitCode = 1;
