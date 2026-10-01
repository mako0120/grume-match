import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("reschedule is blocked after the original visit starts", async () => {
  const [migration, query, action] = await Promise.all([
    readFile("supabase/migrations/202610020012_reschedule_start_guard.sql", "utf8"),
    readFile("server/queries/reschedules.ts", "utf8"),
    readFile("server/actions/reschedules.ts", "utf8"),
  ]);

  assert.match(migration, /booking_already_started/);
  assert.match(migration, /v_current_start <= now\(\)/);
  assert.match(query, /canReschedule/);
  assert.match(action, /来店開始後は日時変更できません/);
});
