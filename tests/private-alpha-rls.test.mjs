import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("private alpha blocks anonymous campaign and restaurant visibility", async () => {
  const source = await readFile(
    "supabase/migrations/202610020011_private_alpha_rls.sql",
    "utf8",
  );

  assert.match(source, /is_active_creator/);
  assert.match(source, /restaurants authenticated scoped readable/);
  assert.match(source, /public\.is_active_creator\(\)/);
});

test("suspended counterparties are hidden from marketplace views", async () => {
  const source = await readFile(
    "supabase/migrations/202610020014_participant_visibility.sql",
    "utf8",
  );

  assert.match(source, /creator_user\.status = 'active'/);
  assert.match(source, /r\.status = 'active'/);
});

test("restaurants can read payment state only through their own bookings", async () => {
  const source = await readFile(
    "supabase/migrations/202610020015_restaurant_payment_read.sql",
    "utf8",
  );

  assert.match(source, /b\.id = booking_id/);
  assert.match(source, /public\.is_restaurant_member\(c\.restaurant_id\)/);
});

test("Creator withdrawal returns explicit feedback", async () => {
  const [action, page] = await Promise.all([
    readFile("server/actions/applications.ts", "utf8"),
    readFile("app/creator/applications/page.tsx", "utf8"),
  ]);

  assert.match(action, /応募を取り消しました/);
  assert.match(action, /application_cannot_be_withdrawn/);
  assert.match(page, /aria-live="polite"/);
});
