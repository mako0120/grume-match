"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCampaignSlots } from "@/lib/campaign-slot-builder";
import { japanLocalDateTimeToIso } from "@/lib/japan-datetime";

function toInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .single();

  if (membershipError || !membership) {
    redirect("/onboarding?message=" + encodeURIComponent("先に店舗情報を登録してください。"));
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const cashReward = toInt(formData.get("cashReward"), 0);
  const foodOffer = String(formData.get("foodOffer") ?? "").trim();
  const maxCompanions = toInt(formData.get("maxCompanions"), 0);
  const creatorSlots = toInt(formData.get("creatorSlots"), 1);
  const visitStart = String(formData.get("visitStart") ?? "");
  const visitEnd = String(formData.get("visitEnd") ?? "");
  const applicationDeadline = String(formData.get("applicationDeadline") ?? "");
  const startTime = String(formData.get("startTime") ?? "17:00");
  const endTime = String(formData.get("endTime") ?? "21:00");
  const intervalMinutes = toInt(formData.get("intervalMinutes"), 30);
  const visitDurationMinutes = toInt(formData.get("visitDurationMinutes"), 120);
  const slotCapacity = toInt(formData.get("slotCapacity"), 1);
  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter(Boolean);

  let slots;
  try {
    slots = buildCampaignSlots({
      startDate: visitStart,
      endDate: visitEnd,
      weekdays,
      startTime,
      endTime,
      intervalMinutes,
      visitDurationMinutes,
      capacity: slotCapacity,
    });
  } catch {
    redirect("/restaurant/campaigns/new?message=" + encodeURIComponent("来店日時の設定を確認してください。"));
  }

  if (!slots.length) {
    redirect("/restaurant/campaigns/new?message=" + encodeURIComponent("選択条件に一致する来店枠がありません。"));
  }

  let deadlineIso: string;
  try {
    deadlineIso = japanLocalDateTimeToIso(applicationDeadline);
  } catch {
    redirect(
      "/restaurant/campaigns/new?message=" +
        encodeURIComponent("応募締切を確認してください。"),
    );
  }

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
    redirect("/restaurant/campaigns/new?message=" + encodeURIComponent("案件を公開できませんでした。入力内容をご確認ください。"));
  }

  redirect(`/restaurant/campaigns/${data}/applications`);
}
