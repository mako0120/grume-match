import { createClient } from "@/lib/supabase/server";
import type { DemoCampaign, CampaignSlot, Platform } from "@/lib/domain/types";
import { formatRating } from "@/lib/pr-feedback";
import { getRestaurantReviewSummaries } from "@/server/queries/pr-feedback";

type RawRestaurant = { name: string };
type RawPlatform = { platform: Platform };
type RawUsageRights = {
  usage_scope: "organic" | "organic_and_ads";
  duration_days: number;
  fee: number;
};
type RawSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  reserved_count: number;
  status: "open" | "full" | "closed";
};

type RawCampaign = {
  id: string;
  restaurant_id: string;
  title: string;
  area: string;
  category: string;
  cash_reward: number;
  food_offer: string;
  max_companions: number;
  creator_slots: number;
  visibility: "public" | "direct";
  flash_expires_at: string | null;
  visit_period_start: string;
  visit_period_end: string;
  restaurants: RawRestaurant | RawRestaurant[] | null;
  campaign_platforms: RawPlatform[] | null;
  campaign_slots: RawSlot[] | null;
  campaign_usage_rights: RawUsageRights | RawUsageRights[] | null;
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

function restaurantName(value: RawCampaign["restaurants"]) {
  if (Array.isArray(value)) return value[0]?.name ?? "店舗";
  return value?.name ?? "店舗";
}

function visitPeriod(start: string, end: string) {
  const short = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}/${Number(day)}`;
  };
  return `${short(start)}〜${short(end)}`;
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

function presentCampaign(row: RawCampaign): DemoCampaign {
  const usageRights = Array.isArray(row.campaign_usage_rights)
    ? row.campaign_usage_rights[0] ?? null
    : row.campaign_usage_rights;

  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: restaurantName(row.restaurants),
    title: row.title,
    area: row.area,
    category: row.category,
    cashReward: row.cash_reward,
    foodOffer: row.food_offer,
    maxCompanions: row.max_companions,
    creatorSlots: row.creator_slots,
    visibility: row.visibility,
    platforms: (row.campaign_platforms ?? []).map((item) => item.platform),
    usageRights: usageRights
      ? {
          usageScope: usageRights.usage_scope,
          durationDays: usageRights.duration_days,
          fee: usageRights.fee,
        }
      : null,
    visitPeriod: visitPeriod(row.visit_period_start, row.visit_period_end),
    slots: (row.campaign_slots ?? [])
      .map(presentSlot)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  };
}

const campaignSelect = `
  id,
  restaurant_id,
  title,
  area,
  category,
  cash_reward,
  food_offer,
  max_companions,
  creator_slots,
  visibility,
  flash_expires_at,
  visit_period_start,
  visit_period_end,
  restaurants(name),
  campaign_platforms(platform),
  campaign_slots(id,starts_at,ends_at,capacity,reserved_count,status),
  campaign_usage_rights(usage_scope,duration_days,fee)
`;

/** Adds how other Creators rated each Restaurant (revealed reviews only). */
async function withRestaurantRatings(campaigns: DemoCampaign[]) {
  const summaries = await getRestaurantReviewSummaries(
    campaigns.map((campaign) => campaign.restaurantId ?? "").filter(Boolean),
  );
  return campaigns.map((campaign) => {
    const summary = campaign.restaurantId ? summaries.get(campaign.restaurantId) : undefined;
    return { ...campaign, restaurantRating: summary ? formatRating(summary) : null };
  });
}

export async function listCreatorCampaigns(
  kind: "market" | "flash" = "market",
  visibility: "public" | "direct" = "public",
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .in("status", ["published", "recruiting"])
    .eq("kind", kind)
    .eq("visibility", visibility)
    .gt("application_deadline", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as RawCampaign[];

  const presented = rows.map(presentCampaign).filter((campaign) =>
    campaign.slots.some((slot) => slot.isOpen),
  );

  if (kind === "flash") {
    const now = Date.now();
    const visibleIds = new Set(
      rows
        .filter(
          (row) =>
            !row.flash_expires_at ||
            new Date(row.flash_expires_at).getTime() > now,
        )
        .map((row) => row.id),
    );

    return withRestaurantRatings(presented.filter((campaign) => visibleIds.has(campaign.id)));
  }

  return withRestaurantRatings(presented);
}

export async function getCreatorCampaign(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .eq("id", id)
    .in("status", ["published", "recruiting"])
    .gt("application_deadline", new Date().toISOString())
    .single();

  if (error || !data) return null;

  const campaign = presentCampaign(data as unknown as RawCampaign);
  if (!campaign.slots.some((slot) => slot.isOpen)) return null;
  const [rated] = await withRestaurantRatings([campaign]);
  return rated;
}
