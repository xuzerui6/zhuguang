import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.ZHUGUANG_QA_URL ?? "http://127.0.0.1:3001";
const acceptsTrustedTestHeaders = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/u.test(baseUrl);
const runtimeModules = process.env.CODEX_NODE_MODULES;
if (!runtimeModules) throw new Error("CODEX_NODE_MODULES is required for browser QA");

const require = createRequire(join(runtimeModules, "playwright", "package.json"));
const { chromium } = require("playwright");
await mkdir("artifacts/qa", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { checks: [], consoleErrors: [], ignoredAutomationDiagnostics: [] };

function collectErrors(page, prefix = "") {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const messageText = message.text();
    if (messageText === "%c%d font-size:0;color:transparent NaN") {
      report.ignoredAutomationDiagnostics.push(`${prefix}${messageText}`);
      return;
    }
    report.consoleErrors.push(`${prefix}${messageText}`);
  });
  page.on("pageerror", (error) => report.consoleErrors.push(`${prefix}${error.message}`));
}

async function gotoReady(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
}

async function revealPageByScrolling(page) {
  await page.evaluate(async () => {
    const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    const pageHeight = document.documentElement.scrollHeight;
    for (let y = 0; y < pageHeight; y += Math.max(320, Math.floor(window.innerHeight * 0.7))) {
      window.scrollTo({ top: y, behavior: "instant" });
      await delay(60);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(250);
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  collectErrors(page);
  await gotoReady(page, `${baseUrl}/`);
  report.checks.push({ name: "home title", value: await page.title() });
  report.checks.push({ name: "home overflow", value: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  report.checks.push({ name: "home heading", value: await page.locator("h1").first().innerText() });
  await revealPageByScrolling(page);
  report.checks.push({ name: "home service process visible", value: await page.getByText("每一步有状态，", { exact: false }).isVisible() });
  await page.screenshot({ path: "artifacts/qa/home-1440.png", fullPage: true });

  await gotoReady(page, `${baseUrl}/coaches?sport=%E7%94%B0%E5%BE%84&district=%E9%80%9A%E5%B7%9E%E5%8C%BA`);
  report.checks.push({ name: "directory result", value: await page.getByText("徐泽瑞", { exact: true }).count() > 0 });
  report.checks.push({ name: "directory url", value: page.url() });
  report.checks.push({ name: "directory overflow", value: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  await page.screenshot({ path: "artifacts/qa/coaches-1440.png", fullPage: true });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageMobile = await mobile.newPage();
  collectErrors(pageMobile, "mobile: ");
  await gotoReady(pageMobile, `${baseUrl}/coaches?sport=%E7%94%B0%E5%BE%84&district=%E9%80%9A%E5%B7%9E%E5%8C%BA`);
  report.checks.push({ name: "mobile overflow", value: await pageMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  report.checks.push({ name: "mobile inspector hidden", value: await pageMobile.locator("aside[aria-label*='教练摘要']").isHidden() });
  await pageMobile.locator("a[aria-label='打开徐泽瑞教练详情']").click();
  await pageMobile.waitForURL("**/coaches/5");
  report.checks.push({ name: "mobile detail route", value: pageMobile.url() });
  report.checks.push({ name: "mobile detail overflow", value: await pageMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  await pageMobile.screenshot({ path: "artifacts/qa/coach-5-mobile.png", fullPage: true });
  await gotoReady(pageMobile, `${baseUrl}/ops`);
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
  if (!acceptsTrustedTestHeaders) {
    const firstPartyOrigin = new URL(baseUrl).origin;
    const trustedHeaderNames = new Set(Object.keys(authenticatedHeaders));
    await workspacePage.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin === firstPartyOrigin) {
        await route.continue();
        return;
      }
      const headers = route.request().headers();
      for (const name of trustedHeaderNames) delete headers[name];
      await route.continue({ headers });
    });
  }
  collectErrors(workspacePage, "workspace: ");
  for (const route of ["/student", "/coach-workspace/bookings", "/coach-workspace/schedule", "/ops", "/ops/coaches"]) {
    await gotoReady(workspacePage, `${baseUrl}${route}`);
    const loginRequired = await workspacePage.getByText("需要登录", { exact: true }).count() === 1;
    report.checks.push({
      name: acceptsTrustedTestHeaders ? `${route} authorized locally` : `${route} rejects spoofed identity headers`,
      value: acceptsTrustedTestHeaders ? !loginRequired : loginRequired,
    });
    report.checks.push({ name: `${route} overflow`, value: await workspacePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) });
  }
  await gotoReady(workspacePage, `${baseUrl}/coach-workspace/schedule`);
  await workspacePage.screenshot({ path: "artifacts/qa/coach-workspace-1280.png", fullPage: true });
  await gotoReady(workspacePage, `${baseUrl}/ops/coaches`);
  await workspacePage.screenshot({ path: "artifacts/qa/ops-coaches-1280.png", fullPage: true });
  await workspace.close();

  const targetViewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ];
  const publicRoutes = ["/", "/coaches", "/coaches/5", "/login", "/download", "/service-guarantee"];
  const protectedRoutes = ["/student", "/coach-workspace/schedule", "/ops/coaches", "/ops/releases"];

  for (const viewport of targetViewports) {
    const responsive = await browser.newContext({
      extraHTTPHeaders: acceptsTrustedTestHeaders ? authenticatedHeaders : {},
      viewport,
    });
    const responsivePage = await responsive.newPage();
    collectErrors(responsivePage, `${viewport.width}x${viewport.height}: `);

    for (const route of [...publicRoutes, ...protectedRoutes]) {
      await gotoReady(responsivePage, `${baseUrl}${route}`);
      const routeLabel = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
      report.checks.push({
        name: `${routeLabel} ${viewport.width}x${viewport.height} overflow`,
        value: await responsivePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      });
      report.checks.push({
        name: `${routeLabel} ${viewport.width}x${viewport.height} unique h1`,
        value: (await responsivePage.locator("h1").count()) === 1,
      });
      if (protectedRoutes.includes(route)) {
        const loginRequired = await responsivePage.getByText("需要登录", { exact: true }).count() === 1;
        report.checks.push({
          name: `${routeLabel} ${viewport.width}x${viewport.height} authorized locally`,
          value: acceptsTrustedTestHeaders ? !loginRequired : loginRequired,
        });
      }
    }

    await gotoReady(responsivePage, `${baseUrl}/`);
    await revealPageByScrolling(responsivePage);
    await responsivePage.screenshot({ path: `artifacts/qa/home-${viewport.width}x${viewport.height}.png`, fullPage: true });

    if (viewport.width === 390) {
      const menuButton = responsivePage.locator("button[aria-expanded]").first();
      if (await menuButton.count()) {
        await menuButton.click();
        report.checks.push({ name: "mobile menu opens", value: await menuButton.getAttribute("aria-expanded") === "true" });
        await responsivePage.keyboard.press("Escape");
        report.checks.push({ name: "mobile menu closes with Escape", value: await menuButton.getAttribute("aria-expanded") === "false" });
      } else {
        report.checks.push({ name: "mobile menu control exists", value: false });
      }
    }
    await responsive.close();
  }
} finally {
  await browser.close();
}

await writeFile("artifacts/qa/browser-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.consoleErrors.length || report.checks.some((check) => check.value === false)) process.exitCode = 1;
