import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Supabase proxy revalidates claims and never trusts getSession", async () => {
  const [proxy, root] = await Promise.all([
    readFile("lib/supabase/proxy.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
  ]);

  assert.match(proxy, /auth\.getClaims\(\)/);
  assert.doesNotMatch(proxy, /auth\.getSession\(\)/);
  assert.match(root, /updateSession/);
});

test("admin client prefers a server-only Supabase secret key", async () => {
  const source = await readFile("lib/supabase/admin.ts", "utf8");

  assert.match(source, /SUPABASE_SECRET_KEY/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SECRET/);
});
