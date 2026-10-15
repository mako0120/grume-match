import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("manual payout cannot be marked paid without transfer evidence", async () => {
  const [migration, action, page] = await Promise.all([
    readFile("supabase/migrations/202610130020_payment_reconciliation.sql", "utf8"),
    readFile("server/actions/payments.ts", "utf8"),
    readFile("app/admin/payments/page.tsx", "utf8"),
  ]);

  assert.match(migration, /transfer_reference_required/);
  assert.match(migration, /payment\.transfer_recorded/);
  assert.match(action, /admin_record_payment_status/);
  assert.match(page, /振込参照番号/);
});
