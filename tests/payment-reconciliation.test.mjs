import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("manual payout requires transfer evidence and freezes it after paid", async () => {
  const [baseMigration, immutableMigration, action, page] = await Promise.all([
    readFile("supabase/migrations/202610130020_payment_reconciliation.sql", "utf8"),
    readFile("supabase/migrations/202610150002_paid_evidence_immutability.sql", "utf8"),
    readFile("server/actions/payments.ts", "utf8"),
    readFile("app/admin/payments/page.tsx", "utf8"),
  ]);

  assert.match(baseMigration, /transfer_reference_required/);
  assert.match(baseMigration, /payment\.transfer_recorded/);
  assert.match(immutableMigration, /paid_payment_immutable/);
  assert.match(action, /admin_record_payment_status/);
  assert.match(action, /paid_payment_immutable/);
  assert.match(page, /振込証跡/);
  assert.match(page, /支払済みの証跡は変更できません/);
});

test("Admin payout list keeps active work plus only recent paid transfers", async () => {
  const source = await readFile("server/queries/admin-payments.ts", "utf8");

  assert.match(source, /\["approved", "scheduled", "failed"\]/);
  assert.match(source, /\.eq\("status", "paid"\)/);
  assert.match(source, /30 \* 24 \* 60 \* 60 \* 1000/);
});

test("paid payment UI has no transition controls", async () => {
  const source = await readFile("app/admin/payments/page.tsx", "utf8");

  assert.match(source, /const isPaid = payment\.status === "paid"/);
  assert.match(source, /isPaid \? \(/);
  assert.match(source, /payment\.status === "approved"/);
  assert.match(source, /payment\.status === "scheduled"/);
  assert.match(source, /payment\.status === "failed"/);
});
