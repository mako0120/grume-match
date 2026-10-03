import {
  rowToPostMetric,
  summarizePerformance,
  type PerformanceSummary,
  type PostMetric,
} from "@/lib/creator-performance";
import { createClient } from "@/lib/supabase/server";

const metricColumns =
  "id,creator_id,platform,area,headline,post_url,posted_on,posted_on_approx,measured_on,views,views_approx,likes,comments,reposts,shares,saves,verified_at";

type MetricRow = Parameters<typeof rowToPostMetric>[0] & {
  id: string;
  creator_id: string;
};

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type SocialAccountSummary = {
  platform: string;
  handle: string;
  profileUrl: string;
  followers: number;
};

/** The signed-in Creator's own data for /creator/performance. */
export async function getOwnPerformance() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id,display_name,media_kit_slug,media_kit_public")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!profile) return null;

  const [metricsResult, evidenceResult] = await Promise.all([
    supabase
      .from("creator_post_metrics")
      .select(metricColumns)
      .eq("creator_id", profile.id)
      .order("measured_on", { ascending: false })
      .order("views", { ascending: false })
      .limit(200),
    supabase
      .from("creator_performance_evidence")
      .select("id,platform,measured_on,status,review_note,created_at")
      .eq("creator_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (metricsResult.error) throw new Error(metricsResult.error.message);

  const rows = (metricsResult.data ?? []) as MetricRow[];
  const posts = rows.map(rowToPostMetric);

  return {
    userId: authData.user.id,
    profile: profile as {
      id: string;
      display_name: string;
      media_kit_slug: string | null;
      media_kit_public: boolean;
    },
    rows: rows.map((row) => ({ id: row.id, ...rowToPostMetric(row) })),
    summary: summarizePerformance(posts, { today: todayInTokyo() }),
    evidence: (evidenceResult.data ?? []) as {
      id: string;
      platform: string;
      measured_on: string;
      status: "pending" | "verified" | "rejected";
      review_note: string | null;
      created_at: string;
    }[],
  };
}

/** 30-day summaries for many Creators at once (applicant lists, pickers). */
export async function getPerformanceSummaries(
  creatorIds: string[],
): Promise<Map<string, PerformanceSummary>> {
  const result = new Map<string, PerformanceSummary>();
  const ids = [...new Set(creatorIds)].filter(Boolean);
  if (!ids.length) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_post_metrics")
    .select(metricColumns)
    .in("creator_id", ids)
    .order("measured_on", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  const byCreator = new Map<string, PostMetric[]>();
  for (const row of (data ?? []) as MetricRow[]) {
    const list = byCreator.get(row.creator_id) ?? [];
    list.push(rowToPostMetric(row));
    byCreator.set(row.creator_id, list);
  }

  const today = todayInTokyo();
  for (const [creatorId, posts] of byCreator) {
    const summary = summarizePerformance(posts, { today });
    if (summary) result.set(creatorId, summary);
  }

  return result;
}

/** Full media kit of one Creator for signed-in Restaurants / Operator. */
export async function getCreatorMediaKit(creatorId: string) {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("creator_profiles")
    .select(
      "id,display_name,bio,base_area,min_reward,reliability_score,creator_social_accounts(platform,handle,profile_url,followers)",
    )
    .eq("id", creatorId)
    .maybeSingle();

  if (error || !profile) return null;

  const summaries = await getPerformanceSummaries([creatorId]);
  const accounts = (profile.creator_social_accounts ?? []) as {
    platform: string;
    handle: string;
    profile_url: string;
    followers: number;
  }[];

  return {
    id: profile.id as string,
    displayName: profile.display_name as string,
    bio: (profile.bio as string) ?? "",
    baseArea: profile.base_area as string,
    minReward: (profile.min_reward as number) ?? 0,
    accounts: accounts.map(
      (account): SocialAccountSummary => ({
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profile_url,
        followers: account.followers,
      }),
    ),
    summary: summaries.get(creatorId) ?? null,
  };
}

type PublicKit = {
  display_name: string;
  bio: string;
  base_area: string;
  min_reward: number;
  accounts: { platform: string; handle: string; profile_url: string; followers: number }[];
  posts: (Parameters<typeof rowToPostMetric>[0] & { verified: boolean })[];
};

/** Opt-in public media kit (no login). */
export async function getPublicMediaKit(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_media_kit", {
    p_slug: slug,
  });

  if (error || !data) return null;

  const kit = data as PublicKit;
  const posts = (kit.posts ?? []).map(rowToPostMetric);

  return {
    displayName: kit.display_name,
    bio: kit.bio ?? "",
    baseArea: kit.base_area,
    minReward: kit.min_reward ?? 0,
    accounts: (kit.accounts ?? []).map(
      (account): SocialAccountSummary => ({
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profile_url,
        followers: account.followers,
      }),
    ),
    summary: summarizePerformance(posts, { today: todayInTokyo() }),
  };
}

/** Operator queue of screenshots waiting for review. */
export async function listPendingEvidence() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_performance_evidence")
    .select("id,creator_id,platform,measured_on,storage_path,created_at,creator_profiles(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    id: string;
    creator_id: string;
    platform: string;
    measured_on: string;
    storage_path: string;
    created_at: string;
    creator_profiles: { display_name: string } | { display_name: string }[] | null;
  }[];

  const signed = rows.length
    ? await supabase.storage
        .from("creator-evidence")
        .createSignedUrls(rows.map((row) => row.storage_path), 10 * 60)
    : { data: [] };

  const summaries = await getPerformanceSummaries(rows.map((row) => row.creator_id));

  return rows.map((row) => {
    const creator = Array.isArray(row.creator_profiles)
      ? row.creator_profiles[0]
      : row.creator_profiles;
    const url = signed.data?.find((item) => item.path === row.storage_path);

    return {
      id: row.id,
      creatorId: row.creator_id,
      creatorName: creator?.display_name ?? "Creator",
      platform: row.platform,
      measuredOn: row.measured_on,
      createdAt: row.created_at,
      imageUrl: url && !url.error ? url.signedUrl : null,
      summary: summaries.get(row.creator_id) ?? null,
    };
  });
}
