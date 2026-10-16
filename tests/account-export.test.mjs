import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("account export is authenticated, scoped and non-cacheable", async () => {
  const source = await readFile("app/api/account/export/route.ts", "utf8");

  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /eq\("user_id", userId\)/);
  assert.match(source, /creator_id/);
  assert.match(source, /restaurant_id/);
  assert.match(source, /Content-Disposition/);
  assert.match(source, /private, no-store, max-age=0/);
});

test("account settings expose personal data export", async () => {
  const source = await readFile("app/account/page.tsx", "utf8");
  assert.match(source, /\/api\/account\/export/);
  assert.match(source, /自分のデータを書き出す/);
});
