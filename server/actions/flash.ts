"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function japanIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("invalid_datetime");
  }
  return new Date(`${value}:00+09:00`).toISOString();
}

export async function createFlashCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  const platforms = formData.getAll("platforms").map(String).filter(Boolean);

  let startsAt: string;
  let deadline: string;

  try {
    startsAt = japanIso(String(formData.get("startsAt") ?? ""));
    deadline = japanIso(String(formData.get("deadline") ?? ""));
  } catch {
    redirect(
      "/restaurant/flash/new?message=" +
        encodeURIComponent("来店日時と応募締切を確認してください。"),
    );
  }

  const { data, error } = await supabase.rpc("create_flash_campaign", {
    p_restaurant_id: membership.restaurant_id,
    p_title: String(formData.get("title") ?? "").trim(),
    p_description: String(formData.get("description") ?? "").trim(),
    p_category: String(formData.get("category") ?? "").trim(),
    p_area: String(formData.get("area") ?? "").trim(),
    p_cash_reward: Number(formData.get("cashReward") ?? 0),
    p_food_offer: String(formData.get("foodOffer") ?? "").trim(),
    p_max_companions: Number(formData.get("maxCompanions") ?? 1),
    p_creator_slots: Number(formData.get("creatorSlots") ?? 1),
    p_starts_at: startsAt,
    p_visit_duration_minutes: Number(formData.get("durationMinutes") ?? 120),
    p_application_deadline: deadline,
    p_platforms: platforms,
  });

  if (error || !data) {
    redirect(
      "/restaurant/flash/new?message=" +
        encodeURIComponent("FLASH案件を公開できませんでした。日時や入力内容をご確認ください。"),
    );
  }

  redirect(`/restaurant/campaigns/${data}/applications`);
}
