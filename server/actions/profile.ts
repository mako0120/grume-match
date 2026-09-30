"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedPlatforms = new Set(["instagram", "tiktok", "youtube"]);

export async function savePrimarySocialAccount(formData: FormData) {
  const platform = String(formData.get("platform") ?? "");
  const handle = String(formData.get("handle") ?? "").trim().replace(/^@/, "");
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  const followers = Math.max(0, Math.floor(Number(formData.get("followers") ?? 0)));
  const avgViews = Math.max(0, Math.floor(Number(formData.get("avgViews") ?? 0)));
  const avgSaves = Math.max(0, Math.floor(Number(formData.get("avgSaves") ?? 0)));
  const localAudienceRatio = Math.min(
    100,
    Math.max(0, Number(formData.get("localAudienceRatio") ?? 0)),
  );

  if (!allowedPlatforms.has(platform) || !handle || !profileUrl) {
    redirect("/creator/profile?message=" + encodeURIComponent("SNS情報を確認してください。"));
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(profileUrl);
  } catch {
    redirect("/creator/profile?message=" + encodeURIComponent("プロフィールURLが正しくありません。"));
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    redirect("/creator/profile?message=" + encodeURIComponent("プロフィールURLが正しくありません。"));
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

  redirect("/creator/campaigns");
}
