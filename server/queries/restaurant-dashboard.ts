import { platformLabels } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";

export type RestaurantTask = {
  id: string;
  kind: "application" | "reschedule" | "deliverable";
  title: string;
  detail: string;
  href: string;
};

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
      .select("id,status,campaign_id,creator_profiles(display_name),campaigns!inner(restaurant_id,title)")
      .eq("campaigns.restaurant_id", restaurantId)
      .in("status", ["applied", "shortlisted"])
      .order("applied_at", { ascending: true })
      .limit(20),

    supabase
      .from("bookings")
      .select("id,status,campaign_id,creator_profiles(display_name),campaign_slots!inner(starts_at),campaigns!inner(restaurant_id,title)")
      .eq("campaigns.restaurant_id", restaurantId)
      .gte("campaign_slots.starts_at", now)
      .in("status", ["confirmed", "reschedule_requested"])
      .order("campaign_slots(starts_at)", { ascending: true })
      .limit(10),

    supabase
      .from("deliverables")
      .select("id,booking_id,platform,verification_status,submitted_at,bookings!inner(id,creator_profiles(display_name),campaigns!inner(restaurant_id,title))")
      .eq("bookings.campaigns.restaurant_id", restaurantId)
      .not("submitted_at", "is", null)
      .eq("verification_status", "pending")
      .limit(20),

    supabase
      .from("booking_reschedule_requests")
      .select("id,booking_id,status,bookings!inner(id,creator_profiles(display_name),campaigns!inner(restaurant_id,title))")
      .eq("bookings.campaigns.restaurant_id", restaurantId)
      .eq("status", "pending")
      .limit(20),
  ]);

  const dashboardError = [
    campaignsResult.error,
    applicationsResult.error,
    bookingsResult.error,
    deliverablesResult.error,
    reschedulesResult.error,
  ].find(Boolean);

  if (dashboardError) {
    throw new Error("店舗ダッシュボードを読み込めませんでした。");
  }

  const campaigns = campaignsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const upcomingBookings = bookingsResult.data ?? [];
  const deliverables = deliverablesResult.data ?? [];
  const reschedules = reschedulesResult.data ?? [];

  const tasks: RestaurantTask[] = [];

  for (const item of applications) {
    const creator = Array.isArray(item.creator_profiles)
      ? item.creator_profiles[0]
      : item.creator_profiles;
    const campaign = Array.isArray(item.campaigns)
      ? item.campaigns[0]
      : item.campaigns;

    tasks.push({
      id: "application:" + item.id,
      kind: "application",
      title: "応募を確認",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (campaign?.title ?? "PR案件"),
      href: "/restaurant/campaigns/" + item.campaign_id + "/applications",
    });
  }

  for (const item of reschedules) {
    const booking = Array.isArray(item.bookings)
      ? item.bookings[0]
      : item.bookings;
    const creator = Array.isArray(booking?.creator_profiles)
      ? booking.creator_profiles[0]
      : booking?.creator_profiles;

    tasks.push({
      id: "reschedule:" + item.id,
      kind: "reschedule",
      title: "日時変更を確認",
      detail: (creator?.display_name ?? "Creator") + "から変更希望",
      href: "/restaurant/reschedules",
    });
  }

  for (const item of deliverables) {
    const booking = Array.isArray(item.bookings)
      ? item.bookings[0]
      : item.bookings;
    const creator = Array.isArray(booking?.creator_profiles)
      ? booking.creator_profiles[0]
      : booking?.creator_profiles;

    tasks.push({
      id: "deliverable:" + item.id,
      kind: "deliverable",
      title: "投稿を確認",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (platformLabels[item.platform] ?? String(item.platform)),
      href: "/restaurant/bookings/" + item.booking_id,
    });
  }

  return {
    restaurant: membership.restaurants,
    campaigns,
    tasks,
    counts: {
      recruiting: campaigns.filter((item) =>
        ["published", "recruiting"].includes(item.status),
      ).length,
      applications: applications.length,
      upcoming: upcomingBookings.length,
      deliverables: deliverables.length,
      reschedules: reschedules.length,
    },
    upcomingBookings,
  };
}
