import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.env.ZHUGUANG_QA_OUTPUT;
const modules = process.env.CODEX_NODE_MODULES;
const origin = process.env.ZHUGUANG_QA_PREVIEW_ORIGIN;
const productionRead = origin === 'https://beijingzhuguang.top' && process.env.ZHUGUANG_QA_ALLOW_PRODUCTION_READS === 'true';
if (!output || !modules || !origin || (!productionRead && !/^https:\/\/[a-z0-9-]+-zhuguang-web\.[a-z0-9-]+\.workers\.dev$/u.test(origin))) {
  throw new Error('An explicit preview or authorized read-only production origin, output directory and Playwright runtime are required');
}
const { chromium } = createRequire(path.join(modules, 'playwright/package.json'))('playwright');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { origin, kind: 'anonymous read-only preview audit', checks: [], failures: [] };
try {
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 800], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      const diagnostic = url.origin === origin && url.pathname === '/cdn-cgi/rum' && request.method() === 'POST';
      return ['GET', 'HEAD'].includes(request.method()) || url.hostname === 'challenges.cloudflare.com' || diagnostic ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    let errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/coaches', '/coaches/5', '/login', '/download', '/privacy']) {
      errors = [];
      try {
        const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForTimeout(1500);
        const result = await page.evaluate(() => ({
          h1Count: document.querySelectorAll('h1').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          visibleImages: Array.from(document.images).filter(image => {
            const box = image.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
          }).map(image => ({ loaded: image.complete && image.naturalWidth > 0 })),
        }));
        const check = { width, height, route, status: response?.status(), ...result, pageErrors: [...errors] };
        report.checks.push(check);
        if (check.status !== 200 || result.h1Count !== 1 || result.overflow || errors.length) report.failures.push(check);
        const name = route === '/' ? 'home' : route.replaceAll('/', '-').slice(1);
        await page.screenshot({ path: path.join(output, `preview-${width}-${name}.png`) });
        console.log(JSON.stringify(check));
      } catch (error) {
        const failure = { width, route, error: error.message };
        report.failures.push(failure);
        console.log(JSON.stringify(failure));
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'public-preview-report.json'), JSON.stringify(report, null, 2));
}
if (report.failures.length) process.exitCode = 1;
