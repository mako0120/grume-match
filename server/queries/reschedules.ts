import { createClient } from "@/lib/supabase/server";
import type { CampaignSlot } from "@/lib/domain/types";

type Relation<T> = T | T[] | null;

type RawSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  reserved_count: number;
  status: "open" | "full" | "closed";
};

type RawRequest = {
  id: string;
  booking_id: string;
  requested_by: string;
  requested_slot_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

type RawBooking = {
  id: string;
  campaign_id: string;
  campaign_slot_id: string;
  party_size: number;
  status: string;
  creator_profiles: Relation<{ display_name: string }>;
  campaigns: Relation<{
    title: string;
    restaurant_id: string;
    restaurants: Relation<{ name: string }>;
    campaign_slots: RawSlot[] | null;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function presentSlot(slot: RawSlot): CampaignSlot {
  return {
    id: slot.id,
    dateLabel: dateFormatter.format(new Date(slot.starts_at)),
    startsAt: slot.starts_at,
    timeLabel: timeFormatter.format(new Date(slot.starts_at)),
    remaining: Math.max(0, slot.capacity - slot.reserved_count),
    isOpen:
      slot.status === "open" &&
      slot.reserved_count < slot.capacity &&
      new Date(slot.starts_at).getTime() > Date.now(),
  };
}

export async function getBookingRescheduleOptions(bookingId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      campaign_id,
      campaign_slot_id,
      party_size,
      status,
      creator_profiles(display_name),
      campaigns(
        title,
        restaurant_id,
        restaurants(name),
        campaign_slots(id,starts_at,ends_at,capacity,reserved_count,status)
      )
    `)
    .eq("id", bookingId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RawBooking;
  const campaign = single(row.campaigns);
  const restaurant = single(campaign?.restaurants ?? null);
  const creator = single(row.creator_profiles);
  const currentSlot = (campaign?.campaign_slots ?? []).find(
    (slot) => slot.id === row.campaign_slot_id,
  );
  const canReschedule =
    row.status === "confirmed" &&
    Boolean(currentSlot) &&
    new Date(currentSlot!.starts_at).getTime() > Date.now();

  const { data: pending } = await supabase
    .from("booking_reschedule_requests")
    .select("id,booking_id,requested_by,requested_slot_id,status,requested_at,reviewed_at,review_note")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .maybeSingle();

  return {
    bookingId: row.id,
    campaignId: row.campaign_id,
    currentSlotId: row.campaign_slot_id,
    status: row.status,
    creatorName: creator?.display_name ?? "Creator",
    campaignTitle: campaign?.title ?? "PR案件",
    restaurantName: restaurant?.name ?? "店舗",
    canReschedule,
    slots: canReschedule
      ? (campaign?.campaign_slots ?? [])
      .map(presentSlot)
          .filter((slot) => slot.id !== row.campaign_slot_id && slot.isOpen)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      : [],
    pendingRequest: (pending as RawRequest | null) ?? null,
  };
}

export async function listRestaurantPendingReschedules() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_reschedule_requests")
    .select(`
      id,
      booking_id,
      requested_by,
      requested_slot_id,
      status,
      requested_at,
      review_note,
      bookings(
        id,
        campaign_id,
        creator_profiles(display_name),
        campaigns(
          title,
          restaurants(name)
        ),
        campaign_slots(id,starts_at)
      ),
      campaign_slots!booking_reschedule_requests_requested_slot_id_fkey(id,starts_at)
    `)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}
