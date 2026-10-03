// Creator performance (実績): parsing insights as Creators read them off
// their phone, and the 30-day summary Restaurants see.

// Relative .ts import keeps this module runnable by node --test.
import { prefectureOf } from "./areas.ts";

export type PerformancePlatform = "instagram" | "tiktok" | "youtube" | "threads";

export const performancePlatformLabels: Record<PerformancePlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
};

export type PostMetric = {
  platform: string;
  area: string;
  headline: string;
  postUrl: string | null;
  postedOn: string; // YYYY-MM-DD
  postedOnApprox: boolean;
  measuredOn: string; // YYYY-MM-DD
  views: number;
  viewsApprox: boolean;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  saves: number | null;
  verified: boolean;
};

export const PERFORMANCE_WINDOW_DAYS = 30;
/** A snapshot older than this is shown as outdated. */
export const PERFORMANCE_STALE_DAYS = 35;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: string) {
  return new Date(value + "T00:00:00Z");
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  return toIsoDate(new Date(toDate(isoDate).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((toDate(toIso).getTime() - toDate(fromIso).getTime()) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Parsing what insights screens display
// ---------------------------------------------------------------------------

const fullWidth = /[０-９．，]/g;

function normalizeDigits(input: string) {
  return input
    .replace(fullWidth, (char) =>
      char === "．" ? "." : char === "，" ? "," : String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    )
    .trim();
}

/**
 * "9,786" → 9786 (exact). "2.7万" → 27000 (approximate, as the app rounds).
 * Also accepts "1.2K", "3M".
 */
export function parseInsightCount(input: string): { value: number; approx: boolean } | null {
  const text = normalizeDigits(input).replace(/[,\s]/g, "");
  const match = text.match(/^(\d+(?:\.\d+)?)(万|千|k|K|m|M)?$/);
  if (!match) return null;

  const base = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "万" ? 10_000 : unit === "千" || unit === "k" || unit === "K" ? 1_000 : unit === "m" || unit === "M" ? 1_000_000 : 1;

  if (!unit && !Number.isInteger(base)) return null;

  return { value: Math.round(base * multiplier), approx: Boolean(unit) };
}

/**
 * Relative age shown next to a post ("4日", "2週間", "3週間前", "1か月") or an
 * explicit date ("2026-09-10", "9/10"), resolved against the measured date.
 */
export function parsePostedOn(
  input: string,
  measuredOn: string,
): { postedOn: string; approx: boolean } | null {
  const text = normalizeDigits(input).replace(/\s|前/g, "");

  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const date = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return Number.isNaN(toDate(date).getTime()) ? null : { postedOn: date, approx: false };
  }

  const monthDay = text.match(/^(\d{1,2})[/月](\d{1,2})日?$/);
  if (monthDay) {
    const year = Number(measuredOn.slice(0, 4));
    let date = `${year}-${monthDay[1].padStart(2, "0")}-${monthDay[2].padStart(2, "0")}`;
    if (date > measuredOn) date = `${year - 1}${date.slice(4)}`;
    return { postedOn: date, approx: false };
  }

  const relative = text.match(/^(\d+)(分|時間|日|週間|週|か月|ヶ月|カ月|ヵ月|m|h|d|w)$/);
  if (!relative) return null;

  const amount = Number(relative[1]);
  const unit = relative[2];
  const days =
    unit === "分" || unit === "時間" || unit === "m" || unit === "h"
      ? 0
      : unit === "日" || unit === "d"
        ? amount
        : unit === "週間" || unit === "週" || unit === "w"
          ? amount * 7
          : amount * 30;

  // Week/month labels are rounded by the app; day-level ones are not.
  return { postedOn: addDays(measuredOn, -days), approx: days >= 7 };
}

export type ParsedInsightRow = Omit<PostMetric, "platform" | "measuredOn" | "verified">;

export type InsightParseResult = {
  rows: ParsedInsightRow[];
  errors: { line: number; text: string; reason: string }[];
};

/**
 * One post per line, in the order the insights screen shows it:
 *
 *   エリア / 見出し / 閲覧数 / いいね / コメント / リポスト / シェア / 投稿時期
 *
 * Separators: tab, "/" or "|" (or spaces when none of those are used). Commas
 * are read as thousands separators. The headline may be omitted. A https URL
 * anywhere on the line is taken as the post URL.
 */
export function parseInsightLines(text: string, measuredOn: string): InsightParseResult {
  const rows: ParsedInsightRow[] = [];
  const errors: InsightParseResult["errors"] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const urlMatch = line.match(/https:\/\/\S+/);
    const withoutUrl = urlMatch ? line.replace(urlMatch[0], " ") : line;
    // Commas are thousands separators ("1,106"), never field separators.
    const separator = /[\t/|｜]/.test(withoutUrl) ? /\s*[\t/|｜]\s*/ : /[\s　]+/;
    const fields = withoutUrl
      .split(separator)
      .map((field) => field.trim())
      .filter(Boolean);

    const fail = (reason: string) => errors.push({ line: index + 1, text: line, reason });

    const hasHeadline = fields.length >= 8;
    if (fields.length < 7) {
      fail("項目が足りません（エリア・閲覧数・いいね・コメント・リポスト・シェア・投稿時期）");
      return;
    }

    const [area, ...rest] = fields;
    const headline = hasHeadline ? rest.shift() ?? "" : "";
    const [viewsText, likesText, commentsText, repostsText, sharesText, postedText] = rest;

    const views = parseInsightCount(viewsText);
    const counts = [likesText, commentsText, repostsText, sharesText].map(parseInsightCount);
    const posted = parsePostedOn(postedText ?? "", measuredOn);

    if (!views) return fail(`閲覧数「${viewsText}」を読み取れません`);
    if (counts.some((count) => count === null)) return fail("いいね・コメント・リポスト・シェアは数字で入力してください");
    if (!posted) return fail(`投稿時期「${postedText ?? ""}」を読み取れません（例: 4日, 2週間, 9/10）`);
    if (posted.postedOn > measuredOn) return fail("投稿日が計測日より後になっています");
    if (area.length > 30) return fail("エリアは30文字以内にしてください");

    rows.push({
      area,
      headline: headline.slice(0, 60),
      postUrl: urlMatch ? urlMatch[0] : null,
      postedOn: posted.postedOn,
      postedOnApprox: posted.approx,
      views: views.value,
      viewsApprox: views.approx,
      likes: counts[0]!.value,
      comments: counts[1]!.value,
      reposts: counts[2]!.value,
      shares: counts[3]!.value,
      saves: null,
    });
  });

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type PerformanceSummary = {
  platform: string;
  measuredOn: string;
  windowStart: string;
  stale: boolean;
  posts: PostMetric[];
  postCount: number;
  totalViews: number;
  viewsApprox: boolean;
  averageViews: number;
  medianViews: number;
  maxViews: number;
  minViews: number;
  postsOver10k: number;
  totalLikes: number;
  totalComments: number;
  totalReposts: number;
  totalShares: number;
  /** (likes + comments + reposts + shares + saves) ÷ views */
  engagementRate: number | null;
  /** Per prefecture (大阪・兵庫, otherwise その他), most views first. */
  prefectures: { prefecture: string; posts: number; views: number }[];
  verified: "all" | "partial" | "none";
  highlights: string[];
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** "27,000" / "2.7万" style compact Japanese number. */
export function formatCompactViews(value: number) {
  if (value >= 10_000) {
    const man = value / 10_000;
    return `${man >= 100 ? Math.round(man) : Math.round(man * 10) / 10}万`;
  }
  return value.toLocaleString("ja-JP");
}

export function formatPercent(value: number | null, digits = 1) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

/**
 * Summary of the latest snapshot for one platform, limited to posts made in
 * the 30 days before the measured date. Returns null without data.
 */
export function summarizePerformance(
  allPosts: PostMetric[],
  options: { today?: string; platform?: string } = {},
): PerformanceSummary | null {
  const candidates = options.platform
    ? allPosts.filter((post) => post.platform === options.platform)
    : allPosts;
  if (!candidates.length) return null;

  // Latest snapshot wins; the same post measured twice must not be counted twice.
  const latest = candidates.reduce((best, post) =>
    post.measuredOn > best.measuredOn ||
    (post.measuredOn === best.measuredOn && post.views > best.views)
      ? post
      : best,
  );
  const measuredOn = latest.measuredOn;
  const platform = options.platform ?? latest.platform;
  const windowStart = addDays(measuredOn, -PERFORMANCE_WINDOW_DAYS);

  const posts = candidates
    .filter(
      (post) =>
        post.platform === platform &&
        post.measuredOn === measuredOn &&
        post.postedOn >= windowStart,
    )
    .sort((a, b) => b.views - a.views);

  if (!posts.length) return null;

  const views = posts.map((post) => post.views);
  const totalViews = views.reduce((sum, value) => sum + value, 0);
  const sum = (pick: (post: PostMetric) => number) =>
    posts.reduce((total, post) => total + pick(post), 0);
  const totalLikes = sum((post) => post.likes);
  const totalComments = sum((post) => post.comments);
  const totalReposts = sum((post) => post.reposts);
  const totalShares = sum((post) => post.shares);
  const totalSaves = sum((post) => post.saves ?? 0);

  const prefectureMap = new Map<string, { prefecture: string; posts: number; views: number }>();
  for (const post of posts) {
    const prefecture = prefectureOf(post.area) ?? "その他";
    const entry = prefectureMap.get(prefecture) ?? { prefecture, posts: 0, views: 0 };
    entry.posts += 1;
    entry.views += post.views;
    prefectureMap.set(prefecture, entry);
  }
  const prefectures = [...prefectureMap.values()].sort((a, b) => b.views - a.views);

  const verifiedCount = posts.filter((post) => post.verified).length;
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const summary: PerformanceSummary = {
    platform,
    measuredOn,
    windowStart,
    stale: daysBetween(measuredOn, today) > PERFORMANCE_STALE_DAYS,
    posts,
    postCount: posts.length,
    totalViews,
    viewsApprox: posts.some((post) => post.viewsApprox),
    averageViews: Math.round(totalViews / posts.length),
    medianViews: median(views),
    maxViews: Math.max(...views),
    minViews: Math.min(...views),
    postsOver10k: views.filter((value) => value >= 10_000).length,
    totalLikes,
    totalComments,
    totalReposts,
    totalShares,
    engagementRate:
      totalViews > 0
        ? (totalLikes + totalComments + totalReposts + totalShares + totalSaves) / totalViews
        : null,
    prefectures,
    verified:
      verifiedCount === posts.length ? "all" : verifiedCount > 0 ? "partial" : "none",
    highlights: [],
  };

  summary.highlights = buildHighlights(summary);
  return summary;
}

function buildHighlights(summary: PerformanceSummary) {
  const highlights: string[] = [];
  const approx = summary.viewsApprox ? "約" : "";

  highlights.push(
    `直近30日の${summary.postCount}投稿で合計${approx}${formatCompactViews(summary.totalViews)}閲覧`,
  );

  if (summary.postCount >= 3 && summary.minViews >= 1_000) {
    highlights.push(`全投稿が${formatCompactViews(Math.floor(summary.minViews / 1_000) * 1_000)}閲覧以上`);
  }

  if (summary.postsOver10k > 0) {
    highlights.push(`${summary.postCount}本中${summary.postsOver10k}本が1万閲覧超え`);
  }

  highlights.push(`最高${approx}${formatCompactViews(summary.maxViews)}閲覧`);

  const known = summary.prefectures.filter((entry) => entry.prefecture !== "その他");
  if (known.length) {
    highlights.push(
      known
        .map(
          (entry) =>
            `${entry.prefecture}${entry.posts}投稿（${approx}${formatCompactViews(entry.views)}閲覧）`,
        )
        .join("・"),
    );
  }

  if (summary.totalLikes > 0) {
    highlights.push(`いいね合計${summary.totalLikes.toLocaleString("ja-JP")}`);
  }

  return highlights;
}

/** Reward ÷ expected views (median), per 1,000 views. */
export function costPerThousandViews(reward: number, medianViews: number) {
  return medianViews > 0 && reward > 0 ? Math.round((reward / medianViews) * 1000) : null;
}

export function rowToPostMetric(row: {
  platform: string;
  area: string;
  headline: string;
  post_url: string | null;
  posted_on: string;
  posted_on_approx: boolean;
  measured_on: string;
  views: number;
  views_approx: boolean;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  saves: number | null;
  verified_at?: string | null;
  verified?: boolean;
}): PostMetric {
  return {
    platform: row.platform,
    area: row.area,
    headline: row.headline,
    postUrl: row.post_url,
    postedOn: row.posted_on,
    postedOnApprox: row.posted_on_approx,
    measuredOn: row.measured_on,
    views: row.views,
    viewsApprox: row.views_approx,
    likes: row.likes,
    comments: row.comments,
    reposts: row.reposts,
    shares: row.shares,
    saves: row.saves,
    verified: row.verified ?? Boolean(row.verified_at),
  };
}
