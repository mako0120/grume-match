import { test } from "node:test";
import assert from "node:assert/strict";
import { configured, liveLeadResponse, normalizedLead } from "../netlify/functions/diary-ops-feed.mjs";

const env = {
  CONTEXT: "production",
  DIARY_OPS_AUTO_SYNC_ENABLED: "true",
  DIARY_OPS_OWNER_EMAIL: "operator@example.com",
  DIARY_NETLIFY_API_TOKEN: "opaque-Netlify-token-123456",
  DIARY_NETLIFY_SITE_ID: "d9a9-443f-aabb-ccdd",
  URL: "https://example-site.netlify.app",
};
const clientToken = "abcdef_".repeat(20);
const makeRequest = (bearer = clientToken, method = "GET") => new Request("https://example-site.netlify.app/.netlify/functions/diary-ops-feed", {
  method,
  headers: bearer ? { authorization: "Bearer " + bearer } : {},
});
function responder({ roles = ["admin"], email = "operator@example.com", badForms = false, broken = false, rejectIdentity = false } = {}) {
  const trace = [];
  async function fetcher(url, options) {
    trace.push({ url: String(url), options });
    if (broken) throw Error("Sensitive credentials: secret1234");
    if (String(url).endsWith("/.netlify/identity/user")) {
      return Response.json({ email, app_metadata: { roles } }, { status: rejectIdentity ? 401 : 200 });
    }
    if (String(url).includes("/sites/")) {
      return Response.json(badForms ? [] : [{ name: "diary-pr-inquiry", id: "abcdef12345678" }]);
    }
    if (String(url).includes("/forms/")) {
      return Response.json([{
        id: "123456789abcdef",
        created_at: "2026-10-21T10:00:00Z",
        data: { restaurant_name: "大阪食堂", email: "hello@example.com", message: "テストPRです" },
      }], { headers: { Link: "" } });
    }
    throw Error("Unexpected endpoint");
  }
  return { fetcher, trace };
}

test("auto sync is disabled until explicit production-only configuration", async () => {
  assert.equal(configured({ ...env, DIARY_OPS_AUTO_SYNC_ENABLED: "false" }), false);
  assert.equal(configured({ ...env, CONTEXT: "deploy-preview" }), false);
  const mock = responder();
  const response = await liveLeadResponse(makeRequest(), { ...env, CONTEXT: "deploy-preview" }, mock.fetcher);
  assert.equal(response.status, 503);
  assert.equal(mock.trace.length, 0);
});

test("blocks unauthenticated and non-GET access before Netlify API", async () => {
  const mock = responder();
  assert.equal((await liveLeadResponse(makeRequest(null), env, mock.fetcher)).status, 401);
  assert.equal((await liveLeadResponse(makeRequest(clientToken, "POST"), env, mock.fetcher)).status, 405);
  assert.equal(mock.trace.length, 0);
});

test("rejects a non-admin identity or a different Identity user", async () => {
  for (const params of [{ roles: ["editor"] }, { email: "attacker@example.com" }, { rejectIdentity: true }]) {
    const mock = responder(params);
    const result = await liveLeadResponse(makeRequest(), env, mock.fetcher);
    assert.equal(result.status, params.rejectIdentity ? 401 : 403);
    assert.equal(mock.trace.length, 1);
    assert.equal(mock.trace[0].url, "https://example-site.netlify.app/.netlify/identity/user");
  }
});

test("verified owner sees only the named form and a minimal lead subset", async () => {
  const mock = responder();
  const response = await liveLeadResponse(makeRequest(), env, mock.fetcher);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.leads.map(x => x.restaurant), ["大阪食堂"]);
  assert.equal(body.leads[0].email, "hello@example.com");
  assert.equal(JSON.stringify(body).includes(env.DIARY_NETLIFY_API_TOKEN), false);
  assert.equal(mock.trace.length, 3);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
});

test("missing form, upstream failure, and malformed submissions fail without credential leakage", async () => {
  const a = responder({ badForms: true });
  assert.equal((await liveLeadResponse(makeRequest(), env, a.fetcher)).status, 502);
  const b = responder({ broken: true });
  const fail = await liveLeadResponse(makeRequest(), env, b.fetcher);
  assert.equal(fail.status, 502);
  assert.equal(JSON.stringify(await fail.json()).includes("secret1234"), false);
  assert.equal(normalizedLead({ id: "bad", data: { email: "=IMPORTXML" } }), null);
  assert.deepEqual(normalizedLead({ id: "abcdef123456", data: { restaurant_name: "<script>test</script>" } }).restaurant, "<script>test</script>");
});

test("live and CSV variants must not embed customer API credentials in client bundles", async () => {
  const { readFileSync } = await import("node:fs");
  const frontend = readFileSync("app/diary/ops/components/diary-ops-console.tsx", "utf8");
  assert.doesNotMatch(frontend, /DIARY_NETLIFY_API_TOKEN|DIARY_NETLIFY_SITE_ID|process\.env\./);
  assert.doesNotMatch(frontend, /localStorage|sessionStorage|indexedDB/);
  assert.match(frontend, /setInterval\(\(\) => \{ void sync\(\); \}, 60000\)/);
  assert.match(frontend, /credentials: "omit"/);
  assert.match(frontend, /if \(!response\.ok\)/);
});
