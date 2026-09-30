import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "creator" | "restaurant" | "admin";

export async function requireRole(allowed: AppRole[]) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const { data: userRow, error } = await supabase
    .from("users")
    .select("role,status,onboarding_completed_at")
    .eq("id", authData.user.id)
    .single();

  if (error || !userRow || userRow.status !== "active") {
    redirect("/login");
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
