"use server";

import { redirect } from "next/navigation";
import {
  CREATOR_BASE_AREAS,
  OPEN_PREFECTURES,
  prefectureOf,
  type ServicePrefecture,
} from "@/lib/areas";
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

  // The service currently runs in Osaka.
  if (!(CREATOR_BASE_AREAS as readonly string[]).includes(baseArea)) {
    redirect(`/onboarding?message=${encodeURIComponent("活動エリアを選択してください（現在は大阪で提供中）。")}`);
  }
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

  redirect("/creator/profile");
}

export async function completeRestaurantOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const prefecture = String(formData.get("prefecture") ?? "") as ServicePrefecture;
  const place = String(formData.get("area") ?? "").trim();

  // Restaurants can join only in open prefectures (Osaka at launch). Store
  // the prefecture with the place so matching always knows where it is
  // ("大阪・梅田").
  if (!OPEN_PREFECTURES.includes(prefecture) || !place) {
    redirect(`/onboarding?message=${encodeURIComponent("現在は大阪の店舗のみ登録できます。エリアを入力してください。")}`);
  }
  const placePrefecture = prefectureOf(place);
  if (placePrefecture && placePrefecture !== prefecture) {
    redirect(`/onboarding?message=${encodeURIComponent(`「${place}」は${placePrefecture}のエリアです。現在は大阪府内の店舗のみ登録できます。`)}`);
  }
  const area = place.startsWith(prefecture) ? place : `${prefecture}・${place}`;

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
