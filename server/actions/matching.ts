"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { autoInviteCandidates, type MatchCampaign } from "@/lib/matching";
import { createClient } from "@/lib/supabase/server";
import { loadAllMatchCreators } from "@/server/queries/matching";

export async function inviteCreator(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!campaignId || !creatorId) return;

  const path = `/restaurant/campaigns/${campaignId}/applications`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_creators_to_campaign", {
    p_campaign_id: campaignId,
    p_creator_ids: [creatorId],
    p_source: "restaurant",
  });

  const message = error
    ? (error.message ?? "").includes("campaign_not_inviting")
      ? "募集中の公開案件だけ招待できます。"
      : "招待できませんでした。"
    : data
      ? "招待を送りました。Creatorに通知が届きます。"
      : "このCreatorはすでに招待済みか応募済みです。";

  revalidatePath(path);
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

/**
 * Called right after a public campaign is created: notify the best-matched
 * Creators so the Restaurant does not have to search. Never blocks or fails
 * the campaign creation itself.
 */
export async function autoInviteMatches(campaignId: string, campaign: MatchCampaign) {
  try {
    const creators = await loadAllMatchCreators();
    const candidates = autoInviteCandidates(campaign, creators, 10, 50);
    if (!candidates.length) return 0;

    const supabase = await createClient();
    const { data } = await supabase.rpc("invite_creators_to_campaign", {
      p_campaign_id: campaignId,
      p_creator_ids: candidates.map(({ creator }) => creator.id),
      p_source: "auto",
    });
    return (data as number | null) ?? 0;
  } catch {
    return 0;
  }
}
