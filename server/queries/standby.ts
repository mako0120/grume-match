import { createClient } from "@/lib/supabase/server";

export async function getCreatorStandbyStatus() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return null;

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id,display_name,base_area,min_reward")
    .eq("user_id", authData.user.id)
    .single();

  if (!profile) return null;

  const { data: standby } = await supabase
    .from("creator_standby")
    .select("enabled,available_until,updated_at")
    .eq("creator_id", profile.id)
    .maybeSingle();

  const active =
    standby?.enabled === true &&
    standby.available_until &&
    new Date(standby.available_until).getTime() > Date.now();

  return {
    creatorId: profile.id,
    displayName: profile.display_name,
    baseArea: profile.base_area,
    minReward: profile.min_reward,
    active: Boolean(active),
    availableUntil: active ? standby?.available_until ?? null : null,
  };
}

export async function listActiveStandbyCreators() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_standby_creators");

  if (error) throw new Error(error.message);

  return (data ?? []) as Array<{
    creator_id: string;
    display_name: string;
    base_area: string;
    min_reward: number;
    followers: number;
  }>;
}
