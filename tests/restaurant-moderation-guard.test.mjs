import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Restaurant moderation checks bookings payouts and disputes before suspension", async () => {
  const source = await readFile(
    "supabase/migrations/202610150006_restaurant_moderation_transaction_guard.sql",
    "utf8",
  );

  assert.match(source, /restaurant_has_open_commercial_transactions/);
  assert.match(source, /booking_disputes/);
  assert.match(source, /p\.status not in \('paid', 'cancelled'\)/);
  assert.match(source, /participant_has_active_transactions/);
});
