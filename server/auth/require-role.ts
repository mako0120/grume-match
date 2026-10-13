import { redirect } from "next/navigation";
import { CURRENT_POLICY_VERSION, REQUIRED_POLICIES } from "@/lib/policies";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "creator" | "restaurant" | "admin";

export async function requireRole(allowed: AppRole[]) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const [{ data: userRow, error }, { data: acceptedRows }] = await Promise.all([
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

  if (error || !userRow || userRow.status !== "active") {
    redirect("/login");
  }

  const accepted = new Set((acceptedRows ?? []).map((row) => row.policy));
  if (!REQUIRED_POLICIES.every((policy) => accepted.has(policy))) {
    redirect("/legal/accept");
  }

  if (!userRow.onboarding_completed_at) {
    redirect("/onboarding");
  }

  if (!allowed.includes(userRow.role as AppRole)) {
    redirect("/onboarding");
  }

  return {
    authUser: authData.user,
    role: userRow.role as AppRole,
  };
}
