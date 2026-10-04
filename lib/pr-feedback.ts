// After a PR: mutual reviews (相互評価) and per-post reports (閲覧数).
// Pure helpers shared by pages, matching and tests.

export type ReviewDirection = "restaurant_to_creator" | "creator_to_restaurant";

/** Same lists as public.pr_review_tags() in the database. */
export const REVIEW_TAGS: Record<ReviewDirection, readonly string[]> = {
  restaurant_to_creator: ["時間どおり", "写真・動画がきれい", "投稿が早い", "説明が丁寧", "また依頼したい"],
  creator_to_restaurant: ["説明どおりの内容", "対応が丁寧", "撮影しやすい", "連絡が早い", "また行きたい"],
};

export type ReviewSummary = {
  reviewCount: number;
  averageRating: number | null;
  /** Most mentioned tags first. */
  topTags: { tag: string; count: number }[];
};

export function toReviewSummary(row: {
  review_count: number;
  average_rating: number | string | null;
  tag_counts: Record<string, number> | null;
} | null | undefined): ReviewSummary | null {
  if (!row || !row.review_count) return null;

  return {
    reviewCount: row.review_count,
    // numeric arrives as a string from PostgREST.
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    topTags: Object.entries(row.tag_counts ?? {})
      .map(([tag, count]) => ({ tag, count: Number(count) }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"))
      .slice(0, 3),
  };
}

export function formatRating(summary: ReviewSummary | null) {
  if (!summary || summary.averageRating === null) return "評価なし";
  return `★${summary.averageRating.toFixed(1)}（${summary.reviewCount}件）`;
}

export type PostReport = {
  views: number;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  follows: number | null;
};

/** Yen per 1,000 views (CPM). null when nothing was seen yet. */
export function costPerThousandViews(costYen: number, views: number) {
  return views > 0 ? Math.round((costYen / views) * 1000) : null;
}

/** Saves per view: how many viewers kept the post to visit later. */
export function saveRate(report: Pick<PostReport, "views" | "saves">) {
  return report.views > 0 && report.saves !== null ? report.saves / report.views : null;
}

export type PostReportTotals = {
  posts: number;
  views: number;
  reach: number;
  saves: number;
  follows: number;
};

export function totalPostReports(reports: PostReport[]): PostReportTotals {
  return reports.reduce<PostReportTotals>(
    (sum, report) => ({
      posts: sum.posts + 1,
      views: sum.views + report.views,
      reach: sum.reach + (report.reach ?? 0),
      saves: sum.saves + (report.saves ?? 0),
      follows: sum.follows + (report.follows ?? 0),
    }),
    { posts: 0, views: 0, reach: 0, saves: 0, follows: 0 },
  );
}

/** A screenshot is due once the post has been up for a week. */
export const POST_REPORT_WAIT_DAYS = 7;

export function postReportDueAt(submittedAt: string) {
  return new Date(new Date(submittedAt).getTime() + POST_REPORT_WAIT_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * A number as shown on an insights screen: "12,400", "9786", "1.2万".
 * Returns null for anything else so that unclear digits are never guessed.
 */
export function parseInsightCount(input: string | undefined | null): number | null {
  if (input === undefined || input === null) return null;
  const text = input.normalize("NFKC").trim().replace(/[,\s]/g, "");
  if (/^\d+$/.test(text)) return Number(text);
  const man = /^(\d+(?:\.\d)?)万$/.exec(text);
  if (man) return Math.round(Number(man[1]) * 10_000);
  return null;
}
