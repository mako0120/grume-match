import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Netlify deploy uses Next.js OpenNext automatic adapter and deploys with Node22", () => {
  const config = read("netlify.toml");
  assert.match(config, /command = "npm run build"/);
  assert.match(config, /publish = "\.next"/);
  assert.match(config, /NODE_VERSION = "22"/);
  assert.doesNotMatch(config, /@netlify\/plugin-nextjs|\/\*\s+\/index\.html/);
});

test("Netlify scheduled function reconciles diary invoices through authenticated cron", () => {
  const config = read("netlify.toml");
  const func = read("netlify/functions/diary-reconcile.mjs");
  assert.match(config, /\[functions\."diary-reconcile"\]/);
  assert.match(config, /schedule = "5 \* \* \* \*"/);
  assert.match(func, /Authorization: "Bearer " \+ secret/);
  assert.match(func, /"\/api\/cron\/email"/);
  assert.match(func, /process\.env\.URL/);
});

test("Production root points to diary landing page without launching the marketplace", () => {
  const next = read("next.config.ts");
  assert.match(next, /process\.env\.DIARY_SITE_MODE === "true"/);
  assert.match(next, /destination: "\/diary"/);
  const layout = read("app/diary/layout.tsx");
  assert.match(layout, /DIARY_PUBLIC_INDEX_ENABLED/);
});

test("Live invoicing and new inquiries are opt-in separately from public website hosting", () => {
  const env = read(".env.example");
  assert.match(env, /DIARY_INQUIRIES_ENABLED=false/);
  assert.match(env, /DIARY_STRIPE_ENABLED=false/);
  assert.match(env, /DIARY_PUBLIC_INDEX_ENABLED=false/);
});
