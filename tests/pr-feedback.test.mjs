import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  REVIEW_TAGS,
  costPerThousandViews,
  formatRating,
  parseInsightCount,
  postReportDueAt,
  saveRate,
  toReviewSummary,
  totalPostReports,
} from "../lib/pr-feedback.ts";

test("review summaries come from the database row, top tags first", () => {
  const summary = toReviewSummary({
    review_count: 4,
    average_rating: "4.75",
    tag_counts: { "投稿が早い": 2, "時間どおり": 4, "写真・動画がきれい": 3, "説明が丁寧": 1 },
  });

  assert.equal(summary.averageRating, 4.75);
  assert.deepEqual(
    summary.topTags.map((item) => item.tag),
    ["時間どおり", "写真・動画がきれい", "投稿が早い"],
  );
  assert.equal(formatRating(summary), "★4.8（4件）");
  assert.equal(toReviewSummary({ review_count: 0, average_rating: null, tag_counts: {} }), null);
  assert.equal(formatRating(null), "評価なし");
});

test("tag lists match the database", async () => {
  const migration = await readFile("supabase/migrations/202610030006_pr_reviews.sql", "utf8");
  for (const tags of Object.values(REVIEW_TAGS)) {
    assert.ok(migration.includes("array['" + tags.join("', '") + "']"));
  }
});

test("cost per 1,000 views and save rate", () => {
  assert.equal(costPerThousandViews(8000, 12400), 645);
  assert.equal(costPerThousandViews(8000, 0), null);
  assert.equal(saveRate({ views: 12400, saves: 310 }), 0.025);
  assert.equal(saveRate({ views: 12400, saves: null }), null);
});

test("post report totals treat missing numbers as zero", () => {
  const totals = totalPostReports([
    { views: 12400, reach: 9800, likes: 640, comments: 12, saves: 310, shares: 45, follows: 28 },
    { views: 5000, reach: null, likes: null, comments: null, saves: 80, shares: null, follows: null },
  ]);
  assert.deepEqual(totals, { posts: 2, views: 17400, reach: 9800, saves: 390, follows: 28 });
});

test("insight counts are read as shown, never guessed", () => {
  assert.equal(parseInsightCount("12,400"), 12400);
  assert.equal(parseInsightCount("９７８６"), 9786);
  assert.equal(parseInsightCount("1.2万"), 12000);
  assert.equal(parseInsightCount("2万"), 20000);
  assert.equal(parseInsightCount("1.25万"), null);
  assert.equal(parseInsightCount("12k"), null);
  assert.equal(parseInsightCount(""), null);
  assert.equal(parseInsightCount(undefined), null);
});

test("a post report is due a week after the post", () => {
  assert.equal(
    postReportDueAt("2026-10-01T10:00:00.000Z").toISOString(),
    "2026-10-08T10:00:00.000Z",
  );
});

test("restaurants never see the screenshot or write the numbers", async () => {
  const migration = await readFile("supabase/migrations/202610030007_pr_post_reports.sql", "utf8");
  assert.doesNotMatch(migration, /create policy[^;]*for (insert|update|delete)/i);
  assert.match(migration, /if not public\.is_operator_or_service\(\) then/);
  assert.match(migration, /reach_exceeds_views/);
});
