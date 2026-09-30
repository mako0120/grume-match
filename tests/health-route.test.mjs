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
