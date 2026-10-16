import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Admin commercial integrity report checks payout and booking invariants", async () => {
  const source = await readFile(
    "supabase/migrations/202610160001_commercial_integrity_report.sql",
    "utf8",
  );

  assert.match(source, /paid_without_transfer_reference/);
  assert.match(source, /scheduled_or_paid_without_payout_profile/);
  assert.match(source, /open_dispute_with_moving_payout/);
  assert.match(source, /overbooked_slots/);
  assert.match(source, /direct_campaign_target_mismatch/);
  assert.match(source, /payable_booking_with_unapproved_deliverable/);
});

test("Admin readiness dashboard surfaces commercial integrity failures", async () => {
  const [query, page] = await Promise.all([
    readFile("server/queries/commercial-integrity.ts", "utf8"),
    readFile("app/admin/readiness/page.tsx", "utf8"),
  ]);

  assert.match(query, /commercial_integrity_report/);
  assert.match(page, /商用データ整合性/);
  assert.match(page, /item\.violations/);
});
