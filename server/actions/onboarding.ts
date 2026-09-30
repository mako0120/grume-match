"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function toNonNegativeInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export async function completeCreatorOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const baseArea = String(formData.get("baseArea") ?? "").trim();
  const minReward = toNonNegativeInteger(formData.get("minReward"), 0);
  const travelRadiusKm = toNonNegativeInteger(formData.get("travelRadiusKm"), 20);

  const { error } = await supabase.rpc("complete_creator_onboarding", {
    p_display_name: displayName,
    p_bio: bio,
    p_base_area: baseArea,
    p_min_reward: minReward,
    p_travel_radius_km: travelRadiusKm,
  });

  if (error) {
    redirect(`/onboarding?message=${encodeURIComponent("Creator登録に失敗しました。入力内容をご確認ください。")}`);
  }

  redirect("/creator/campaigns");
}

export async function completeRestaurantOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();

  const { error } = await supabase.rpc("complete_restaurant_onboarding", {
    p_name: name,
    p_address: address,
    p_area: area,
  });

  if (error) {
    redirect(`/onboarding?message=${encodeURIComponent("店舗登録に失敗しました。入力内容をご確認ください。")}`);
  }

  redirect("/restaurant/campaigns/new");
}
