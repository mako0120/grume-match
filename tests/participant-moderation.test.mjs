import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("participant verification requires complete commercial profiles", async () => {
  const source = await readFile(
    "supabase/migrations/202610150005_participant_moderation.sql",
    "utf8",
  );

  assert.match(source, /creator_social_required/);
  assert.match(source, /creator_profile_incomplete/);
  assert.match(source, /restaurant_profile_incomplete/);
});

test("Admin can suspend unsafe participants only after active transactions clear", async () => {
  const [migration, actions, page] = await Promise.all([
    readFile("supabase/migrations/202610150005_participant_moderation.sql", "utf8"),
    readFile("server/actions/verification.ts", "utf8"),
    readFile("app/admin/verification/page.tsx", "utf8"),
  ]);

  assert.match(migration, /participant_has_active_transactions/);
  assert.match(migration, /participant\.suspended/);
  assert.match(actions, /admin_suspend_participant/);
  assert.match(page, /利用不可にする/);
  assert.match(page, /利用停止を確定/);
});
