import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type RestaurantInvite = {
  token: string;
  campaignId: string;
  handle: string;
  claimedBy: string | null;
  claimedAt: string | null;
  createdAt: string;
  cashReward: number;
  campaignStatus: string;
  restaurantName: string;
};

/** Invites created by the signed-in Restaurant, newest first. */
export async function getRestaurantInvites(): Promise<RestaurantInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_invites")
    .select(
      "token,campaign_id,instagram_handle,claimed_at,created_at,creator_profiles(display_name),campaigns(cash_reward,status),restaurants(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as {
    token: string;
    campaign_id: string;
    instagram_handle: string;
    claimed_at: string | null;
    created_at: string;
    creator_profiles: Relation<{ display_name: string }>;
    campaigns: Relation<{ cash_reward: number; status: string }>;
    restaurants: Relation<{ name: string }>;
  }[]).map((row) => ({
    token: row.token,
    campaignId: row.campaign_id,
    handle: row.instagram_handle,
    claimedBy: single(row.creator_profiles)?.display_name ?? null,
    claimedAt: row.claimed_at,
    createdAt: row.created_at,
    cashReward: single(row.campaigns)?.cash_reward ?? 0,
    campaignStatus: single(row.campaigns)?.status ?? "",
    restaurantName: single(row.restaurants)?.name ?? "店舗",
  }));
}

export type InvitePreview = {
  restaurantName: string;
  area: string;
  category: string;
  title: string;
  description: string;
  cashReward: number;
  foodOffer: string;
  maxCompanions: number;
  visitPeriodStart: string;
  visitPeriodEnd: string;
  applicationDeadline: string;
  platforms: string[];
  handle: string;
  claimed: boolean;
  claimedByMe: boolean;
  open: boolean;
  campaignId: string | null;
};

export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_offer_invite", { p_token: token }).maybeSingle();
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    restaurantName: String(row.restaurant_name),
    area: String(row.area),
    category: String(row.category),
    title: String(row.title),
    description: String(row.description ?? ""),
    cashReward: Number(row.cash_reward),
    foodOffer: String(row.food_offer),
    maxCompanions: Number(row.max_companions),
    visitPeriodStart: String(row.visit_period_start),
    visitPeriodEnd: String(row.visit_period_end),
    applicationDeadline: String(row.application_deadline),
    platforms: (row.platforms as string[]) ?? [],
    handle: String(row.instagram_handle),
    claimed: Boolean(row.claimed),
    claimedByMe: Boolean(row.claimed_by_me),
    open: Boolean(row.open),
    campaignId: (row.campaign_id as string | null) ?? null,
  };
}
