import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Creator campaign queries reject expired detail and filter FLASH expiry", async () => {
  const source = await readFile("server/queries/campaigns.ts", "utf8");

  assert.match(source, /flash_expires_at/);
  assert.match(source, /\.gt\("application_deadline", new Date\(\)\.toISOString\(\)\)/);
  assert.match(source, /new Date\(row\.flash_expires_at\)\.getTime\(\) > now/);
});

test("Admin payouts use audited reconciliation RPC rather than direct payment updates", async () => {
  const [action, migration] = await Promise.all([
    readFile("server/actions/payments.ts", "utf8"),
    readFile("supabase/migrations/202610130020_payment_reconciliation.sql", "utf8"),
  ]);

  assert.match(action, /admin_record_payment_status/);
  assert.match(migration, /admin_update_payment_status/);
  assert.match(migration, /payment\.transfer_recorded/);
  assert.doesNotMatch(action, /\.from\("payments"\)\.update/);
});

test("Security migration scopes Creator metrics and one Direct OFFER target", async () => {
  const source = await readFile(
    "supabase/migrations/202610020001_security_payment_hardening.sql",
    "utf8",
  );

  assert.match(source, /creator profiles scoped readable/);
  assert.match(source, /creator social accounts scoped readable/);
  assert.match(source, /campaign_target_one_creator_idx/);
  assert.match(source, /payment\.status_changed/);
});

test("Creator profile form has no account-specific seed values", async () => {
  const source = await readFile("app/creator/profile/page.tsx", "utf8");

  assert.doesNotMatch(source, /gurunavi_diary/);
  assert.doesNotMatch(source, /\?\? 4000/);
});
