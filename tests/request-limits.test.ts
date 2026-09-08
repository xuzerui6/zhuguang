import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../server/api/contracts";
import { relayStream } from "../app/_lib/stream-relay";

test("platform proxy forwards streams and safe upload/response headers without buffering", async () => {
  const request = new Request("https://test.invalid", { method: "PUT", body: "binary", headers: { "x-file-name": "proof.pdf", "content-type": "application/pdf", "idempotency-key": "request-test-123" } });
  request.arrayBuffer = async () => { throw new Error("must not buffer"); };
  const response = new Response("binary response", { headers: { "content-disposition": "attachment; filename=proof.pdf", "content-type": "application/pdf" } });
  response.text = async () => { throw new Error("must not buffer"); };
  const result = await relayStream(request, "https://api.invalid", new Headers(), async (_url, init) => {
    assert.equal(init?.body, request.body);
    assert.equal(new Headers(init?.headers).get("x-file-name"), "proof.pdf");
    return response;
  });
  assert.equal(result.body, response.body);
  assert.match(result.headers.get("content-disposition")!, /proof.pdf/u);
  assert.equal(await result.text(), "binary response");
});

for (const length of [undefined, "4", "40000"]) test(`JSON actual byte limit rejects declared ${length}`, async () => {
  let cancelled = false;
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; if (pulls > 7) controller.close(); else controller.enqueue(new Uint8Array(8192).fill(32)); },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://test.invalid", { method: "POST", body: stream, headers: length ? { "content-length": length } : {}, duplex: "half" } as RequestInit);
  await assert.rejects(readJson(request), (error: unknown) => (error as { status?: number }).status === 413);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 6);
});

test("bounded JSON retains valid parsing and syntax errors", async () => {
  assert.deepEqual(await readJson(new Request("https://test.invalid", { method: "POST", body: '{"ok":true}' })), { ok: true });
  await assert.rejects(readJson(new Request("https://test.invalid", { method: "POST", body: "{" })), (error: unknown) => (error as { status?: number }).status === 400);
});
