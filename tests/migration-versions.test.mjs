import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";

test("Supabase migration versions are unique", async () => {
  const files = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const seen = new Map();

  for (const file of files) {
    const match = file.match(/^(\d{12})_/);
    assert.ok(match, "Migration must start with a 12-digit version: " + file);

    const version = match[1];
    assert.equal(
      seen.has(version),
      false,
      "Duplicate Supabase migration version " +
        version +
        ": " +
        seen.get(version) +
        " and " +
        file,
    );
    seen.set(version, file);
  }
});
