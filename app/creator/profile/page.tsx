import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  saveCreatorBasics,
  savePrimarySocialAccount,
} from "@/server/actions/profile";

export default async function CreatorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id,display_name,bio,base_area,min_reward,travel_radius_km")
    .eq("user_id", authData.user!.id)
    .single();

  const { data: socials } = profile
    ? await supabase
        .from("creator_social_accounts")
        .select("platform,handle,profile_url,followers,avg_views,avg_saves,local_audience_ratio")
        .eq("creator_id", profile.id)
    : { data: [] };

  const primary = socials?.[0];

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Creator Profile</span>
      </header>

      <h1 className="page-title">SNS実績を登録</h1>
      <p className="page-subtitle">
        フォロワー数だけでなく、平均再生や地域フォロワー比率も店舗の判断材料にします。
      </p>

      {message ? <div className="form-message">{message}</div> : null}

      <Link className="proof-link-card" href="/creator/performance">
        <div>
          <span className="eyebrow">PROOF</span>
          <strong>過去30日の実績・メディアキット</strong>
          <p>インサイトを貼り付けるだけ。応募・指名・店舗への営業に使えます。</p>
        </div>
        <span>→</span>
      </Link>

      <form action={saveCreatorBasics} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">PROFILE</span>
          <h2>基本情報</h2>

          <div className="field-row">
            <label>
              表示名
              <input
                defaultValue={profile?.display_name ?? ""}
                name="displayName"
                required
              />
            </label>
            <label>
              活動エリア
              <input
                defaultValue={profile?.base_area ?? ""}
                name="baseArea"
                required
              />
            </label>
          </div>

          <label>
            自己紹介
            <textarea
              defaultValue={profile?.bio ?? ""}
              name="bio"
              placeholder="得意なジャンルや投稿スタイル"
              rows={3}
            />
          </label>

          <div className="field-row">
            <label>
              最低報酬
              <input
                defaultValue={profile?.min_reward ?? 0}
                min="0"
                name="minReward"
                type="number"
              />
            </label>
            <label>
              移動範囲 km
              <input
                defaultValue={profile?.travel_radius_km ?? 20}
                min="0"
                name="travelRadiusKm"
                type="number"
              />
            </label>
          </div>

          <button className="secondary-button" type="submit">
            基本情報を保存
          </button>
        </section>
      </form>

      <form action={savePrimarySocialAccount} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">SOCIAL ACCOUNT</span>
          <h2>メインSNS</h2>

          <label>
            プラットフォーム
            <select defaultValue={primary?.platform ?? "instagram"} name="platform">
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>

          <div className="field-row">
            <label>
              アカウント名
              <input
                defaultValue={primary?.handle ? `@${primary.handle}` : ""}
                name="handle"
                placeholder="@your_account"
                required
              />
            </label>
            <label>
              フォロワー数
              <input
                defaultValue={primary?.followers ?? 0}
                min="0"
                name="followers"
                type="number"
              />
            </label>
          </div>

          <label>
            プロフィールURL
            <input
              defaultValue={primary?.profile_url ?? ""}
              name="profileUrl"
              placeholder="https://www.instagram.com/..."
              required
              type="url"
            />
          </label>

          <div className="field-row three">
            <label>
              平均再生
              <input defaultValue={primary?.avg_views ?? 0} min="0" name="avgViews" type="number" />
            </label>
            <label>
              平均保存
              <input defaultValue={primary?.avg_saves ?? 0} min="0" name="avgSaves" type="number" />
            </label>
            <label>
              地域フォロワー %
              <input
                defaultValue={primary?.local_audience_ratio ?? 0}
                max="100"
                min="0"
                name="localAudienceRatio"
                step="0.1"
                type="number"
              />
            </label>
          </div>
        </section>

        <button className="primary-button publish-button" type="submit">
          保存して案件を見る
        </button>
      </form>
    </main>
  );
}
