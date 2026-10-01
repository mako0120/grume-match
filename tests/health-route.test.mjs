import assert from "node:assert/strict";
import test from "node:test";

test("health route contract never exposes secret values", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("app/api/health/route.ts", "utf8"),
  );

  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /CRON_SECRET/);
  assert.doesNotMatch(source, /process\.env\[[^\]]+\]\s*[,}]/);
  assert.doesNotMatch(source, /serviceRoleKey\s*:/);
  assert.doesNotMatch(source, /cronSecret\s*:\s*process\.env/);
});


test("health route verifies the core PR OS schema", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("app/api/health/route.ts", "utf8"),
  );

  assert.match(source, /\.from\("creator_profiles"\)/);
  assert.match(source, /\.from\("campaigns"\)/);
  assert.match(source, /\.from\("applications"\)/);
  assert.match(source, /\.from\("bookings"\)/);
  assert.match(source, /\.from\("payments"\)/);
  assert.match(source, /schema_incomplete/);
});
