import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("commercial app access requires the current policy version", async () => {
  const [destination, roleGuard, policy] = await Promise.all([
    readFile("server/auth/resolve-destination.ts", "utf8"),
    readFile("server/auth/require-role.ts", "utf8"),
    readFile("lib/policies.ts", "utf8"),
  ]);

  assert.match(policy, /2026-10-13-alpha1/);
  assert.match(destination, /"\/legal\/accept"/);
  assert.match(destination, /REQUIRED_POLICIES\.every/);
  assert.match(roleGuard, /redirect\("\/legal\/accept"\)/);
});

test("policy acceptance is versioned and auditable in the database", async () => {
  const source = await readFile(
    "supabase/migrations/202610130003_policy_acceptance.sql",
    "utf8",
  );

  assert.match(source, /user_policy_acceptances/);
  assert.match(source, /primary key \(user_id, policy, version\)/);
  assert.match(source, /user_id = auth\.uid\(\)/);
});

test("signup and acceptance UI link to all required documents", async () => {
  const [signup, acceptance] = await Promise.all([
    readFile("app/signup/page.tsx", "utf8"),
    readFile("components/policy-acceptance-form.tsx", "utf8"),
  ]);

  for (const href of [
    "/legal/terms",
    "/legal/privacy",
    "/legal/pr-guidelines",
  ]) {
    assert.match(signup, new RegExp(href.replaceAll("/", "\\/")));
    assert.match(acceptance, new RegExp(href.replaceAll("/", "\\/")));
  }

  assert.match(signup, /required type="checkbox"/);
});
