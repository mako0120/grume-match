import assert from "node:assert/strict";
import test from "node:test";
import {
  costPerThousandViews,
  formatCompactViews,
  parseInsightCount,
  parseInsightLines,
  parsePostedOn,
  summarizePerformance,
} from "../lib/creator-performance.ts";

// グルメ日誌 — Instagram insights, コンテンツ / 30日間 / 閲覧数順.
const GOURMET_DIARY_INSIGHTS = `
淡路市 / 刺身好きなら一度は行きたい / 2.7万 / 1,106 / 27 / 12 / 5 / 3週間
小野原 / 漁港直営の新鮮な海鮮定食を堪能 / 2.7万 / 666 / 10 / 6 / 13 / 4日
天王寺 / 開店から行列 人気の一杯 / 2.5万 / 775 / 4 / 7 / 18 / 2週間
難波 / 大和肉鶏・近江鴨 お造り七種盛り / 1.4万 / 602 / 0 / 8 / 17 / 2週間
南淡路 / とにかくボリューム満点 / 1.0万 / 809 / 4 / 6 / 9 / 3週間
松原 / 泡系豚骨 一度は食べたい / 9,786 / 728 / 1 / 4 / 2 / 3週間
本町 / 職人が握る本格鮨を気軽に / 5,975 / 634 / 3 / 4 / 0 / 2週間
北新地 / 旬を揃える天麩羅コース / 5,446 / 618 / 2 / 11 / 0 / 2週間
`;

const MEASURED_ON = "2026-10-03";

function toMetrics(rows, overrides = {}) {
  return rows.map((row) => ({
    ...row,
    platform: "instagram",
    measuredOn: MEASURED_ON,
    verified: false,
    ...overrides,
  }));
}

test("reads counts the way insights display them", () => {
  assert.deepEqual(parseInsightCount("2.7万"), { value: 27000, approx: true });
  assert.deepEqual(parseInsightCount("1.0万"), { value: 10000, approx: true });
  assert.deepEqual(parseInsightCount("9,786"), { value: 9786, approx: false });
  assert.deepEqual(parseInsightCount("１，１０６"), { value: 1106, approx: false });
  assert.deepEqual(parseInsightCount("1.2K"), { value: 1200, approx: true });
  assert.equal(parseInsightCount("1.5"), null);
  assert.equal(parseInsightCount("abc"), null);
});

test("resolves relative post ages against the measured date", () => {
  assert.deepEqual(parsePostedOn("4日", MEASURED_ON), { postedOn: "2026-09-29", approx: false });
  assert.deepEqual(parsePostedOn("2週間", MEASURED_ON), { postedOn: "2026-09-19", approx: true });
  assert.deepEqual(parsePostedOn("3週間前", MEASURED_ON), { postedOn: "2026-09-12", approx: true });
  assert.deepEqual(parsePostedOn("5時間", MEASURED_ON), { postedOn: "2026-10-03", approx: false });
  assert.deepEqual(parsePostedOn("2026-09-10", MEASURED_ON), { postedOn: "2026-09-10", approx: false });
  assert.deepEqual(parsePostedOn("9月10日", MEASURED_ON), { postedOn: "2026-09-10", approx: false });
  // A month/day after the measured date belongs to last year.
  assert.deepEqual(parsePostedOn("12月30日", MEASURED_ON), { postedOn: "2025-12-30", approx: false });
  assert.equal(parsePostedOn("先週", MEASURED_ON), null);
});

test("parses グルメ日誌's insights paste without errors", () => {
  const { rows, errors } = parseInsightLines(GOURMET_DIARY_INSIGHTS, MEASURED_ON);

  assert.deepEqual(errors, []);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], {
    area: "淡路市",
    headline: "刺身好きなら一度は行きたい",
    postUrl: null,
    postedOn: "2026-09-12",
    postedOnApprox: true,
    views: 27000,
    viewsApprox: true,
    likes: 1106,
    comments: 27,
    reposts: 12,
    shares: 5,
    saves: null,
  });
  assert.equal(rows[3].headline, "大和肉鶏・近江鴨 お造り七種盛り");
  assert.equal(rows[5].views, 9786);
  assert.equal(rows[5].viewsApprox, false);
});

test("accepts tabs, spaces, URLs and lines without headlines; reports bad lines", () => {
  const { rows, errors } = parseInsightLines(
    [
      "天王寺\t開店から行列\t2.5万\t775\t4\t7\t18\t2週間",
      "本町 5,975 634 3 4 0 2週間 https://www.instagram.com/reel/abc/",
      "# comment lines are ignored",
      "難波 / 1.4万 / 602 / 0",
      "松原 / 見出し / 多い / 1 / 1 / 1 / 1 / 1日",
      "北新地 / 見出し / 100 / 1 / 1 / 1 / 1 / 先週",
    ].join("\n"),
    MEASURED_ON,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].headline, "開店から行列");
  assert.equal(rows[1].headline, "");
  assert.equal(rows[1].postUrl, "https://www.instagram.com/reel/abc/");
  assert.deepEqual(
    errors.map((error) => error.line),
    [4, 5, 6],
  );
  assert.match(errors[1].reason, /閲覧数/);
  assert.match(errors[2].reason, /投稿時期/);
});

test("30-day summary of グルメ日誌", () => {
  const { rows } = parseInsightLines(GOURMET_DIARY_INSIGHTS, MEASURED_ON);
  const summary = summarizePerformance(toMetrics(rows), { today: MEASURED_ON });

  assert.equal(summary.postCount, 8);
  assert.equal(summary.totalViews, 124207);
  assert.equal(summary.viewsApprox, true);
  assert.equal(summary.averageViews, 15526);
  assert.equal(summary.medianViews, 12000);
  assert.equal(summary.maxViews, 27000);
  assert.equal(summary.minViews, 5446);
  assert.equal(summary.postsOver10k, 5);
  assert.equal(summary.totalLikes, 5938);
  assert.equal(summary.totalComments, 51);
  assert.equal(summary.totalReposts, 58);
  assert.equal(summary.totalShares, 64);
  assert.equal(summary.engagementRate.toFixed(4), "0.0492");
  assert.equal(summary.areas.length, 8);
  assert.equal(summary.verified, "none");
  assert.equal(summary.stale, false);

  assert.deepEqual(summary.highlights, [
    "直近30日の8投稿で合計約12.4万閲覧",
    "全投稿が5,000閲覧以上",
    "8本中5本が1万閲覧超え",
    "最高約2.7万閲覧（淡路市・小野原）",
    "8エリアで実績",
    "いいね合計5,938",
  ]);
});

test("summary uses only the latest snapshot and the 30-day window", () => {
  const { rows } = parseInsightLines(GOURMET_DIARY_INSIGHTS, MEASURED_ON);
  const older = toMetrics(rows, { measuredOn: "2026-09-20", views: 1 });
  const outOfWindow = toMetrics(
    [{ ...rows[0], area: "古い投稿", postedOn: "2026-08-01" }],
  );
  const verified = toMetrics(rows.slice(0, 2), { verified: true });

  const summary = summarizePerformance(
    [...older, ...outOfWindow, ...verified, ...toMetrics(rows.slice(2))],
    { today: "2026-11-20" },
  );

  assert.equal(summary.postCount, 8);
  assert.equal(summary.totalViews, 124207);
  assert.equal(summary.verified, "partial");
  assert.equal(summary.stale, true);
  assert.equal(summarizePerformance([]), null);
});

test("compact numbers and expected cost per 1,000 views", () => {
  assert.equal(formatCompactViews(124207), "12.4万");
  assert.equal(formatCompactViews(27000), "2.7万");
  assert.equal(formatCompactViews(9786), "9,786");
  assert.equal(costPerThousandViews(6000, 12000), 500);
  assert.equal(costPerThousandViews(6000, 0), null);
});

test("docs carry the same paste-ready data the summary is tested with", async () => {
  const { readFile } = await import("node:fs/promises");
  const docs = await readFile("docs/CREATOR_PERFORMANCE.md", "utf8");

  for (const line of GOURMET_DIARY_INSIGHTS.trim().split("\n")) {
    assert.ok(docs.includes(line), `docs missing: ${line}`);
  }
});

test("public media kit exposes no screenshots or contact details", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    "supabase/migrations/202610030003_creator_performance.sql",
    "utf8",
  );
  const kit = migration.slice(
    migration.indexOf("create or replace function public.get_public_media_kit"),
    migration.indexOf("revoke all on function public.get_public_media_kit"),
  );

  assert.match(kit, /cp\.media_kit_public/);
  assert.doesNotMatch(kit, /email|storage_path|evidence|phone/);
  assert.match(migration, /'creator-evidence',\s*'creator-evidence',\s*false/);
  assert.match(migration, /media_kit_public boolean not null default false/);
});
