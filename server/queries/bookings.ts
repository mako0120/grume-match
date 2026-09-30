import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

type RawBooking = {
  id: string;
  party_size: number;
  status: string;
  confirmed_at: string;
  campaign_slots: Relation<{
    starts_at: string;
    ends_at: string;
  }>;
  campaigns: Relation<{
    id: string;
    title: string;
    cash_reward: number;
    food_offer: string;
    restaurants: Relation<{ name: string; address: string }>;
  }>;
  deliverables: {
    id: string;
    platform: string;
    due_at: string;
    submitted_url: string | null;
    submitted_at: string | null;
    verification_status: string;
    verification_note: string | null;
  }[] | null;
  payments: Relation<{
    amount: number;
    currency: string;
    status: string;
    due_at: string | null;
    paid_at: string | null;
  }>;
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

export async function getCreatorBooking(bookingId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      party_size,
      status,
      confirmed_at,
      campaign_slots(starts_at,ends_at),
      campaigns(
        id,
        title,
        cash_reward,
        food_offer,
        restaurants(name,address)
      ),
      deliverables(
        id,
        platform,
        due_at,
        submitted_url,
        submitted_at,
        verification_status,
        verification_note
      ),
      payments(amount,currency,status,due_at,paid_at)
    `)
    .eq("id", bookingId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RawBooking;
  const campaign = single(row.campaigns);
  const restaurant = single(campaign?.restaurants ?? null);
  const slot = single(row.campaign_slots);
  const payment = single(row.payments);

  return {
    id: row.id,
    partySize: row.party_size,
    status: row.status,
    campaignId: campaign?.id ?? "",
    campaignTitle: campaign?.title ?? "PR案件",
    restaurantName: restaurant?.name ?? "店舗",
    restaurantAddress: restaurant?.address ?? "",
    foodOffer: campaign?.food_offer ?? "",
    visitLabel: slot ? visitFormatter.format(new Date(slot.starts_at)) : "",
    deliverables: row.deliverables ?? [],
    payment: payment
      ? {
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          dueAt: payment.due_at,
          paidAt: payment.paid_at,
        }
      : null,
  };
}

export async function listCreatorBookings() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      party_size,
      status,
      confirmed_at,
      campaign_slots(starts_at,ends_at),
      campaigns(
        id,
        title,
        cash_reward,
        food_offer,
        restaurants(name,address)
      ),
      deliverables(
        id,
        platform,
        due_at,
        submitted_url,
        submitted_at,
        verification_status,
        verification_note
      ),
      payments(amount,currency,status,due_at,paid_at)
    `)
    .order("confirmed_at", { ascending: false });

  if (error) throw new Error(error.message);

  return await Promise.all(
    ((data ?? []) as unknown as RawBooking[]).map(async (row) => {
      const campaign = single(row.campaigns);
      const restaurant = single(campaign?.restaurants ?? null);
      const slot = single(row.campaign_slots);
      const payment = single(row.payments);

      return {
        id: row.id,
        status: row.status,
        campaignTitle: campaign?.title ?? "PR案件",
        restaurantName: restaurant?.name ?? "店舗",
        visitLabel: slot ? visitFormatter.format(new Date(slot.starts_at)) : "",
        paymentAmount: payment?.amount ?? campaign?.cash_reward ?? 0,
        paymentStatus: payment?.status ?? "pending",
      };
    }),
  );
}
