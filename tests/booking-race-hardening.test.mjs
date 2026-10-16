import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("booking hardening serializes schedule changes per Creator", async () => {
  const source = await readFile(
    "supabase/migrations/202610020002_booking_race_hardening.sql",
    "utf8",
  );

  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /campaign_capacity_reached/);
  assert.match(source, /v_booking_count >= v_campaign\.creator_slots/);
  assert.match(source, /review_booking_reschedule/);
});

test("booking action maps campaign-level capacity conflicts", async () => {
  const source = await readFile("server/actions/bookings.ts", "utf8");

  assert.match(source, /campaign_capacity_reached/);
  assert.match(source, /採用枠はすべて確定しました/);
});
