import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Restaurant profile edits go through an authenticated membership RPC", async () => {
  const [migration, action, page] = await Promise.all([
    readFile("supabase/migrations/202610130019_restaurant_profile_settings.sql", "utf8"),
    readFile("server/actions/restaurant-profile.ts", "utf8"),
    readFile("app/restaurant/settings/page.tsx", "utf8"),
  ]);

  assert.match(migration, /rm\.role in \('owner', 'manager'\)/);
  assert.match(migration, /u\.status = 'active'/);
  assert.match(action, /save_restaurant_profile/);
  assert.match(page, /店舗情報を保存/);
});
