import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("approved deliverables cannot be resubmitted or reversed after payout approval", async () => {
  const source = await readFile(
    "supabase/migrations/202610020007_deliverable_payout_lock.sql",
    "utf8",
  );

  assert.match(source, /deliverable_already_approved/);
  assert.match(source, /deliverable_review_locked_after_payout_approval/);
  assert.match(source, /v_payment_status in \('approved', 'scheduled', 'paid'\)/);
});

test("primary booking UI hides mutable controls for approved deliverables", async () => {
  const [creator, restaurant] = await Promise.all([
    readFile("app/creator/bookings/[id]/page.tsx", "utf8"),
    readFile("app/restaurant/bookings/[id]/page.tsx", "utf8"),
  ]);

  assert.match(creator, /disabled=\{deliverable\.verification_status === "approved"\}/);
  assert.match(creator, /承認済みの投稿URLです/);
  assert.match(restaurant, /deliverable\.verification_status !== "approved"/);
  assert.match(restaurant, /承認済みです/);
});
