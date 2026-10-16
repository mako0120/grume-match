import { createClient } from "@/lib/supabase/server";

export async function listUnverifiedParticipants() {
  const supabase = await createClient();

  const [creatorsResult, restaurantsResult] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select(`
        id,
        user_id,
        display_name,
        base_area,
        created_at,
        users!inner(email,status),
        creator_social_accounts(platform,handle,followers)
      `)
      .is("verified_at", null)
      .eq("users.status", "active")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("restaurants")
      .select(`
        id,
        name,
        address,
        area,
        created_at,
        status,
        restaurant_memberships(
          role,
          users(email,status)
        )
      `)
      .is("verified_at", null)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (creatorsResult.error || restaurantsResult.error) {
    throw new Error("確認待ちアカウントを読み込めませんでした。");
  }

  return {
    creators: creatorsResult.data ?? [],
    restaurants: restaurantsResult.data ?? [],
  };
}
