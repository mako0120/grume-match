import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("email confirmation route supports OTP and PKCE without open redirects", async () => {
  const source = await readFile("app/auth/confirm/route.ts", "utf8");

  assert.match(source, /verifyOtp/);
  assert.match(source, /exchangeCodeForSession/);
  assert.match(source, /destination\.pathname = "\/onboarding"/);
  assert.doesNotMatch(source, /searchParams\.get\("next"\)/);
});
