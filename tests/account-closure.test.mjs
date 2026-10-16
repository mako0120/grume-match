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

test("commercial participants cannot be suspended with unresolved transactions", async () => {
  const [migration, action] = await Promise.all([
    readFile(
      "supabase/migrations/202610150003_account_closure_transaction_guard.sql",
      "utf8",
    ),
    readFile("server/actions/account-closure.ts", "utf8"),
  ]);

  assert.match(migration, /user_has_open_commercial_transactions/);
  assert.match(migration, /closure_has_active_transactions/);
  assert.match(migration, /p\.status not in \('paid', 'cancelled'\)/);
  assert.match(action, /未完了の案件・来店・報酬/);
});
