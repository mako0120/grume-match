"use server";

import { redirect } from "next/navigation";
import { buildDirectOfferSchedule } from "@/lib/direct-offer-schedule";
import { createClient } from "@/lib/supabase/server";
import { readUsageRightsForm } from "@/server/actions/usage-rights-form";

function toInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function createDirectOffer(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,restaurants(name,area)")
    .eq("user_id", authData.user.id)
    .limit(1)
    .single();

  if (membershipError || !membership) {
    redirect("/onboarding");
  }

  const restaurant = one(membership.restaurants);
  const creatorId = String(formData.get("creatorId") ?? "");
  const cashReward = toInt(formData.get("cashReward"), 0);
  const foodOffer = String(formData.get("foodOffer") ?? "1名分提供").trim();
  const maxCompanions = toInt(formData.get("maxCompanions"), 0);
  const note = String(formData.get("note") ?? "").trim();
  const durationMinutes = toInt(formData.get("durationMinutes"), 120);
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);
  const candidateLocalDateTimes = [
    String(formData.get("candidate1") ?? ""),
    String(formData.get("candidate2") ?? ""),
    String(formData.get("candidate3") ?? ""),
  ];

  if (!creatorId) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("依頼するCreatorを1人選択してください。"),
    );
  }

  if (!Number.isInteger(cashReward) || cashReward < 0) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("現金報酬を確認してください（食事招待のみは0円）。"),
    );
  }

  if (!platforms.length) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("投稿先を1つ以上選択してください。"),
    );
  }

  const usage = readUsageRightsForm(formData, platforms);
  if (!usage.ok) {
    redirect("/restaurant/offers/new?message=" + encodeURIComponent(usage.message));
  }

  let schedule;
  try {
    schedule = buildDirectOfferSchedule(candidateLocalDateTimes, durationMinutes);
  } catch {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("来店候補日時を1〜3つ入力してください。"),
    );
  }

  const restaurantName = restaurant?.name ?? "店舗";
  const area = restaurant?.area ?? "大阪";
  const title = restaurantName + " PRご依頼";

  const { data, error } = await supabase.rpc("create_direct_offer_with_slots", {
    p_restaurant_id: membership.restaurant_id,
    p_creator_id: creatorId,
    p_title: title,
    p_description: note,
    p_category: "グルメ",
    p_area: area,
    p_cash_reward: cashReward,
    p_reward_tax_mode: "tax_included",
    p_food_offer: foodOffer,
    p_max_companions: maxCompanions,
    p_visit_period_start: schedule.visitStart,
    p_visit_period_end: schedule.visitEnd,
    p_application_deadline: schedule.deadlineIso,
    p_platforms: platforms,
    p_slots: schedule.slots,
    p_usage_rights: usage.usageRights,
  });

  if (error || !data) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("指名オファーを送信できませんでした。"),
    );
  }

  redirect("/restaurant/campaigns/" + data + "/applications");
}
