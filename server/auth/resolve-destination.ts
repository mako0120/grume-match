import { createClient } from "@/lib/supabase/server";

export type AccountDestination =
  | "/onboarding"
  | "/creator/campaigns"
  | "/restaurant"
  | "/admin";

export async function resolveSignedInDestination(): Promise<AccountDestination> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return "/onboarding";

  const { data: userRow } = await supabase
    .from("users")
    .select("role,status,onboarding_completed_at")
    .eq("id", authData.user.id)
    .single();

  if (!userRow || userRow.status !== "active" || !userRow.onboarding_completed_at) {
    return "/onboarding";
  }

  if (userRow.role === "admin") return "/admin";
  if (userRow.role === "restaurant") return "/restaurant";
  return "/creator/campaigns";
}
