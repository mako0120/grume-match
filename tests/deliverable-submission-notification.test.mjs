import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Restaurant is notified when a deliverable is submitted", async () => {
  const source = await readFile(
    "supabase/migrations/202610020013_deliverable_submission_notification.sql",
    "utf8",
  );

  assert.match(source, /deliverable_submitted/);
  assert.match(source, /after update of submitted_url, submitted_at/);
  assert.match(source, /投稿を確認してください/);
});
