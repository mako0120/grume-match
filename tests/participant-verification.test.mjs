import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("paid PR transactions require verified Creator and Restaurant participants", async () => {
  const source = await readFile(
    "supabase/migrations/202610150004_participant_verification_gate.sql",
    "utf8",
  );

  assert.match(source, /restaurant_not_verified/);
  assert.match(source, /creator_not_verified/);
  assert.match(source, /campaigns_require_verified_restaurant/);
  assert.match(source, /applications_require_verified_participants/);
  assert.match(source, /bookings_require_verified_participants/);
});

test("Admin has a one-tap participant verification queue", async () => {
  const [page, action, query] = await Promise.all([
    readFile("app/admin/verification/page.tsx", "utf8"),
    readFile("server/actions/verification.ts", "utf8"),
    readFile("server/queries/admin-verification.ts", "utf8"),
  ]);

  assert.match(page, /Creatorを確認済みにする/);
  assert.match(page, /店舗を確認済みにする/);
  assert.match(action, /admin_verify_participant/);
  assert.match(query, /\.is\("verified_at", null\)/);
});

test("participant-facing actions explain verification blocks", async () => {
  const [campaigns, applications, bookings] = await Promise.all([
    readFile("server/actions/campaigns.ts", "utf8"),
    readFile("server/actions/applications.ts", "utf8"),
    readFile("server/actions/bookings.ts", "utf8"),
  ]);

  assert.match(campaigns, /restaurant_not_verified/);
  assert.match(applications, /creator_not_verified/);
  assert.match(bookings, /Creatorの利用確認/);
});
