import {
  matchCreatorToCampaign,
  rankCreators,
  type MatchCampaign,
  type MatchCreator,
  type MatchResult,
} from "@/lib/matching";
import { createClient } from "@/lib/supabase/server";
import { getPerformanceSummaries } from "@/server/queries/performance";

type ProfileRow = {
  id: string;
  display_name: string;
  base_area: string;
  min_reward: number;
  bio: string | null;
};

async function trackRecords(creatorIds: string[]) {
  const records = new Map<string, { completed: number; noShows: number }>();
  if (!creatorIds.length) return records;

  const supabase = await createClient();
  const { data } = await supabase.rpc("creator_track_records", { p_creator_ids: creatorIds });
  for (const row of (data ?? []) as { creator_id: string; completed: number; no_shows: number }[]) {
    records.set(row.creator_id, { completed: row.completed, noShows: row.no_shows });
  }
  return records;
}

async function activeStandbyIds() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_active_standby_creators");
  return new Set(((data ?? []) as { creator_id: string }[]).map((row) => row.creator_id));
}

/** Everything matching needs about these Creators, in a few queries. */
export async function loadMatchCreators(profiles: ProfileRow[]): Promise<MatchCreator[]> {
  const ids = profiles.map((profile) => profile.id);
  const [performance, records, standby] = await Promise.all([
    getPerformanceSummaries(ids),
    trackRecords(ids),
    activeStandbyIds(),
  ]);

  return profiles.map((profile) => ({
    id: profile.id,
    displayName: profile.display_name,
    baseArea: profile.base_area,
    minReward: profile.min_reward ?? 0,
    bio: profile.bio ?? "",
    performance: performance.get(profile.id) ?? null,
    completedPrs: records.get(profile.id)?.completed ?? 0,
    noShows: records.get(profile.id)?.noShows ?? 0,
    standbyActive: standby.has(profile.id),
  }));
}

/** All Creators visible to the signed-in Restaurant. */
export async function loadAllMatchCreators() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("id,display_name,base_area,min_reward,bio")
    .order("display_name", { ascending: true })
    .limit(300);

  if (error) throw new Error(error.message);
  return loadMatchCreators((data ?? []) as ProfileRow[]);
}

export type CampaignMatchView = {
  campaignId: string;
  canInvite: boolean;
  invitedCount: number;
  applicantMatches: Map<string, MatchResult>;
  recommendations: { creator: MatchCreator; match: MatchResult }[];
};

/** Restaurant view: how applicants fit, and who else to invite. */
export async function getCampaignMatches(campaignId: string): Promise<CampaignMatchView | null> {
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id,area,category,cash_reward,kind,visibility,status,application_deadline,applications(creator_id),campaign_invitations(creator_id)",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return null;

  const matchCampaign: MatchCampaign = {
    area: campaign.area,
    category: campaign.category,
    cashReward: campaign.cash_reward,
    kind: campaign.kind === "flash" ? "flash" : "market",
  };

  const applied = new Set(
    ((campaign.applications ?? []) as { creator_id: string }[]).map((row) => row.creator_id),
  );
  const invited = new Set(
    ((campaign.campaign_invitations ?? []) as { creator_id: string }[]).map((row) => row.creator_id),
  );

  const creators = await loadAllMatchCreators();
  const ranked = rankCreators(matchCampaign, creators);

  const canInvite =
    campaign.visibility === "public" &&
    ["published", "recruiting"].includes(campaign.status) &&
    new Date(campaign.application_deadline).getTime() > Date.now();

  return {
    campaignId: campaign.id,
    canInvite,
    invitedCount: invited.size,
    applicantMatches: new Map(
      ranked
        .filter(({ creator }) => applied.has(creator.id))
        .map(({ creator, match }) => [creator.id, match]),
    ),
    recommendations: canInvite
      ? ranked
          .filter(
            ({ creator, match }) =>
              // Low bar on purpose: new Creators in the right area need a first
              // job. Auto-invites (autoInviteCandidates) keep a higher bar.
              !applied.has(creator.id) && !invited.has(creator.id) && !match.blocked && match.score >= 15,
          )
          .slice(0, 5)
      : [],
  };
}

/** Creator view: how each open campaign fits me, and where I was invited. */
export async function getMyCampaignMatches(
  campaigns: { id: string; area: string; category: string; cashReward: number; kind?: "market" | "flash" }[],
) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const result = new Map<string, MatchResult & { invited: boolean }>();
  if (!authData.user || !campaigns.length) return result;

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id,display_name,base_area,min_reward,bio")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!profile) return result;

  const [[me], invitations, standby] = await Promise.all([
    loadMatchCreators([profile as ProfileRow]),
    supabase
      .from("campaign_invitations")
      .select("campaign_id")
      .eq("creator_id", profile.id),
    supabase
      .from("creator_standby")
      .select("enabled,available_until")
      .eq("creator_id", profile.id)
      .maybeSingle(),
  ]);

  // get_active_standby_creators is Restaurant-only; read my own row instead.
  const standbyActive =
    standby.data?.enabled === true &&
    Boolean(standby.data.available_until) &&
    new Date(standby.data.available_until as string).getTime() > Date.now();

  const invitedIds = new Set(
    ((invitations.data ?? []) as { campaign_id: string }[]).map((row) => row.campaign_id),
  );

  for (const campaign of campaigns) {
    const match = matchCreatorToCampaign(
      {
        area: campaign.area,
        category: campaign.category,
        cashReward: campaign.cashReward,
        kind: campaign.kind,
      },
      { ...me, standbyActive },
    );
    result.set(campaign.id, { ...match, invited: invitedIds.has(campaign.id) });
  }

  return result;
}
