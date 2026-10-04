import { isCalendarExportable, type BookingCalendarEvent } from "@/lib/calendar-export";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type RawBooking = {
  id: string;
  party_size: number;
  status: string;
  campaign_slots: Relation<{ starts_at: string; ends_at: string }>;
  campaigns: Relation<{
    title: string;
    restaurants: Relation<{ name: string; address: string }>;
  }>;
  creator_profiles: Relation<{ user_id: string; display_name: string }>;
};

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BookingCalendarResult =
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "ok"; event: BookingCalendarEvent };

/**
 * Calendar event for one booking, read with the viewer's own session so the
 * "booking parties can read" RLS policy decides access. Rewards, fees and
 * payment state are left out: calendars are often shared or synced elsewhere.
 */
export async function getBookingCalendarEvent(
  bookingId: string,
  origin: string,
): Promise<BookingCalendarResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) return { kind: "unauthenticated" };
  if (!uuidPattern.test(bookingId)) return { kind: "not_found" };

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      party_size,
      status,
      campaign_slots(starts_at,ends_at),
      campaigns(
        title,
        restaurants(name,address)
      ),
      creator_profiles(user_id,display_name)
    `)
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) return { kind: "not_found" };

  const row = data as unknown as RawBooking;
  const slot = single(row.campaign_slots);
  if (!slot || !isCalendarExportable(row.status)) return { kind: "not_found" };

  const campaign = single(row.campaigns);
  const restaurant = single(campaign?.restaurants ?? null);
  const creator = single(row.creator_profiles);
  const viewerIsCreator = creator?.user_id === userId;
  const restaurantName = restaurant?.name ?? "店舗";
  const creatorName = creator?.display_name ?? "Creator";
  const path = viewerIsCreator
    ? `/creator/bookings/${row.id}`
    : `/restaurant/bookings/${row.id}`;
  const url = origin ? `${origin}${path}` : "";

  return {
    kind: "ok",
    event: {
      bookingId: row.id,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      summary: viewerIsCreator
        ? `PR来店: ${restaurantName}`
        : `PR来店: ${creatorName}さん`,
      location: restaurant?.address
        ? `${restaurantName} ${restaurant.address}`
        : restaurantName,
      description: [
        campaign?.title ?? "PR案件",
        viewerIsCreator ? `店舗: ${restaurantName}` : `Creator: ${creatorName}`,
        `来店人数: ${row.party_size}名`,
        row.status === "reschedule_requested" ? "※日時変更を申請中です" : null,
        url ? `詳細: ${url}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
      url,
    },
  };
}
