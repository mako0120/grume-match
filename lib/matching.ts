// Restaurant ↔ Creator matching. Rule-based and explainable: every point
// comes with a reason the Restaurant (or Creator) can read. No AI.
// Area is compared per prefecture (大阪・兵庫).

// Relative .ts imports keep this module runnable by node --test.
import { normalizeArea, prefectureOf } from "./areas.ts";
import { formatCompactViews, type PerformanceSummary } from "./creator-performance.ts";
import type { ReviewSummary } from "./pr-feedback.ts";

export type MatchCampaign = {
  area: string;
  category: string;
  cashReward: number | null;
  kind?: "market" | "flash";
};

export type MatchCreator = {
  id: string;
  displayName: string;
  baseArea: string;
  minReward: number;
  bio?: string;
  performance: PerformanceSummary | null;
  completedPrs: number;
  noShows: number;
  standbyActive?: boolean;
  /** Restaurants' ratings after completed PRs (revealed reviews only). */
  reviews?: ReviewSummary | null;
};

export type MatchResult = {
  creatorId: string;
  score: number;
  label: "とても合う" | "合う" | "";
  reasons: string[];
  cautions: string[];
  /** Hard mismatch: do not recommend or auto-invite. */
  blocked: boolean;
};

type Point = { points: number; reason?: string; caution?: string };

// Area is judged per prefecture (大阪・兵庫), not per neighbourhood.
function areaPoint(campaign: MatchCampaign, creator: MatchCreator): Point {
  const prefecture = prefectureOf(campaign.area);
  if (!prefecture) return { points: 0 };

  const postsThere =
    creator.performance?.prefectures.find((entry) => entry.prefecture === prefecture)?.posts ?? 0;
  if (postsThere > 0) {
    return { points: 30, reason: `${prefecture}で投稿実績あり（${postsThere}本）` };
  }

  if (
    prefectureOf(creator.baseArea) === prefecture ||
    normalizeArea(creator.baseArea).includes(prefecture)
  ) {
    return { points: 24, reason: `${prefecture}で活動` };
  }

  return { points: 0, caution: `${prefecture}での実績はまだありません` };
}

function reachPoint(creator: MatchCreator): Point {
  const summary = creator.performance;
  if (!summary) return { points: 0, caution: "閲覧実績が未登録" };

  const median = summary.medianViews;
  const points = median >= 20_000 ? 25 : median >= 10_000 ? 20 : median >= 5_000 ? 14 : median >= 2_000 ? 8 : 4;
  const reason =
    median >= 2_000
      ? `1投稿あたり中央値${formatCompactViews(median)}閲覧${summary.verified === "all" ? "（確認済み）" : ""}`
      : undefined;

  return {
    points: points + (summary.verified === "all" ? 5 : 0),
    reason,
    caution: summary.stale ? "実績が35日以上前のもの" : undefined,
  };
}

function engagementPoint(creator: MatchCreator): Point {
  const rate = creator.performance?.engagementRate ?? null;
  if (rate === null) return { points: 0 };
  if (rate >= 0.06) return { points: 10, reason: `反応率${(rate * 100).toFixed(1)}%と高い` };
  if (rate >= 0.04) return { points: 7 };
  if (rate >= 0.02) return { points: 4 };
  return { points: 0 };
}

function trackRecordPoint(creator: MatchCreator): Point {
  const done = creator.completedPrs;
  const base = done >= 5 ? 20 : done >= 3 ? 15 : done >= 1 ? 10 : 0;
  const penalty = creator.noShows * 15;

  return {
    points: base - penalty,
    reason: done > 0 ? `PR完了${done}件` : undefined,
    caution: creator.noShows > 0 ? `無断キャンセル${creator.noShows}件` : undefined,
  };
}

// Restaurants' ratings count once there are at least 2, so that a single
// review cannot make or break a Creator.
function reviewPoint(creator: MatchCreator): Point {
  const reviews = creator.reviews;
  if (!reviews || reviews.averageRating === null || reviews.reviewCount < 2) return { points: 0 };

  const rating = reviews.averageRating;
  const label = `店舗評価★${rating.toFixed(1)}（${reviews.reviewCount}件）`;
  if (rating >= 4.5) return { points: 10, reason: label };
  if (rating >= 4) return { points: 6, reason: label };
  if (rating < 3) return { points: -10, caution: `店舗評価が低め（★${rating.toFixed(1)}）` };
  return { points: 0 };
}

function genrePoint(campaign: MatchCampaign, creator: MatchCreator): Point {
  const category = campaign.category.trim();
  if (!category) return { points: 0 };

  const text = [
    creator.bio ?? "",
    ...(creator.performance?.posts.map((post) => post.headline) ?? []),
  ].join(" ");

  return text.includes(category)
    ? { points: 10, reason: `${category}の発信あり` }
    : { points: 0 };
}

export function matchCreatorToCampaign(campaign: MatchCampaign, creator: MatchCreator): MatchResult {
  const points: Point[] = [
    areaPoint(campaign, creator),
    reachPoint(creator),
    engagementPoint(creator),
    trackRecordPoint(creator),
    reviewPoint(creator),
    genrePoint(campaign, creator),
  ];

  const cautions = points.map((point) => point.caution).filter((value): value is string => Boolean(value));
  let blocked = creator.noShows >= 2;

  if (campaign.cashReward !== null && creator.minReward > 0 && campaign.cashReward < creator.minReward) {
    cautions.unshift(`希望報酬（¥${creator.minReward.toLocaleString("ja-JP")}〜）に届きません`);
    blocked = true;
  }

  const reasons = points
    .filter((point) => point.points > 0 && point.reason)
    .sort((a, b) => b.points - a.points)
    .map((point) => point.reason as string);

  if (campaign.kind === "flash" && creator.standbyActive) {
    reasons.unshift("今行けるがON");
  }

  if (campaign.cashReward !== null && creator.minReward > 0 && campaign.cashReward >= creator.minReward) {
    reasons.push("希望報酬以上");
  }

  const raw = points.reduce((sum, point) => sum + point.points, 0) +
    (campaign.kind === "flash" && creator.standbyActive ? 15 : 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    creatorId: creator.id,
    score,
    label: blocked ? "" : score >= 70 ? "とても合う" : score >= 50 ? "合う" : "",
    reasons: reasons.slice(0, 4),
    cautions,
    blocked,
  };
}

/** Best matches first; blocked Creators last. */
export function rankCreators(campaign: MatchCampaign, creators: MatchCreator[]) {
  return creators
    .map((creator) => ({ creator, match: matchCreatorToCampaign(campaign, creator) }))
    .sort(
      (a, b) =>
        Number(a.match.blocked) - Number(b.match.blocked) ||
        b.match.score - a.match.score ||
        a.creator.displayName.localeCompare(b.creator.displayName, "ja"),
    );
}

/** Creators worth inviting automatically when a campaign is published. */
export function autoInviteCandidates(
  campaign: MatchCampaign,
  creators: MatchCreator[],
  limit = 10,
  minimumScore = 50,
) {
  return rankCreators(campaign, creators)
    .filter(({ match }) => !match.blocked && match.score >= minimumScore)
    .slice(0, limit);
}
