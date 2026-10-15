import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("opening a dispute places unsettled payout on hold", async () => {
  const [statusMigration, resolutionMigration] = await Promise.all([
    readFile("supabase/migrations/202610130012_payment_on_hold_status.sql", "utf8"),
    readFile("supabase/migrations/202610130013_dispute_resolution.sql", "utf8"),
  ]);

  assert.match(statusMigration, /'on_hold'/);
  assert.match(resolutionMigration, /status = 'on_hold'/);
  assert.match(resolutionMigration, /payment_status_before/);
});

test("Admin payout progression is blocked while dispute is open", async () => {
  const source = await readFile(
    "supabase/migrations/202610130014_payment_dispute_guard.sql",
    "utf8",
  );

  assert.match(source, /payment_blocked_by_open_dispute/);
  assert.match(source, /booking_disputes/);
  assert.match(source, /bd\.status = 'open'/);
});

test("Creator and Restaurant can escalate booking to Admin review", async () => {
  const [creator, restaurant, actions] = await Promise.all([
    readFile("app/creator/bookings/[id]/page.tsx", "utf8"),
    readFile("app/restaurant/bookings/[id]/page.tsx", "utf8"),
    readFile("server/actions/disputes.ts", "utf8"),
  ]);

  assert.match(creator, /運営に確認を依頼する/);
  assert.match(restaurant, /運営に確認を依頼する/);
  assert.match(actions, /open_booking_dispute/);
  assert.match(actions, /resolve_booking_dispute/);
});

test("Admin has a dedicated dispute queue", async () => {
  const [page, query] = await Promise.all([
    readFile("app/admin/disputes/page.tsx", "utf8"),
    readFile("server/queries/admin-disputes.ts", "utf8"),
  ]);

  assert.match(page, /通常フローへ戻す/);
  assert.match(page, /未払い報酬を停止/);
  assert.match(query, /booking_disputes/);
});
