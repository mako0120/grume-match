import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type RawBooking = {
  id: string;
  party_size: number;
  status: string;
  campaign_slots: Relation<{ starts_at: string; ends_at: string }>;
  campaigns: Relation<{
    id: string;
    title: string;
    cash_reward: number;
    restaurants: Relation<{ name: string }>;
  }>;
  creator_profiles: Relation<{
    display_name: string;
    creator_social_accounts: { platform: string; followers: number }[] | null;
  }>;
  deliverables: {
    id: string;
    platform: string;
    submitted_url: string | null;
    submitted_at: string | null;
    verification_status: string;
    verification_note: string | null;
  }[] | null;
  payments: Relation<{ amount: number; status: string }>;
};

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const visitFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function getRestaurantBooking(bookingId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      party_size,
      status,
      campaign_slots(starts_at,ends_at),
      campaigns(
        id,
        title,
        cash_reward,
        restaurants(name)
      ),
      creator_profiles(
        display_name,
        creator_social_accounts(platform,followers)
      ),
      deliverables(
        id,
        platform,
        submitted_url,
        submitted_at,
        verification_status,
        verification_note
      ),
      payments(amount,status)
    `)
    .eq("id", bookingId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RawBooking;
  const campaign = single(row.campaigns);
  const restaurant = single(campaign?.restaurants ?? null);
  const creator = single(row.creator_profiles);
  const slot = single(row.campaign_slots);
  const payment = single(row.payments);
  const instagram = creator?.creator_social_accounts?.find(
    (account) => account.platform === "instagram",
  );

  return {
    id: row.id,
    partySize: row.party_size,
    status: row.status,
    campaignTitle: campaign?.title ?? "PR案件",
    restaurantName: restaurant?.name ?? "店舗",
    creatorName: creator?.display_name ?? "Creator",
    followerCount: instagram?.followers ?? 0,
    visitLabel: slot ? visitFormatter.format(new Date(slot.starts_at)) : "",
    cashReward: payment?.amount ?? campaign?.cash_reward ?? 0,
    paymentStatus: payment?.status ?? "pending",
    deliverables: row.deliverables ?? [],
  };
}
