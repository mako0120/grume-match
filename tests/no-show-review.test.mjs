import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("reviewed no-shows leave the Admin inbox", async () => {
  const [migration, inbox] = await Promise.all([
    readFile("supabase/migrations/202610130015_no_show_review.sql", "utf8"),
    readFile("server/queries/admin-inbox.ts", "utf8"),
  ]);

  assert.match(migration, /no_show_reviewed_at/);
  assert.match(migration, /review_booking_no_show/);
  assert.match(inbox, /\.is\("no_show_reviewed_at", null\)/);
  assert.match(inbox, /"\/admin\/no-shows"/);
});

test("Admin has a dedicated no-show review queue", async () => {
  const [page, query] = await Promise.all([
    readFile("app/admin/no-shows/page.tsx", "utf8"),
    readFile("server/queries/admin-no-shows.ts", "utf8"),
  ]);

  assert.match(page, /確認済みにする/);
  assert.match(query, /\.eq\("status", "no_show"\)/);
});
