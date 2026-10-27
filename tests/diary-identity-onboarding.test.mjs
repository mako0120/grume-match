import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = f => readFileSync(f,"utf8");

test("Netlify Identity callbacks are processed in the root layout, even at the site root", () => {
  const root = read("app/layout.tsx");
  const handler = read("app/diary/identity/identity-callback.tsx");
  assert.match(root,/DiaryIdentityCallback/);
  assert.match(root,/DIARY_SITE_MODE/);
  assert.match(handler,/handleAuthCallback\(\)/);
  for (const event of ["invite_token","recovery_token","confirmation_token","email_change_token"]) {
    assert.match(handler,new RegExp(event));
  }
});

test("invitation acceptance never puts secret token in URL, logs or local storage", () => {
  const s = read("app/diary/identity/identity-callback.tsx");
  assert.match(s,/await acceptInvite\(invite, password\)/);
  assert.match(s,/setInvite\(null\)/);
  assert.doesNotMatch(s,/console\.log|localStorage|sessionStorage|URLSearchParams|\?token=/);
  assert.match(s,/minLength=\{12\}/);
  assert.match(s,/password !== confirm/);
});

test("recover password allows secure reset and contains no open signup", () => {
  const s = read("app/diary/identity/identity-callback.tsx");
  assert.match(s,/await updateUser\(\{ password \}\)/);
  assert.doesNotMatch(s,/\bsignup\s*\(/);
  const console = read("app/diary/ops/components/diary-ops-console.tsx");
  assert.match(console,/requestPasswordRecovery\(email\.trim\(\)\)/);
  assert.match(console,/パスワードを再設定/);
});

test("public landing remains functional in non-diary product builds", () => {
  const root = read("app/layout.tsx");
  assert.match(root,/process\.env\.DIARY_SITE_MODE === "true" \?/);
});
