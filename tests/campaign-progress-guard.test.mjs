import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("early visits do not silently close an open multi-Creator campaign", async () => {
  const source = await readFile(
    "supabase/migrations/202610130006_campaign_progress_guard.sql",
    "utf8",
  );

  assert.match(source, /new\.status = 'in_progress'/);
  assert.match(source, /old\.status in \('published', 'recruiting', 'closed'\)/);
  assert.match(source, /new\.status := old\.status/);
});
