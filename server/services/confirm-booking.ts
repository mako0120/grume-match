import { createClient } from "@/lib/supabase/server";

export async function confirmBooking(
  applicationId: string,
  campaignSlotId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("confirm_booking", {
    p_application_id: applicationId,
    p_campaign_slot_id: campaignSlotId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
