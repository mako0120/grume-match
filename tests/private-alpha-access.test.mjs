import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("private alpha signup requires an operator access code", async () => {
  const [action, page, env] = await Promise.all([
    readFile("server/actions/auth.ts", "utf8"),
    readFile("app/signup/page.tsx", "utf8"),
    readFile(".env.example", "utf8"),
  ]);

  assert.match(action, /PRIVATE_ALPHA_ACCESS_CODE/);
  assert.match(action, /PUBLIC_LAUNCH_ENABLED !== "true"/);
  assert.match(page, /Private Alpha 招待コード/);
  assert.match(env, /PRIVATE_ALPHA_ACCESS_CODE=/);
});

test("private alpha renders exactly one invite-code input", () => {
  const page = read("app/signup/page.tsx");
  assert.equal((page.match(/name="privateAlphaAccessCode"/g) || []).length, 1);
  assert.doesNotMatch(page, /name="alphaAccessCode"/);
});
