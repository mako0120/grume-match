import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("email confirmation supports OTP and PKCE with an allowlisted recovery destination", async () => {
  const source = await readFile("app/auth/confirm/route.ts", "utf8");

  assert.match(source, /verifyOtp/);
  assert.match(source, /exchangeCodeForSession/);
  assert.match(source, /requestedNext === "\/update-password"/);
  assert.match(source, /\? "\/update-password"/);
  assert.match(source, /: "\/onboarding"/);
  assert.doesNotMatch(source, /destination\.pathname = requestedNext/);
});
