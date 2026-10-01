"use server";

import { redirect } from "next/navigation";
import { buildFlashTiming } from "@/lib/flash-timing";
import { createClient } from "@/lib/supabase/server";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function createFlashCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,restaurants(name,area)")
    .eq("user_id", authData.user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const restaurant = one(membership.restaurants);
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const cashReward = Number(formData.get("cashReward") ?? 0);
  const foodOffer = String(formData.get("foodOffer") ?? "1名分提供").trim();
  const maxCompanions = Number(formData.get("maxCompanions") ?? 0);
  const creatorSlots = Number(formData.get("creatorSlots") ?? 1);
  const durationMinutes = Number(formData.get("durationMinutes") ?? 120);
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);

  if (!category || cashReward <= 0 || creatorSlots <= 0 || !platforms.length) {
    redirect(
      "/restaurant/flash/new?message=" +
        encodeURIComponent("報酬・ジャンル・投稿先を確認してください。"),
    );
  }

  let timing;
  try {
    timing = buildFlashTiming(String(formData.get("startsAt") ?? ""));
  } catch {
    redirect(
      "/restaurant/flash/new?message=" +
        encodeURIComponent("来店日時は現在から1時間以上先を選択してください。"),
    );
  }

  const restaurantName = restaurant?.name ?? "店舗";
  const area = restaurant?.area ?? "大阪";
  const title = restaurantName + " " + category + " FLASH";

  const { data, error } = await supabase.rpc("create_flash_campaign", {
    p_restaurant_id: membership.restaurant_id,
    p_title: title,
    p_description: description,
    p_category: category,
    p_area: area,
    p_cash_reward: cashReward,
    p_food_offer: foodOffer,
    p_max_companions: maxCompanions,
    p_creator_slots: creatorSlots,
    p_starts_at: timing.startsAtIso,
    p_visit_duration_minutes: durationMinutes,
    p_application_deadline: timing.deadlineIso,
    p_platforms: platforms,
  });

  if (error || !data) {
    redirect(
      "/restaurant/flash/new?message=" +
        encodeURIComponent("FLASH案件を公開できませんでした。"),
    );
  }

  redirect("/restaurant/campaigns/" + data + "/applications");
}
