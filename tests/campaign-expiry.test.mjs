import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("expired recruitment is closed without cancelling confirmed bookings", async () => {
  const [enumMigration, outcomeMigration, cron] = await Promise.all([
    readFile("supabase/migrations/202610020009_campaign_closed_status.sql", "utf8"),
    readFile("supabase/migrations/202610020010_expired_campaign_outcomes.sql", "utf8"),
    readFile("app/api/cron/reminders/route.ts", "utf8"),
  ]);

  assert.match(enumMigration, /add value if not exists 'closed'/);
  assert.match(outcomeMigration, /'closed', 'filled', 'cancelled', 'suspended'/);
  assert.match(cron, /\.update\(\{ status: "closed" \}\)/);
  assert.match(cron, /\.lt\("application_deadline", nowIso\)/);
  assert.doesNotMatch(cron, /update\(\{ status: "cancelled" \}\)/);
});

test("Restaurant home localizes recruitment state", async () => {
  const [labels, page] = await Promise.all([
    readFile("lib/status-labels.ts", "utf8"),
    readFile("app/restaurant/page.tsx", "utf8"),
  ]);

  assert.match(labels, /closed: "募集終了"/);
  assert.match(page, /campaignStatusLabels/);
});
