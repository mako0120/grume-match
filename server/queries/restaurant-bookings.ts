import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type RawBooking = {
  id: string;
  party_size: number;
  status: string;
  campaign_slots: Relation<{ starts_at: string }>;
  campaigns: Relation<{ title: string }>;
  creator_profiles: Relation<{ display_name: string }>;
};

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const visitFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function listRestaurantUpcomingBookings() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      party_size,
      status,
      campaign_slots!inner(starts_at),
      campaigns(title),
      creator_profiles(display_name)
    `)
    .in("status", ["confirmed", "reschedule_requested"])
    .gte("campaign_slots.starts_at", now)
    .limit(100);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawBooking[])
    .map((row) => {
      const slot = one(row.campaign_slots);
      const campaign = one(row.campaigns);
      const creator = one(row.creator_profiles);

      return {
        id: row.id,
        partySize: row.party_size,
        status: row.status,
        startsAt: slot?.starts_at ?? "",
        visitLabel: slot ? visitFormatter.format(new Date(slot.starts_at)) : "",
        campaignTitle: campaign?.title ?? "PR案件",
        creatorName: creator?.display_name ?? "Creator",
      };
    })
    .filter((row) => row.startsAt)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}