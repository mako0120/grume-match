import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signSheetRequest, validatePatch, stateConfigured, stateResponse,
} from "../netlify/functions/diary-ops-state.mjs";

const secret = "test-secret-not-production-1234567890123456";
const ownerToken = "owner-token_".repeat(10);
const env = {
  CONTEXT: "production",
  DIARY_OPS_AUTO_SYNC_ENABLED: "true",
  DIARY_OPS_STATE_ENABLED: "true",
  DIARY_OPS_OWNER_EMAIL: "owner@example.test",
  DIARY_SHEETS_HMAC_SECRET: secret,
  DIARY_SHEETS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycb987654321012345678901234567890/exec",
  URL: "https://diary-preview.netlify.app",
};
const request = (method = "GET", auth = ownerToken, body) =>
  new Request("https://diary-preview.netlify.app/.netlify/functions/diary-ops-state", {
    method, headers: {
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
function fetcher({ roles = ["admin"], email = "owner@example.test",
  content = { ok: true, items: [{ id: "abcd1234efgh", version: "a".repeat(64), status: "未対応" }] },
  redirectTo = "" } = {}) {
  const calls = [];
  const run = async (uri, init) => {
    calls.push({ url: String(uri), method: init.method, init });
    if (String(uri).endsWith("/.netlify/identity/user")) {
      return Response.json({ email, app_metadata: { roles } });
    }
    if (redirectTo) return new Response(null, { status: 302, headers: { Location: redirectTo } });
    return Response.json(content);
  };
  return { run, calls };
}

test("production flag and configuration fail closed", async () => {
  assert.equal(stateConfigured({ ...env, CONTEXT: "deploy-preview" }), false);
  assert.equal(stateConfigured({ ...env, DIARY_OPS_STATE_ENABLED: "false" }), false);
  assert.equal(stateConfigured({ ...env, DIARY_SHEETS_WEBAPP_URL: "https://evil.example/path" }), false);
  const mocked = fetcher();
  assert.equal((await stateResponse(request(), { ...env, DIARY_OPS_STATE_ENABLED: "false" }, mocked.run)).status, 503);
  assert.equal(mocked.calls.length, 0);
});

test("no token, non-admin, and wrong email never reach Apps Script", async () => {
  const absent = fetcher();
  assert.equal((await stateResponse(request("GET", ""), env, absent.run)).status, 401);
  assert.equal(absent.calls.length, 0);
  for (const cfg of [{ roles: ["viewer"] }, { email: "not-owner@example.test" }]) {
    const mocked = fetcher(cfg);
    assert.equal((await stateResponse(request(), env, mocked.run)).status, 403);
    assert.equal(mocked.calls.length, 1);
  }
});

test("signed read returns private operations without exposing secrets", async () => {
  const mock = fetcher();
  const result = await stateResponse(request(), env, mock.run);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).items[0].id, "abcd1234efgh");
  assert.equal(mock.calls.length, 2);
  const envelope = JSON.parse(mock.calls[1].init.body);
  assert.equal(envelope.action, "list");
  const canonical = envelope.action + "\n" + envelope.timestamp + "\n" +
    envelope.nonce + "\n" + JSON.stringify(envelope.payload);
  assert.equal(envelope.signature,
    createHmac("sha256", secret).update(canonical, "utf8").digest("hex"));
  assert.equal(JSON.stringify(await stateResponse(request(), env, fetcher().run)).includes(secret), false);
  assert.equal(result.headers.get("cache-control"), "private, no-store, max-age=0");
});

test("valid owner updates only allowlisted fields and surfaces conflicts", async () => {
  assert.deepEqual(validatePatch({ status: "制作中", agreedFee: 8000 }), { status: "制作中", agreedFee: 8000 });
  assert.equal(validatePatch({ status: "admin" }), null);
  assert.equal(validatePatch({ extra: "unexpected" }), null);
  assert.equal(validatePatch({ postUrl: "javascript:alert(1)" }), null);
  assert.equal(validatePatch({ paidAmount: -1 }), null);
  const payload = { id: "abcdef123456", expectedVersion: "a".repeat(64), patch: { status: "返信済" } };
  const success = fetcher({ content: { ok: true, item: { ...payload, version: "b".repeat(64) } } });
  assert.equal((await stateResponse(request("POST", ownerToken, payload), env, success.run)).status, 200);
  assert.equal(JSON.parse(success.calls[1].init.body).action, "update");
  const conflict = fetcher({ content: { ok: false, error: "conflict" } });
  assert.equal((await stateResponse(request("POST", ownerToken, payload), env, conflict.run)).status, 409);
  const invalid = fetcher();
  assert.equal((await stateResponse(request("POST", ownerToken, { ...payload, patch: { role: "admin" } }), env, invalid.run)).status, 400);
  assert.equal(invalid.calls.length, 1);
});

test("redirect is restricted to official Apps Script response host", async () => {
  const mock = fetcher({ redirectTo: "https://evil.example/steal" });
  const result = await stateResponse(request(), env, mock.run);
  assert.equal(result.status, 502);
  assert.equal(mock.calls.length, 2);
});

test("signing nonce changes per request, never includes raw secret", () => {
  const a = signSheetRequest("list", {}, secret);
  const b = signSheetRequest("list", {}, secret);
  assert.notEqual(a.nonce, b.nonce);
  assert.doesNotMatch(JSON.stringify(a), /test-secret-not-production/);
});
