import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("identity-bearing edits invalidate commercial participant verification", async () => {
  const source = await readFile(
    "supabase/migrations/202610150014_verification_invalidation.sql",
    "utf8",
  );

  assert.match(source, /new\.display_name is distinct from old\.display_name/);
  assert.match(source, /new\.profile_url is not distinct from old\.profile_url/);
  assert.match(source, /new\.name is distinct from old\.name/);
  assert.match(source, /new\.address is distinct from old\.address/);
  assert.match(source, /verified_at = null/);
});

test("campaign platform requirements are no longer directly mutable by Restaurant clients", async () => {
  const source = await readFile(
    "supabase/migrations/202610150015_campaign_platform_write_lock.sql",
    "utf8",
  );

  assert.match(source, /drop policy if exists "restaurant members manage campaign platforms"/);
  assert.match(
    source,
    /revoke insert, update, delete on public\.campaign_platforms from authenticated/,
  );
});
