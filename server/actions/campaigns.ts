"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildCampaignSlots } from "@/lib/campaign-slot-builder";
import { japanLocalDateTimeToIso } from "@/lib/japan-datetime";
import { createClient } from "@/lib/supabase/server";

function toInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function createCampaign(formData: FormData) {
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
    redirect(
      "/onboarding?message=" +
        encodeURIComponent("先に店舗情報を登録してください。"),
    );
  }

  const restaurant = one(membership.restaurants);
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const cashReward = toInt(formData.get("cashReward"), 0);
  const foodOffer = String(formData.get("foodOffer") ?? "1名分提供").trim();
  const maxCompanions = toInt(formData.get("maxCompanions"), 0);
  const creatorSlots = toInt(formData.get("creatorSlots"), 3);
  const visitStart = String(formData.get("visitStart") ?? "");
  const visitEnd = String(formData.get("visitEnd") ?? "");
  const startTime = String(formData.get("startTime") ?? "17:00");
  const endTime = String(formData.get("endTime") ?? "21:00");
  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter(Boolean);

  if (!category || cashReward <= 0 || creatorSlots <= 0 || !platforms.length) {
    redirect(
      "/restaurant/campaigns/new?message=" +
        encodeURIComponent("ジャンル・報酬・募集人数・投稿先を確認してください。"),
    );
  }

  let slots;
  try {
    slots = buildCampaignSlots({
      startDate: visitStart,
      endDate: visitEnd,
      weekdays,
      startTime,
      endTime,
      intervalMinutes: 30,
      visitDurationMinutes: 120,
      capacity: 1,
    });
  } catch {
    redirect(
      "/restaurant/campaigns/new?message=" +
        encodeURIComponent("来店日時の設定を確認してください。"),
    );
  }

  if (!slots.length) {
    redirect(
      "/restaurant/campaigns/new?message=" +
        encodeURIComponent("選択条件に一致する来店枠がありません。"),
    );
  }

  let deadlineIso: string;
  try {
    deadlineIso = japanLocalDateTimeToIso(visitEnd + "T23:59");
  } catch {
    redirect(
      "/restaurant/campaigns/new?message=" +
        encodeURIComponent("来店期間を確認してください。"),
    );
  }

  const restaurantName = restaurant?.name ?? "店舗";
  const area = restaurant?.area ?? "大阪";
  const title = restaurantName + " " + category + " PR募集";

  const { data, error } = await supabase.rpc("create_campaign_with_slots", {
    p_restaurant_id: membership.restaurant_id,
    p_title: title,
    p_description: description,
    p_category: category,
    p_area: area,
    p_cash_reward: cashReward,
    p_reward_tax_mode: "tax_included",
    p_food_offer: foodOffer,
    p_max_companions: maxCompanions,
    p_creator_slots: creatorSlots,
    p_visit_period_start: visitStart,
    p_visit_period_end: visitEnd,
    p_application_deadline: deadlineIso,
    p_platforms: platforms,
    p_slots: slots,
  });

  if (error || !data) {
    redirect(
      "/restaurant/campaigns/new?message=" +
        encodeURIComponent("案件を公開できませんでした。入力内容をご確認ください。"),
    );
  }

  redirect("/restaurant/campaigns/" + data + "/applications");
}


export async function closeCampaignRecruitment(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_campaign_recruitment", {
    p_campaign_id: campaignId,
  });

  if (error) {
    const reason = error.message ?? "";
    const message = reason.includes("campaign_not_recruiting")
      ? "この案件はすでに募集終了しています。"
      : "募集を終了できませんでした。";

    redirect(
      "/restaurant?status=error&message=" +
        encodeURIComponent(message),
    );
  }

  revalidatePath("/restaurant");
  revalidatePath("/creator/campaigns");
  revalidatePath("/creator/offers");
  revalidatePath("/creator/flash");

  redirect(
    "/restaurant?status=ok&message=" +
      encodeURIComponent("新規応募の受付を終了しました。確定済みの来店はそのままです。"),
  );
}
