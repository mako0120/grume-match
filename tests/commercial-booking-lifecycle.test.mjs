import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("commercial visit lifecycle supports attendance, cancellation and no-show", async () => {
  const source = await readFile(
    "supabase/migrations/202610130002_booking_lifecycle.sql",
    "utf8",
  );

  assert.match(source, /mark_booking_visited/);
  assert.match(source, /cancel_booking/);
  assert.match(source, /mark_booking_no_show/);
  assert.match(source, /no_show_too_early/);
  assert.match(source, /booking_not_started/);
  assert.match(source, /payments_finalize_campaign/);
});

test("cancelled payment state is excluded from Creator earned totals", async () => {
  const [migration, wallet] = await Promise.all([
    readFile(
      "supabase/migrations/202610130001_payment_cancelled_status.sql",
      "utf8",
    ),
    readFile("server/queries/wallet.ts", "utf8"),
  ]);

  assert.match(migration, /'cancelled'/);
  assert.match(wallet, /payment\.status === "cancelled"/);
});

test("Restaurant lifecycle actions are exposed on booking detail", async () => {
  const source = await readFile(
    "app/restaurant/bookings/[id]/page.tsx",
    "utf8",
  );

  assert.match(source, /来店済みにする/);
  assert.match(source, /キャンセルを確定/);
  assert.match(source, /来店なしを確定/);
});

test("recent started visits remain in the Restaurant action window", async () => {
  const [bookings, dashboard] = await Promise.all([
    readFile("server/queries/restaurant-bookings.ts", "utf8"),
    readFile("server/queries/restaurant-dashboard.ts", "utf8"),
  ]);

  assert.match(bookings, /6 \* 60 \* 60 \* 1000/);
  assert.match(dashboard, /kind: "visit"/);
  assert.match(dashboard, /来店を確認/);
});
