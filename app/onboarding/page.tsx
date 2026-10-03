import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  completeCreatorOnboarding,
  completeRestaurantOnboarding,
} from "@/server/actions/onboarding";
import { resolveSignedInDestination } from "@/server/auth/resolve-destination";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const destination = await resolveSignedInDestination();
  if (destination !== "/onboarding") redirect(destination);

  return (
    <main className="onboarding-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">{data.user.email}</span>
      </header>

      <h1 className="page-title">どちらで始めますか？</h1>
      <p className="page-subtitle">
        後から事業者向け機能を追加できる設計ですが、MVPでは最初の役割を選択します。
      </p>

      {message ? <div className="form-message">{message}</div> : null}

      <section className="onboarding-grid">
        <form action={completeCreatorOnboarding} className="onboarding-card">
          <span className="eyebrow">CREATOR</span>
          <h2>PR案件に応募する</h2>
          <p>現金報酬付き案件を探し、来店候補日時をタップして応募します。</p>

          <label>
            表示名
            <input name="displayName" placeholder="表示名" required />
          </label>
          <label>
            活動エリア
            <select defaultValue="大阪" name="baseArea" required>
              <option value="大阪">大阪</option>
              <option value="兵庫">兵庫</option>
              <option value="大阪・兵庫">大阪・兵庫</option>
            </select>
          </label>
          <label>
            自己紹介
            <textarea
              name="bio"
              placeholder="発信ジャンルや得意な投稿を簡単に入力"
              rows={3}
            />
          </label>
          <div className="field-row">
            <label>
              最低報酬
              <input min="0" name="minReward" placeholder="例：6000" type="number" />
            </label>
            <label>
              移動範囲 km
              <input defaultValue="20" min="0" name="travelRadiusKm" type="number" />
            </label>
          </div>
          <button className="primary-button form-submit" type="submit">
            Creatorとして開始
          </button>
        </form>

        <form action={completeRestaurantOnboarding} className="onboarding-card">
          <span className="eyebrow">RESTAURANT</span>
          <h2>PR案件を募集する</h2>
          <p>店舗情報を登録し、現金報酬と来店可能枠を設定して募集します。</p>

          <label>
            店舗名
            <input name="name" required />
          </label>
          <div className="field-row">
            <label>
              府県
              <select defaultValue="大阪" name="prefecture" required>
                <option value="大阪">大阪</option>
                <option value="兵庫">兵庫</option>
              </select>
            </label>
            <label>
              エリア
              <input placeholder="梅田 / 三宮 / 淡路" name="area" required />
            </label>
          </div>
          <p className="field-help">現在は大阪・兵庫の店舗のみご利用いただけます。</p>
          <label>
            住所
            <input name="address" required />
          </label>
          <button className="primary-button form-submit" type="submit">
            店舗として開始
          </button>
        </form>
      </section>
    </main>
  );
}
