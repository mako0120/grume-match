import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("campaign terms cannot be changed after Creators apply", async () => {
  const source = await readFile(
    "supabase/migrations/202610020005_campaign_terms_lock.sql",
    "utf8",
  );

  assert.match(source, /cash_reward is distinct from old\.cash_reward/);
  assert.match(source, /campaign_deliverables_locked_after_application/);
  assert.match(source, /campaign_slots_locked_after_application/);
  assert.match(source, /direct_target_locked_after_application/);
});
