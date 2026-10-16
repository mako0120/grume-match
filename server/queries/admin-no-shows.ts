import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

const formatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function listUnreviewedNoShows() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      status,
      no_show_at,
      cancellation_reason,
      creator_profiles(display_name),
      campaigns(
        title,
        restaurants(name)
      )
    `)
    .eq("status", "no_show")
    .is("no_show_reviewed_at", null)
    .order("no_show_at", { ascending: true });

  if (error) throw new Error("来店例外を読み込めませんでした。");

  return (data ?? []).map((row) => {
    const creator = one(row.creator_profiles);
    const campaign = one(row.campaigns);
    const restaurant = one(campaign?.restaurants ?? null);

    return {
      id: row.id,
      creatorName: creator?.display_name ?? "Creator",
      restaurantName: restaurant?.name ?? "店舗",
      campaignTitle: campaign?.title ?? "PR案件",
      reason: row.cancellation_reason ?? "",
      noShowLabel: row.no_show_at
        ? formatter.format(new Date(row.no_show_at))
        : "時刻不明",
    };
  });
}
