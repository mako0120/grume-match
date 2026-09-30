import { createClient } from "@/lib/supabase/server";

export async function getRestaurantDashboard() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,restaurants(name,area)")
    .eq("user_id", authData.user.id)
    .limit(1)
    .single();

  if (membershipError || !membership) return null;

  const restaurantId = membership.restaurant_id;
  const now = new Date().toISOString();

  const [
    campaignsResult,
    applicationsResult,
    bookingsResult,
    deliverablesResult,
    reschedulesResult,
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,title,status,cash_reward,creator_slots,published_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("applications")
      .select("id,status,campaign_id,campaigns!inner(restaurant_id)")
      .eq("campaigns.restaurant_id", restaurantId)
      .in("status", ["applied", "shortlisted"]),
    supabase
      .from("bookings")
      .select("id,status,campaign_id,campaign_slots!inner(starts_at),campaigns!inner(restaurant_id,title)")
      .eq("campaigns.restaurant_id", restaurantId)
      .gte("campaign_slots.starts_at", now)
      .in("status", ["confirmed", "reschedule_requested"])
      .order("campaign_slots(starts_at)", { ascending: true })
      .limit(10),
    supabase
      .from("deliverables")
      .select("id,verification_status,submitted_url,bookings!inner(campaigns!inner(restaurant_id))")
      .eq("bookings.campaigns.restaurant_id", restaurantId)
      .not("submitted_url", "is", null)
      .eq("verification_status", "pending"),
    supabase
      .from("booking_reschedule_requests")
      .select("id,status,bookings!inner(campaigns!inner(restaurant_id))")
      .eq("bookings.campaigns.restaurant_id", restaurantId)
      .eq("status", "pending"),
  ]);

  const campaigns = campaignsResult.data ?? [];

  return {
    restaurant: membership.restaurants,
    campaigns,
    counts: {
      recruiting: campaigns.filter((item) =>
        ["published", "recruiting"].includes(item.status),
      ).length,
      applications: applicationsResult.data?.length ?? 0,
      upcoming: bookingsResult.data?.length ?? 0,
      deliverables: deliverablesResult.data?.length ?? 0,
      reschedules: reschedulesResult.data?.length ?? 0,
    },
    upcomingBookings: bookingsResult.data ?? [],
  };
}
