import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("authenticated and financial pages are served with no-store caching", async () => {
  const source = await readFile("next.config.ts", "utf8");

  assert.match(source, /private, no-store, max-age=0/);
  assert.match(source, /"\/creator\/:path\*"/);
  assert.match(source, /"\/admin\/:path\*"/);
  assert.match(source, /"\/account"/);
});

test("Next.js is pinned to the current security patch line", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.dependencies.next, "16.3.8");
});
