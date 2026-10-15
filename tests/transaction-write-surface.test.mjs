import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("core commercial transaction tables are writeable only through audited RPCs", async () => {
  const source = await readFile(
    "supabase/migrations/202610150013_transaction_write_surface_lock.sql",
    "utf8",
  );

  for (const policy of [
    "creator creates own applications",
    "creator manages own availability",
    "restaurant members manage campaigns",
    "restaurant members manage slots",
    "restaurant manages campaign targets",
  ]) {
    assert.match(source, new RegExp("drop policy if exists \"" + policy + "\""));
  }

  assert.match(source, /revoke insert, update, delete on public\.applications from authenticated/);
  assert.match(source, /revoke insert, update, delete on public\.campaigns from authenticated/);
  assert.match(source, /revoke insert, update, delete on public\.campaign_slots from authenticated/);
});

test("required commercial mutations are still exposed as security-definer RPCs", async () => {
  const [scheduling, creation, direct, close] = await Promise.all([
    readFile("supabase/migrations/202609290002_atomic_scheduling.sql", "utf8"),
    readFile("supabase/migrations/202609300002_campaign_creation.sql", "utf8"),
    readFile("supabase/migrations/202609300011_direct_offers.sql", "utf8"),
    readFile("supabase/migrations/202610020016_manual_campaign_close.sql", "utf8"),
  ]);

  assert.match(scheduling, /function public\.apply_to_campaign/);
  assert.match(scheduling, /security definer/);
  assert.match(creation, /function public\.create_campaign_with_slots/);
  assert.match(creation, /security definer/);
  assert.match(direct, /function public\.create_direct_offer_with_slots/);
  assert.match(close, /function public\.close_campaign_recruitment/);
});
