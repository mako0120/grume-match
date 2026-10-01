import { createClient } from "@/lib/supabase/server";
import type { CampaignSlot } from "@/lib/domain/types";

type RawSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  reserved_count: number;
  status: "open" | "full" | "closed";
};

type RawSocial = {
  platform: string;
  followers: number;
};

type RawCreator = {
  display_name: string;
  creator_social_accounts: RawSocial[] | null;
};

type RawAvailability = {
  kind: "exact_slot" | "flexible_after";
  campaign_slot_id: string | null;
  date_local: string | null;
  flexible_after_local: string | null;
};

type RawApplication = {
  id: string;
  party_size: number;
  status: string;
  creator_profiles: RawCreator | RawCreator[] | null;
  application_availabilities: RawAvailability[] | null;
};

type RawRestaurant = { name: string };

type RawCampaign = {
  id: string;
  title: string;
  cash_reward: number;
  restaurants: RawRestaurant | RawRestaurant[] | null;
  campaign_slots: RawSlot[] | null;
  applications: RawApplication[] | null;
};

export type RestaurantApplicationChoice =
  | { kind: "exact"; slotId: string }
  | { kind: "flexible"; dateLocal: string; after: string };

export type RestaurantApplicationView = {
  applicationId: string;
  creatorName: string;
  followerCount: number;
  partySize: number;
  status: string;
  choices: RestaurantApplicationChoice[];
};

export type RestaurantCampaignApplicationsView = {
  campaignId: string;
  restaurantName: string;
  title: string;
  cashReward: number;
  slots: CampaignSlot[];
  applications: RestaurantApplicationView[];
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

function single<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
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

export async function getRestaurantCampaignApplications(
  campaignId: string,
): Promise<RestaurantCampaignApplicationsView | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(`
      id,
      title,
      cash_reward,
      restaurants(name),
      campaign_slots(id,starts_at,ends_at,capacity,reserved_count,status),
      applications(
        id,
        party_size,
        status,
        creator_profiles(
          display_name,
          creator_social_accounts(platform,followers)
        ),
        application_availabilities(
          kind,
          campaign_slot_id,
          date_local,
          flexible_after_local
        )
      )
    `)
    .eq("id", campaignId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RawCampaign;
  const restaurant = single(row.restaurants);

  return {
    campaignId: row.id,
    restaurantName: restaurant?.name ?? "店舗",
    title: row.title,
    cashReward: row.cash_reward,
    slots: (row.campaign_slots ?? [])
      .map(presentSlot)
      .filter((slot) => slot.isOpen)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    applications: (row.applications ?? [])
      .filter((application) =>
        ["applied", "shortlisted", "accepted"].includes(application.status),
      )
      .map((application) => {
      const creator = single(application.creator_profiles);
      const instagram = creator?.creator_social_accounts?.find(
        (account) => account.platform === "instagram",
      );

      return {
        applicationId: application.id,
        creatorName: creator?.display_name ?? "Creator",
        followerCount: instagram?.followers ?? 0,
        partySize: application.party_size,
        status: application.status,
        choices: (application.application_availabilities ?? [])
          .map((choice): RestaurantApplicationChoice | null => {
            if (choice.kind === "exact_slot" && choice.campaign_slot_id) {
              return { kind: "exact", slotId: choice.campaign_slot_id };
            }
            if (
              choice.kind === "flexible_after" &&
              choice.date_local &&
              choice.flexible_after_local
            ) {
              return {
                kind: "flexible",
                dateLocal: choice.date_local,
                after: choice.flexible_after_local.slice(0, 5),
              };
            }
            return null;
          })
          .filter((choice): choice is RestaurantApplicationChoice => choice !== null),
      };
    }),
  };
}
