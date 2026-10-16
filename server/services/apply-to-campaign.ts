import { createClient } from "@/lib/supabase/server";

export type FlexibleAvailabilityInput = {
  dateLocal: string;
  afterLocal: string;
};

export type ApplyToCampaignInput = {
  campaignId: string;
  partySize: number;
  exactSlotIds: string[];
  flexibleChoices: FlexibleAvailabilityInput[];
};

export async function applyToCampaign(input: ApplyToCampaignInput) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("apply_to_campaign", {
    p_campaign_id: input.campaignId,
    p_party_size: input.partySize,
    p_exact_slot_ids: input.exactSlotIds,
    p_flexible_choices: input.flexibleChoices.map((choice) => ({
      date_local: choice.dateLocal,
      after_local: choice.afterLocal,
    })),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
