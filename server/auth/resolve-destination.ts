import { CURRENT_POLICY_VERSION, REQUIRED_POLICIES } from "@/lib/policies";
import { createClient } from "@/lib/supabase/server";

export type AccountDestination =
  | "/legal/accept"
  | "/onboarding"
  | "/creator/campaigns"
  | "/restaurant"
  | "/admin";

export async function resolveSignedInDestination(): Promise<AccountDestination> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return "/onboarding";

  const [{ data: userRow }, { data: acceptedRows }] = await Promise.all([
    supabase
      .from("users")
      .select("role,status,onboarding_completed_at")
      .eq("id", authData.user.id)
      .single(),
    supabase
      .from("user_policy_acceptances")
      .select("policy")
      .eq("user_id", authData.user.id)
      .eq("version", CURRENT_POLICY_VERSION),
  ]);

  const accepted = new Set((acceptedRows ?? []).map((row) => row.policy));
  const policiesReady = REQUIRED_POLICIES.every((policy) => accepted.has(policy));

  if (!policiesReady) return "/legal/accept";

  if (!userRow || userRow.status !== "active" || !userRow.onboarding_completed_at) {
    return "/onboarding";
  }

  if (userRow.role === "admin") return "/admin";
  if (userRow.role === "restaurant") return "/restaurant";
  return "/creator/campaigns";
}
