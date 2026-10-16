import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("onboarding does not seed a specific Creator identity", async () => {
  const source = await readFile("app/onboarding/page.tsx", "utf8");

  assert.doesNotMatch(source, /defaultValue="グルメ日誌"/);
  assert.doesNotMatch(source, /大阪を中心にグルメ情報を発信しています/);
  assert.doesNotMatch(source, /defaultValue="6000"/);
});

test("restaurant membership requires active restaurant role", async () => {
  const source = await readFile(
    "supabase/migrations/202610020003_role_membership_hardening.sql",
    "utf8",
  );

  assert.match(source, /u\.role = 'restaurant'/);
  assert.match(source, /role_locked_after_onboarding/);
});
