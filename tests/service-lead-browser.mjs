import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const output = process.env.ZHUGUANG_QA_OUTPUT;
const modules = process.env.CODEX_NODE_MODULES;
assert.ok(output && modules, 'external evidence and bundled Playwright required');
await mkdir(output, { recursive: true });
const { chromium } = createRequire(join(modules, 'playwright/package.json'))('playwright');
const fixture = createServer((req, res) => {
  res.writeHead(req.method === 'GET' ? 200 : 403, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ data: [] }));
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:3321';
const child = spawn(process.execPath, ['scripts/local-preview-server.mjs'], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: '3321', HOST: '127.0.0.1',
    ZHUGUANG_MOBILE_API_URL: `http://127.0.0.1:${fixture.address().port}`,
    ZHUGUANG_PILOT_APP_KEY: 'isolated-channel', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'isolated-widget' },
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk; });
child.stderr.on('data', chunk => { logs += chunk; });
let browser;
const report = { environment: 'loopback isolated CAPTCHA callback fixture', checks: [], writes: [], pageErrors: [] };
try {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* bounded readiness */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs.slice(-2000));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === 'challenges.cloudflare.com') return route.fulfill({
      contentType: 'application/javascript',
      body: 'window.turnstile={render:(host,options)=>{window.qaWidget=options;return "fixture-widget"},remove:()=>{},reset:()=>{}};',
    });
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      report.writes.push(url.pathname); return route.abort();
    }
    return url.origin === origin ? route.continue() : route.abort();
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.qaWidget));
  const form = page.locator('.zg-service-lead-form');
  const button = form.getByRole('button', { name: '提交训练需求' });
  await page.evaluate(() => window.qaWidget.callback('isolated-not-a-real-token'));
  await button.waitFor();
  assert.equal(await button.isEnabled(), true);
  report.checks.push('successful verification enables submit');
  await page.evaluate(() => window.qaWidget['error-callback']());
  await form.getByRole('alert').filter({ hasText: '安全验证' }).waitFor();
  assert.equal(await button.isDisabled(), true);
  report.checks.push('verification error is an alert and clears stale token');
  await page.evaluate(() => window.qaWidget.callback('isolated-recovered-token'));
  assert.equal(await button.isEnabled(), true);
  assert.equal(await form.getByRole('alert').count(), 0);
  report.checks.push('successful retry clears verification error');
  await page.evaluate(() => window.qaWidget['expired-callback']());
  await form.getByRole('alert').filter({ hasText: '过期' }).waitFor();
  assert.equal(await button.isDisabled(), true);
  report.checks.push('expired verification disables submit');
  await page.screenshot({ path: join(output, 'service-lead-expired.png'), fullPage: true });
  assert.deepEqual(report.writes, []);
  assert.deepEqual(report.pageErrors, []);
  console.log(JSON.stringify({ passed: report.checks.length, failures: 0, output }));
} finally {
  await writeFile(join(output, 'service-lead-browser.json'), JSON.stringify(report, null, 2));
  await browser?.close(); child.kill(); await new Promise(resolve => fixture.close(resolve));
}
