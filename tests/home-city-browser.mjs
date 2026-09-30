import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { demoCoaches } from '../app/mobile/demo-data.ts';

const output = process.env.ZHUGUANG_QA_OUTPUT;
const modules = process.env.CODEX_NODE_MODULES;
assert.ok(output && modules, 'external output and bundled Playwright are required');
await mkdir(output, { recursive: true });
const { chromium } = createRequire(join(modules, 'playwright/package.json'))('playwright');
const coaches = demoCoaches.filter(coach => coach.profileKind === 'real');
const changchun = coaches.filter(coach => coach.id === 5);
const catalog = city => ({ city: city === 'changchun' ? '长春' : '北京', sports: city === 'changchun' ? [{ id: 'athletics', name: '田径' }] : [{ id: 'athletics', name: '田径' }, { id: 'qa-filter-only', name: '篮球' }], regions: [] });
let failCity = false;
let slowCity = false;
let emptyCity = false;
const report = { browser: 'Browser plugin not available; regular Playwright', environment: 'loopback isolated read-only fixtures', checks: [], pageErrors: [], writes: [] };
const fixture = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') { report.writes.push(url.pathname); res.writeHead(403); res.end(); return; }
  const city = url.searchParams.get('city');
  if (slowCity && city === 'changchun') await new Promise(resolve => setTimeout(resolve, 400));
  if (failCity && city === 'changchun') { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'isolated network failure' } })); return; }
  let data = [];
  if (url.pathname === '/api/v1/coaches') data = city === 'changchun' ? emptyCity ? [] : changchun : coaches;
  if (url.pathname === '/api/v1/catalog') data = catalog(city);
  if (url.pathname.includes('/public/app/releases/latest')) data = null;
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data }));
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const port = 3317;
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['scripts/local-preview-server.mjs'], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ZHUGUANG_MOBILE_API_URL: `http://127.0.0.1:${fixture.address().port}`, ZHUGUANG_PILOT_APP_KEY: 'isolated-channel', PRODUCT_FILM_ENABLED: 'false' },
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
let browser;
function check(name, value) { report.checks.push({ name, pass: Boolean(value) }); assert.ok(value, name); }
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded readiness */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs.slice(-2000));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 665, height: 694 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    // Never send form contents or other business writes outside the local fixture.
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(`${origin}/?coach=${coaches.find(coach => coach.id !== 5).id}`, { waitUntil: 'networkidle' });
    const city = page.getByRole('combobox', { name: '选择城市', exact: true });
    const inquiry = page.locator('.zg-service-lead-form');
    await inquiry.locator('[name=contactName]').fill('隔离草稿');
    await inquiry.locator('[name=contactPhone]').fill('13800000000');
    await inquiry.locator('[name=goal]').fill('仅在本地测试保留，不提交');
    await page.locator('form[action="/coaches"] select[name=goal]').selectOption('短跑专项');
    await page.getByRole('combobox', { name: '选择运动项目', exact: true }).selectOption('篮球');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `${viewport.width}-beijing.png`), fullPage: true });
    await city.focus(); await city.selectOption('changchun');
    await page.getByRole('heading', { name: '长春已核验教练', exact: true }).waitFor();
    check(`${viewport.width} city URL`, new URL(page.url()).searchParams.get('city') === 'changchun');
    check(`${viewport.width} unsupported coach cleared`, !new URL(page.url()).searchParams.has('coach'));
    check(`${viewport.width} fixed brand heading`, await page.locator('h1').count() === 1 && (await page.locator('h1').innerText()).includes('专业体育教练'));
    check(`${viewport.width} one actual Changchun coach`, await page.locator('main article h3').count() === 1);
    check(`${viewport.width} draft kept`, await inquiry.locator('[name=contactPhone]').inputValue() === '13800000000' && await inquiry.locator('[name=goal]').inputValue() === '仅在本地测试保留，不提交');
    check(`${viewport.width} goal kept`, await page.locator('form[action="/coaches"] select[name=goal]').inputValue() === '短跑专项');
    check(`${viewport.width} unsupported sport reset`, await page.getByRole('combobox', { name: '选择运动项目', exact: true }).inputValue() === '');
    check(`${viewport.width} city regions updated`, await inquiry.locator('[name=district] option').filter({ hasText: '南关区' }).count() === 1 && await inquiry.locator('[name=district] option').filter({ hasText: '通州区' }).count() === 0);
    check(`${viewport.width} focus kept`, await city.evaluate(element => element === document.activeElement));
    check(`${viewport.width} no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(`${viewport.width} no false venue claim`, !(await page.locator('main').innerText()).includes('长春合作场馆'));
    check(`${viewport.width} single coach hides swipe prompt`, await page.getByText('左右滑动查看教练', { exact: true }).count() === 0);
    check(`${viewport.width} local links`, (await page.getByRole('link', { name: '查看详情', exact: true }).getAttribute('href')).includes('city=changchun'));
    const nameBox = await page.locator('main article h3').boundingBox();
    check(`${viewport.width} coach name is not squeezed`, nameBox.width > 100 && nameBox.height < 65);
    check(`${viewport.width} coach action text stays together`, await page.getByRole('link', { name: '查看详情', exact: true }).evaluate(element => getComputedStyle(element).whiteSpace === 'nowrap' && element.scrollWidth <= element.clientWidth));
    const heading = page.getByRole('heading', { name: '长春已核验教练', exact: true });
    if (viewport.width <= 820) check(`${viewport.width} title not squeezed`, (await heading.boundingBox()).width > viewport.width * .7);
    check(`${viewport.width} 44px city control`, (await city.boundingBox()).height >= 44);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `${viewport.width}-changchun.png`), fullPage: true });
    await page.goBack(); await page.getByRole('heading', { name: '北京已核验教练', exact: true }).waitFor();
    await page.goForward(); await heading.waitFor();
    await page.reload({ waitUntil: 'networkidle' }); await heading.waitFor();
    check(`${viewport.width} direct refresh restores city`, await city.inputValue() === 'changchun');
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 665, height: 694 } });
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  const city = page.getByRole('combobox', { name: '选择城市', exact: true });
  failCity = true; await city.selectOption('changchun');
  await page.getByRole('button', { name: '重试切换' }).waitFor();
  check('failure keeps Beijing content and selector', await city.inputValue() === 'beijing' && await page.getByRole('heading', { name: '北京已核验教练' }).count() === 1);
  failCity = false; await page.getByRole('button', { name: '重试切换' }).click(); await page.getByRole('heading', { name: '长春已核验教练' }).waitFor();
  await city.selectOption('beijing'); await page.getByRole('heading', { name: '北京已核验教练' }).waitFor();
  slowCity = true; await city.selectOption('changchun'); await city.selectOption('beijing'); await page.waitForTimeout(600);
  check('rapid switch ignores late city', await city.inputValue() === 'beijing' && await page.getByRole('heading', { name: '北京已核验教练' }).count() === 1);
  slowCity = false; emptyCity = true; await city.selectOption('changchun'); await page.getByText('长春暂无已上线教练', { exact: true }).waitFor();
  check('empty supply hides price and cards', !(await page.locator('h1 + p').innerText()).includes('¥') && await page.locator('main article h3').count() === 0);
  check('no page exceptions', report.pageErrors.length === 0);
  check('no business writes', report.writes.length === 0);
  console.log(JSON.stringify({ passed: report.checks.length, failures: 0, output }));
} finally {
  await writeFile(join(output, 'home-city-browser.json'), JSON.stringify(report, null, 2));
  await browser?.close(); child.kill(); await new Promise(resolve => fixture.close(resolve));
}
