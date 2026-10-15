import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("password reset uses canonical site URL and recovery confirmation route", async () => {
  const [actions, confirm, env] = await Promise.all([
    readFile("server/actions/auth.ts", "utf8"),
    readFile("app/auth/confirm/route.ts", "utf8"),
    readFile(".env.example", "utf8"),
  ]);

  assert.match(actions, /resetPasswordForEmail/);
  assert.match(actions, /\/auth\/confirm\?next=\/update-password/);
  assert.match(confirm, /type === "recovery"/);
  assert.match(confirm, /"\/update-password"/);
  assert.match(env, /NEXT_PUBLIC_SITE_URL=/);
});

test("login exposes password recovery", async () => {
  const source = await readFile("app/login/page.tsx", "utf8");
  assert.match(source, /\/forgot-password/);
});
