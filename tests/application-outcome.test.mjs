import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("campaign closure rejects pending applicants and notifies them", async () => {
  const source = await readFile(
    "supabase/migrations/202610020006_application_outcome.sql",
    "utf8",
  );

  assert.match(source, /status in \('filled', 'cancelled', 'suspended'\)/);
  assert.match(source, /status = 'rejected'/);
  assert.match(source, /application_rejected/);
});
