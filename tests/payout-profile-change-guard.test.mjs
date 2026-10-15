import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("bank destination cannot change while payout is approved or scheduled", async () => {
  const source = await readFile(
    "supabase/migrations/202610150017_payout_profile_change_guard.sql",
    "utf8",
  );

  assert.match(source, /payout_profile_locked_by_active_payment/);
  assert.match(source, /p\.status in \('approved', 'on_hold', 'scheduled'\)/);
});

test("Creator sees why payout destination is temporarily locked", async () => {
  const source = await readFile("server/actions/payout-profile.ts", "utf8");
  assert.match(source, /支払い処理中の報酬があるため/);
});
