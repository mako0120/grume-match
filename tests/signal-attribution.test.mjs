import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  deriveSignalMetrics,
  formatRoas,
  formatSignalCode,
  formatYen,
  isSignalCode,
  normalizeSignalCode,
  summarizeSignal,
} from "../lib/signal-metrics.ts";

function row(overrides) {
  return {
    tracking_link_id: "link",
    code: "ABCDEFGH",
    booking_id: "booking",
    campaign_id: "campaign",
    campaign_title: "PR",
    creator_name: "Creator",
    visit_starts_at: "2026-10-10T10:00:00+00:00",
    disabled: false,
    cost_yen: 0,
    landing_views: 0,
    visits: 0,
    visit_guests: 0,
    revenue_yen: 0,
    ...overrides,
  };
}

test("PR codes are normalized from spoken or typed input", () => {
  assert.equal(normalizeSignalCode(" abcd-efgh "), "ABCDEFGH");
  assert.equal(formatSignalCode("abcdefgh"), "ABCD-EFGH");
  assert.equal(isSignalCode("abcd efgh"), true);
  // Look-alike characters are not part of the alphabet.
  assert.equal(isSignalCode("ABCD0FGH"), false);
  assert.equal(isSignalCode("ABCDIFGH"), false);
  assert.equal(isSignalCode("ABCDEFG"), false);
});

test("cost per visit, view-to-visit rate and ROAS", () => {
  const metrics = deriveSignalMetrics({
    costYen: 11000,
    landingViews: 400,
    visits: 3,
    visitGuests: 7,
    revenueYen: 42000,
  });

  assert.equal(metrics.costPerVisit, 3667);
  assert.equal(metrics.roas.toFixed(2), "3.82");
  assert.equal(metrics.visitRate, 0.0075);
  assert.equal("costPerReservation" in metrics, false);
});

test("metrics stay undefined instead of dividing by zero", () => {
  const metrics = deriveSignalMetrics({
    costYen: 6000,
    landingViews: 0,
    visits: 0,
    visitGuests: 0,
    revenueYen: 0,
  });

  assert.equal(metrics.costPerVisit, null);
  assert.equal(metrics.visitRate, null);
  assert.equal(metrics.roas, 0);
  assert.equal(formatYen(null), "—");
  assert.equal(formatRoas(null), "—");
  assert.equal(deriveSignalMetrics({ ...metrics, costYen: 0 }).roas, null);
});

test("summary totals across Creators and ranks by visits", () => {
  const { totals, creators } = summarizeSignal([
    row({
      tracking_link_id: "a",
      creator_name: "A",
      cost_yen: 6000,
      landing_views: 100,
    }),
    row({
      tracking_link_id: "b",
      creator_name: "B",
      cost_yen: 11000,
      landing_views: 50,
      visits: 2,
      visit_guests: 5,
      // bigint aggregates arrive as strings.
      revenue_yen: "33000",
    }),
  ]);

  assert.deepEqual(
    creators.map((creator) => creator.creatorName),
    ["B", "A"],
  );
  assert.equal(totals.costYen, 17000);
  assert.equal(totals.landingViews, 150);
  assert.equal(totals.visits, 2);
  assert.equal(totals.revenueYen, 33000);
  assert.equal(totals.costPerVisit, 8500);
  assert.equal(creators[0].costPerVisit, 5500);
  assert.equal(creators[1].costPerVisit, null);
});

test("landing views store no visitor identifiers", async () => {
  const [route, migration, landing] = await Promise.all([
    readFile("app/api/signal/route.ts", "utf8"),
    readFile("supabase/migrations/202610030002_signal_attribution.sql", "utf8"),
    readFile("components/signal-landing-actions.tsx", "utf8"),
  ]);

  assert.doesNotMatch(route, /x-forwarded-for|user-agent|cookies\(\)|request\.ip/i);
  assert.doesNotMatch(landing, /document\.cookie|localStorage/);

  const table = migration.slice(
    migration.indexOf("create table public.signal_events"),
    migration.indexOf("create index signal_events_link_kind_idx"),
  );
  assert.doesNotMatch(table, /\bip\b|user_agent|cookie|email|phone|name/i);

  assert.match(migration, /interval '13 months'/);
  assert.match(migration, /grant execute on function public\.record_signal_view\(text\) to anon, authenticated/);
  assert.match(migration, /grant execute on function public\.record_signal_visit\(text, integer, integer, date\) to authenticated;/);
  assert.match(migration, /v_recent >= 30/);
});

test("Creators get counts without the Restaurant's spend", async () => {
  const migration = await readFile(
    "supabase/migrations/202610030002_signal_attribution.sql",
    "utf8",
  );
  const creatorSummary = migration.slice(
    migration.indexOf("create or replace function public.creator_signal_summary"),
    migration.indexOf("revoke all on function public.creator_signal_summary"),
  );

  assert.doesNotMatch(creatorSummary, /revenue|cost|amount/);
});

test("there is no reservation tracking", async () => {
  const files = await Promise.all(
    [
      "supabase/migrations/202610030002_signal_attribution.sql",
      "app/api/signal/route.ts",
      "components/signal-landing-actions.tsx",
      "app/r/[code]/page.tsx",
      "app/restaurant/signal/page.tsx",
      "lib/signal-metrics.ts",
    ].map((path) => readFile(path, "utf8")),
  );

  for (const source of files) {
    // Case-sensitive so the migration may still explain why "Reservations" are out of scope.
    assert.doesNotMatch(source, /reserv|call_click|予約/);
  }
});
