import { createClient } from "@/lib/supabase/server";

type SocialAccount = {
  platform: string;
  handle: string;
  followers: number;
  avg_views: number | null;
  local_audience_ratio: number | null;
};

export async function listCreatorsForDirectOffer(search = "") {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator_profiles")
    .select(`
      id,
      display_name,
      bio,
      base_area,
      min_reward,
      reliability_score,
      creator_social_accounts(
        platform,
        handle,
        followers,
        avg_views,
        local_audience_ratio
      )
    `)
    .order("display_name", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);

  const normalizedSearch = search.trim().toLocaleLowerCase("ja");

  return (data ?? []).map((creator) => {
    const accounts = (creator.creator_social_accounts ?? []) as SocialAccount[];
    const instagram = accounts.find((account) => account.platform === "instagram");

    return {
      id: creator.id,
      displayName: creator.display_name,
      bio: creator.bio,
      baseArea: creator.base_area,
      minReward: creator.min_reward,
      reliabilityScore: creator.reliability_score,
      instagramHandle: instagram?.handle ?? null,
      followers: instagram?.followers ?? 0,
      avgViews: instagram?.avg_views ?? null,
      localAudienceRatio: instagram?.local_audience_ratio ?? null,
    };
  }).filter((creator) => {
    if (!normalizedSearch) return true;

    return [
      creator.displayName,
      creator.baseArea,
      creator.instagramHandle ?? "",
    ].some((value) =>
      String(value).toLocaleLowerCase("ja").includes(normalizedSearch),
    );
  });
}
