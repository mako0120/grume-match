import { platformFee } from "@/lib/pricing";
import { summarizeSignal, type SignalSummaryRow } from "@/lib/signal-metrics";
import { getFeesByBooking } from "@/server/queries/billing";
import { createClient } from "@/lib/supabase/server";

export const signalPeriods = {
  "30": { label: "30日", days: 30 },
  "90": { label: "90日", days: 90 },
  all: { label: "全期間", days: null },
} as const;

export type SignalPeriod = keyof typeof signalPeriods;

export function parseSignalPeriod(value: string | undefined): SignalPeriod {
  return value === "30" || value === "all" ? value : "90";
}

type Relation<T> = T | T[] | null;

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

type RawConversion = {
  id: string;
  occurred_at: string;
  party_size: number | null;
  revenue_yen: number | null;
  tracking_links: Relation<{
    code: string;
    restaurant_id: string;
    creator_profiles: Relation<{ display_name: string }>;
  }>;
};

export async function getRestaurantSignal(period: SignalPeriod) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const restaurantId = membership.restaurant_id as string;
  const days = signalPeriods[period].days;
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const [summaryResult, conversionsResult] = await Promise.all([
    supabase.rpc("restaurant_signal_summary", { p_since: since }),
    supabase
      .from("signal_events")
      .select(
        "id,occurred_at,party_size,revenue_yen,tracking_links!inner(code,restaurant_id,creator_profiles(display_name))",
      )
      .eq("tracking_links.restaurant_id", restaurantId)
      .eq("kind", "visit")
      .is("voided_at", null)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);

  if (summaryResult.error) throw new Error(summaryResult.error.message);
  if (conversionsResult.error) throw new Error(conversionsResult.error.message);

  const rows = ((summaryResult.data ?? []) as (SignalSummaryRow & {
    restaurant_id: string;
  })[]).filter(
    (row) =>
      row.restaurant_id === restaurantId &&
      // In a period view, count a PR when it was visited in the period or
      // produced any signal in it, so that its cost is not silently dropped.
      (!since ||
        row.visit_starts_at >= since ||
        row.landing_views + row.visits > 0),
  );

  // PR cost = Creator payment + platform fee (recorded, or estimated until
  // the PR completes).
  const fees = await getFeesByBooking();
  const withFees = rows.map((row) => ({
    ...row,
    cost_yen: row.cost_yen + (fees.get(row.booking_id) ?? platformFee(row.cost_yen)),
  }));

  return {
    restaurantId,
    ...summarizeSignal(withFees),
    conversions: ((conversionsResult.data ?? []) as unknown as RawConversion[]).map(
      (row) => {
        const link = single(row.tracking_links);
        return {
          id: row.id,
          occurredAt: row.occurred_at,
          partySize: row.party_size,
          revenueYen: row.revenue_yen,
          code: link?.code ?? "",
          creatorName: single(link?.creator_profiles ?? null)?.display_name ?? "Creator",
        };
      },
    ),
  };
}

export async function getCreatorSignal(bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("creator_signal_summary", { p_booking_id: bookingId })
    .maybeSingle();

  if (error || !data) return null;

  return data as {
    code: string;
    landing_views: number;
    visits: number;
  };
}
