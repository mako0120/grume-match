"use server";

import { redirect } from "next/navigation";
import { buildCampaignSlots } from "@/lib/campaign-slot-builder";
import { createClient } from "@/lib/supabase/server";

function toInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export async function createDirectOffer(formData: FormData) {
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
    redirect("/onboarding");
  }

  const creatorId = String(formData.get("creatorId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const cashReward = toInt(formData.get("cashReward"), 0);
  const foodOffer = String(formData.get("foodOffer") ?? "").trim();
  const maxCompanions = toInt(formData.get("maxCompanions"), 0);
  const visitStart = String(formData.get("visitStart") ?? "");
  const visitEnd = String(formData.get("visitEnd") ?? "");
  const applicationDeadline = String(formData.get("applicationDeadline") ?? "");
  const startTime = String(formData.get("startTime") ?? "17:00");
  const endTime = String(formData.get("endTime") ?? "21:00");
  const intervalMinutes = toInt(formData.get("intervalMinutes"), 30);
  const visitDurationMinutes = toInt(formData.get("visitDurationMinutes"), 120);
  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  const platforms = formData.getAll("platforms").map(String).filter(Boolean);

  if (!creatorId) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("依頼するCreatorを1人選択してください。"),
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
      intervalMinutes,
      visitDurationMinutes,
      capacity: 1,
    });
  } catch {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("来店候補日時を確認してください。"),
    );
  }

  if (!slots.length) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("選択した条件に来店候補がありません。"),
    );
  }

  const deadline = new Date(applicationDeadline);
  if (Number.isNaN(deadline.getTime())) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("応募期限を確認してください。"),
    );
  }

  const { data, error } = await supabase.rpc("create_direct_offer_with_slots", {
    p_restaurant_id: membership.restaurant_id,
    p_creator_id: creatorId,
    p_title: title,
    p_description: description,
    p_category: category,
    p_area: area,
    p_cash_reward: cashReward,
    p_reward_tax_mode: "tax_included",
    p_food_offer: foodOffer,
    p_max_companions: maxCompanions,
    p_visit_period_start: visitStart,
    p_visit_period_end: visitEnd,
    p_application_deadline: deadline.toISOString(),
    p_platforms: platforms,
    p_slots: slots,
  });

  if (error || !data) {
    redirect(
      "/restaurant/offers/new?message=" +
        encodeURIComponent("指名オファーを送信できませんでした。"),
    );
  }

  redirect(`/restaurant/campaigns/${data}/applications`);
}
