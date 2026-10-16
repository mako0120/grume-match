import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Creator payout destination is private and auditable", async () => {
  const source = await readFile(
    "supabase/migrations/202610130017_creator_payout_profiles.sql",
    "utf8",
  );

  assert.match(source, /creator_payout_profiles/);
  assert.match(source, /public\.is_admin\(\)/);
  assert.match(source, /cp\.user_id = auth\.uid\(\)/);
  assert.match(source, /account_number_last4/);
});

test("payout cannot progress without a Creator payout destination", async () => {
  const source = await readFile(
    "supabase/migrations/202610130018_payout_profile_guard.sql",
    "utf8",
  );

  assert.match(source, /creator_payout_profile_required/);
  assert.match(source, /new\.status in \('scheduled', 'paid'\)/);
});

test("Creator and Admin UIs expose the manual payout workflow", async () => {
  const [creator, admin] = await Promise.all([
    readFile("app/creator/payout/page.tsx", "utf8"),
    readFile("app/admin/payments/page.tsx", "utf8"),
  ]);

  assert.match(creator, /店舗には表示されません/);
  assert.match(admin, /振込先/);
  assert.match(admin, /disabled=\{!payout\}/);
});
