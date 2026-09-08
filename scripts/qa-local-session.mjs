import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

// This harness deliberately cannot target a production host or send a real SMS.
const origin = "http://127.0.0.1:8789";
const call = async (path, body, extra = {}) => {
  const response = await fetch(origin + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-device-id": "qa-isolated-workerd", ...extra }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const payload = await response.json();
  return { status: response.status, data: payload.data, error: payload.error?.code };
};
assert.equal((await call("/api/v1/health")).data.environment, "test");
const challenge = await call("/api/v1/auth/otp/request", { phone: "13800000993" });
assert.equal(challenge.status, 201);
const verified = await call("/api/v1/auth/otp/verify", { challengeId: challenge.data.challengeId, code: "888888" });
assert.equal(verified.status, 200);
const headers = { "x-operator-secret": "isolated-qa-proxy-only", "idempotency-key": "local-workerd-refresh-race" };
const results = await Promise.all(Array.from({ length: 6 }, () => call("/api/v1/auth/refresh", { refreshToken: verified.data.refreshToken }, headers)));
assert.ok(results.every((result) => result.status === 200));
assert.equal(new Set(results.map((result) => result.data.refreshToken)).size, 1);
assert.equal((await call("/api/v1/auth/logout-refresh", { refreshToken: verified.data.refreshToken })).status, 200);
assert.equal((await call("/api/v1/me", undefined, { authorization: `Bearer ${results[0].data.accessToken}` })).status, 401);
assert.equal((await call("/api/v1/auth/refresh", { refreshToken: verified.data.refreshToken }, headers)).status, 401);
const report = { runtime: "workerd", isolated: true, concurrentRequests: 6, uniqueSuccessor: true, logoutRevokesSuccessor: true, receiptCannotRestoreLogout: true };
writeFileSync("artifacts/qa/code24/workerd-session.json", JSON.stringify(report, null, 2));
console.log(report);
