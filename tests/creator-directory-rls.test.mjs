import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("original public Creator directory policies are removed", async () => {
  const source = await readFile(
    "supabase/migrations/202610150012_creator_directory_rls.sql",
    "utf8",
  );

  assert.match(source, /drop policy if exists "creator profiles public readable"/);
  assert.match(source, /drop policy if exists "creator social accounts readable"/);
  assert.match(source, /creator profiles scoped readable/);
  assert.match(source, /creator social scoped readable/);
});

test("Restaurant directory access requires both sides to be verified", async () => {
  const source = await readFile(
    "supabase/migrations/202610150012_creator_directory_rls.sql",
    "utf8",
  );

  assert.match(source, /cp\.verified_at is not null/);
  assert.match(source, /r\.verified_at is not null/);
  assert.match(source, /get_active_standby_creators/);
});
