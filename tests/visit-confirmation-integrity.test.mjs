import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Creator submission cannot self-confirm attendance", async () => {
  const [bookingGuard, applicationGuard] = await Promise.all([
    readFile("supabase/migrations/202610130007_visit_actor_guard.sql", "utf8"),
    readFile("supabase/migrations/202610130008_application_visit_actor_guard.sql", "utf8"),
  ]);

  assert.match(bookingGuard, /v_creator_user_id = auth\.uid\(\)/);
  assert.match(bookingGuard, /new\.status := old\.status/);
  assert.match(applicationGuard, /new\.status := old\.status/);
});

test("Restaurant content approval can confirm a visit after the scheduled start", async () => {
  const source = await readFile(
    "supabase/migrations/202610130009_visit_on_deliverable_approval.sql",
    "utf8",
  );

  assert.match(source, /verification_status <> 'approved'/);
  assert.match(source, /v_slot\.starts_at > now\(\)/);
  assert.match(source, /status = 'visited'/);
});
