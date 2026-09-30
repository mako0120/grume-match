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
            <input defaultValue="グルメ日誌" name="displayName" required />
          </label>
          <label>
            活動エリア
            <input defaultValue="大阪" name="baseArea" required />
          </label>
          <label>
            自己紹介
            <textarea
              defaultValue="大阪を中心にグルメ情報を発信しています。"
              name="bio"
              rows={3}
            />
          </label>
          <div className="field-row">
            <label>
              最低報酬
              <input defaultValue="6000" min="0" name="minReward" type="number" />
            </label>
            <label>
              移動範囲 km
              <input defaultValue="30" min="0" name="travelRadiusKm" type="number" />
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
          <label>
            エリア
            <input placeholder="梅田 / 難波 / 心斎橋" name="area" required />
          </label>
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
