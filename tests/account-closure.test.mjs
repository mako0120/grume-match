import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("account closure is reviewed instead of deleting transactional records inline", async () => {
  const [migration, account, admin] = await Promise.all([
    readFile("supabase/migrations/202610150001_account_closure_requests.sql", "utf8"),
    readFile("app/account/page.tsx", "utf8"),
    readFile("app/admin/accounts/page.tsx", "utf8"),
  ]);

  assert.match(migration, /account_closure_requests/);
  assert.match(migration, /status = 'suspended'/);
  assert.match(migration, /admin_closure_requires_manual_review/);
  assert.doesNotMatch(migration, /delete from public\.users/);
  assert.match(account, /アカウント停止・削除について相談/);
  assert.match(admin, /アカウントを停止/);
});
