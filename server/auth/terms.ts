import type { SupabaseClient } from "@supabase/supabase-js";
import { TERMS_VERSION } from "@/lib/legal";

/** Whether the user has agreed to the current 利用規約・プライバシーポリシー. */
export async function hasAcceptedCurrentTerms(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("terms_version")
    .eq("user_id", userId)
    .eq("terms_version", TERMS_VERSION)
    .maybeSingle();

  // Fail closed: an unreadable answer sends the user to the consent page.
  return !error && Boolean(data);
}
