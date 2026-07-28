import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the coach platform shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>逐光教练平台<\/title>/);
  assert.match(html, /网页介绍/);
  assert.match(html, /学员端/);
  assert.match(html, /教练端/);
  assert.match(html, /运营端/);
  assert.match(html, /让优秀退役运动员/);
  assert.match(html, /智能匹配/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("keeps the upgraded UI animation and responsive surfaces wired", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /type View = "intro" \| "student" \| "coach" \| "ops"/);
  assert.match(page, /floating-console/);
  assert.match(page, /filter-summary/);
  assert.match(page, /名片预览/);
  assert.match(page, /progress-bar/);
  assert.match(layout, /metadataBase: new URL/);
  assert.match(layout, /退役运动员教练服务平台/);
  assert.match(css, /@keyframes viewIn/);
  assert.match(css, /@keyframes cardIn/);
  assert.match(css, /@keyframes scanMove/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
