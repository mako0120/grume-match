"use server";

import { redirect } from "next/navigation";
import {
  boundedMetric,
  normalizeSocialHandle,
  validSocialHandle,
  validSocialProfileUrl,
} from "@/lib/social-profile";
import { createClient } from "@/lib/supabase/server";

const allowedPlatforms = new Set(["instagram", "tiktok", "youtube"]);

function nonNegativeInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export async function saveCreatorBasics(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const baseArea = String(formData.get("baseArea") ?? "").trim();
  const minReward = nonNegativeInteger(formData.get("minReward"), 0);
  const travelRadiusKm = nonNegativeInteger(formData.get("travelRadiusKm"), 20);

  if (!displayName || !baseArea) {
    redirect(
      "/creator/profile?message=" +
        encodeURIComponent("表示名と活動エリアを入力してください。"),
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { error } = await supabase
    .from("creator_profiles")
    .update({
      display_name: displayName,
      bio,
      base_area: baseArea,
      min_reward: minReward,
      travel_radius_km: travelRadiusKm,
    })
    .eq("user_id", authData.user.id);

  if (error) {
    redirect(
      "/creator/profile?message=" +
        encodeURIComponent("Creator情報を保存できませんでした。"),
    );
  }

  redirect(
    "/creator/profile?message=" +
      encodeURIComponent("Creator情報を保存しました。"),
  );
}

export async function savePrimarySocialAccount(formData: FormData) {
  const platform = String(formData.get("platform") ?? "");
  const handle = normalizeSocialHandle(String(formData.get("handle") ?? ""));
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  const followers = boundedMetric(formData.get("followers"));
  const avgViews = boundedMetric(formData.get("avgViews"));
  const avgSaves = boundedMetric(formData.get("avgSaves"));
  const localAudienceRatio = Math.min(
    100,
    Math.max(0, Number(formData.get("localAudienceRatio") ?? 0)),
  );

  if (
    !allowedPlatforms.has(platform) ||
    !validSocialHandle(handle) ||
    !validSocialProfileUrl(platform, profileUrl)
  ) {
    redirect(
      "/creator/profile?message=" +
        encodeURIComponent(
          "SNSのユーザー名と公式プロフィールURLを確認してください。",
        ),
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("user_id", authData.user.id)
    .single();

  if (profileError || !profile) {
    redirect("/onboarding?message=" + encodeURIComponent("先にCreatorプロフィールを登録してください。"));
  }

  const { data: existing } = await supabase
    .from("creator_social_accounts")
    .select("id")
    .eq("creator_id", profile.id)
    .eq("platform", platform)
    .limit(1)
    .maybeSingle();

  const payload = {
    creator_id: profile.id,
    platform,
    handle,
    profile_url: profileUrl,
    followers,
    avg_views: avgViews,
    avg_saves: avgSaves,
    local_audience_ratio: localAudienceRatio,
  };

  const { error } = existing
    ? await supabase
        .from("creator_social_accounts")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("creator_social_accounts").insert(payload);

  if (error) {
    redirect("/creator/profile?message=" + encodeURIComponent("SNS情報を保存できませんでした。"));
  }

  redirect(
    "/creator/profile?message=" +
      encodeURIComponent(
        "SNS情報を保存しました。SNSアカウントやURLを変更した場合は運営確認が再度必要です。",
      ),
  );
}
