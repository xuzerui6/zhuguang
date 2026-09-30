import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = process.env.ZHUGUANG_QA_PREVIEW_ORIGIN;
const output = process.env.ZHUGUANG_QA_OUTPUT;
const modules = process.env.CODEX_NODE_MODULES;
const productionRead = origin === 'https://beijingzhuguang.top' && process.env.ZHUGUANG_QA_ALLOW_PRODUCTION_READS === 'true';
if (!output || !modules || (!productionRead && !/^https:\/\/[a-z0-9-]+-zhuguang-web\.[a-z0-9-]+\.workers\.dev$/u.test(origin || ''))) {
  throw new Error('Explicit preview or authorized read-only production origin, output and Playwright runtime required');
}
const { chromium } = createRequire(join(modules, 'playwright/package.json'))('playwright');
await mkdir(output, { recursive: true });
const report = { origin, kind: 'anonymous read-only homepage city verification', checks: [], errors: [], consoleErrors: [], blockedWrites: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
function check(name, value) { report.checks.push({ name, pass: Boolean(value) }); assert.ok(value, name); }
try {
  for (const [width, height] of [[390, 844], [665, 694], [768, 1024], [1280, 800], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: width === 665 ? 'reduce' : 'no-preference' });
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      const diagnostic = url.origin === origin && url.pathname === '/cdn-cgi/rum' && request.method() === 'POST';
      if (['GET', 'HEAD'].includes(request.method()) || url.hostname === 'challenges.cloudflare.com' || diagnostic) return route.continue();
      report.blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') report.consoleErrors.push({ width, text: message.text(), location: message.location().url });
    });
    const response = await page.goto(`${origin}/?city=beijing`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    check(`${width} preview loads`, response.status() === 200);
    const city = page.getByRole('combobox', { name: '选择城市', exact: true });
    for (const [id, name, count] of [['beijing', '北京', 3], ['changchun', '长春', 1]]) {
      if (id === 'changchun') { await city.focus(); await city.selectOption(id); }
      const heading = page.getByRole('heading', { name: `${name}已核验教练`, exact: true });
      await heading.waitFor();
      await page.waitForTimeout(400);
      check(`${width} ${id} coach supply`, await page.locator('main article h3').count() === count);
      check(`${width} ${id} URL`, new URL(page.url()).searchParams.get('city') === id);
      check(`${width} ${id} single H1`, await page.locator('h1').count() === 1);
      check(`${width} ${id} no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      check(`${width} ${id} city touch target`, (await city.boundingBox()).height >= 44);
      const section = page.locator('main > section').filter({ has: heading });
      await section.scrollIntoViewIfNeeded();
      await section.locator('article img').first().waitFor();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('main article img')).filter(image => {
        const box = image.getBoundingClientRect();
        return box.left < innerWidth && box.right > 0 && box.top < innerHeight && box.bottom > 0;
      }).every(image => image.complete && image.naturalWidth > 0));
      // Exclude the fixed header overlay from the stitched section-only capture.
      await section.screenshot({ path: join(output, `cloud-${width}-${id}-coaches.png`), style: 'header { visibility: hidden !important; }' });
      check(`${width} ${id} card actions fit`, await section.locator('article a').filter({ hasText: '查看详情' }).evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth)));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(output, `cloud-${width}-${id}-hero.png`) });
      if (id === 'changchun') {
        check(`${width} focus retained`, await city.evaluate(element => element === document.activeElement));
        check(`${width} Changchun coach`, await section.getByRole('heading', { name: '徐泽瑞', exact: true }).count() === 1);
        check(`${width} negotiated venue`, (await page.locator('h1 + p').innerText()).includes('长春训练地点由学员与教练协商'));
        check(`${width} no swipe instruction`, await page.getByText('左右滑动查看教练', { exact: true }).count() === 0);
        check(`${width} Changchun regions`, await page.locator('.zg-service-lead-form [name=district] option').filter({ hasText: '南关区' }).count() === 1);
      }
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '长春已核验教练', exact: true }).waitFor();
    check(`${width} URL restore`, await city.inputValue() === 'changchun');
    await context.close();
  }
  check('no page exceptions', report.errors.length === 0);
  check('no first-party console errors', report.consoleErrors.filter(error => !error.location.startsWith('https://challenges.cloudflare.com/')).length === 0);
  check('no business writes attempted', report.blockedWrites.length === 0);
  console.log(JSON.stringify({ passed: report.checks.length, output, origin }));
} finally {
  await browser.close();
  await writeFile(join(output, 'home-city-preview.json'), JSON.stringify(report, null, 2));
}
