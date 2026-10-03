import { createClient } from "@/lib/supabase/server";
import {
  presentLicense,
  signContentAssets,
  type RawContentAsset,
  type RawUsageLicense,
} from "@/server/queries/ugc-assets";

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
    content_assets?: RawContentAsset[] | null;
  }[] | null;
  content_usage_licenses?: RawUsageLicense | RawUsageLicense[] | null;
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

// Stable order so cards do not jump around after each submission.
function sortDeliverables<T extends { platform: string; id: string }>(items: T[]) {
  return items
    .slice()
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.id.localeCompare(b.id));
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
        verification_note,
        content_assets(id,kind,storage_path,mime_type,byte_size,created_at)
      ),
      content_usage_licenses(usage_scope,duration_days,fee,status,starts_at,expires_at),
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
  const { data: authData } = await supabase.auth.getUser();
  const deliverables = await Promise.all(
    (row.deliverables ?? []).map(async ({ content_assets, ...deliverable }) => ({
      ...deliverable,
      assets: await signContentAssets(supabase, content_assets ?? []),
    })),
  );

  return {
    id: row.id,
    viewerUserId: authData.user?.id ?? "",
    partySize: row.party_size,
    status: row.status,
    campaignId: campaign?.id ?? "",
    campaignTitle: campaign?.title ?? "PR案件",
    restaurantName: restaurant?.name ?? "店舗",
    restaurantAddress: restaurant?.address ?? "",
    foodOffer: campaign?.food_offer ?? "",
    visitLabel: slot ? visitFormatter.format(new Date(slot.starts_at)) : "",
    canReschedule:
      row.status === "confirmed" &&
      Boolean(slot) &&
      new Date(slot!.starts_at).getTime() > Date.now(),
    deliverables: sortDeliverables(deliverables),
    license: presentLicense(row.content_usage_licenses ?? null),
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

  const presented = ((data ?? []) as unknown as RawBooking[]).map((row) => {
    const campaign = single(row.campaigns);
    const restaurant = single(campaign?.restaurants ?? null);
    const slot = single(row.campaign_slots);
    const payment = single(row.payments);

    return {
      id: row.id,
      status: row.status,
      startsAt: slot?.starts_at ?? "",
      campaignTitle: campaign?.title ?? "PR案件",
      restaurantName: restaurant?.name ?? "店舗",
      visitLabel: slot ? visitFormatter.format(new Date(slot.starts_at)) : "",
      paymentAmount: payment?.amount ?? campaign?.cash_reward ?? 0,
      paymentStatus: payment?.status ?? "pending",
    };
  });

  const now = Date.now();

  return presented.sort((a, b) => {
    const aTime = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const bTime = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    const aUpcoming = aTime >= now;
    const bUpcoming = bTime >= now;

    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming) return aTime - bTime;
    return bTime - aTime;
  });
}
