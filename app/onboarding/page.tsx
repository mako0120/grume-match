import { redirect } from "next/navigation";
import { safeNextPath, safeRole, withNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";
import {
  completeCreatorOnboarding,
  completeRestaurantOnboarding,
} from "@/server/actions/onboarding";
import { resolveSignedInDestination } from "@/server/auth/resolve-destination";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string; role?: string }>;
}) {
  const { message, next: rawNext, role: rawRole } = await searchParams;
  const next = safeNextPath(rawNext);
  const role = safeRole(rawRole);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const destination = await resolveSignedInDestination();
  if (destination === "/terms/accept") redirect(withNext(destination, next, role));
  if (destination !== "/onboarding") redirect(next ?? destination);

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

      {role ? (
        <div className="form-message inline-success">
          {role === "restaurant"
            ? "店舗として登録すると、そのままPRを依頼できます。"
            : "Creatorとして登録すると、届いたPRの依頼を受けられます。"}
        </div>
      ) : null}

      <section className={role === "restaurant" ? "onboarding-grid is-restaurant-first" : "onboarding-grid"}>
        <form action={completeCreatorOnboarding} className="onboarding-card">
          {next ? <input name="next" type="hidden" value={next} /> : null}
          <span className="eyebrow">CREATOR</span>
          <h2>PR案件に応募する</h2>
          <p>食事招待・現金報酬つきの案件を探し、来店候補日時をタップして応募します。</p>

          <label>
            表示名
            <input name="displayName" placeholder="表示名" required />
          </label>
          <label>
            活動エリア
            <select defaultValue="大阪" name="baseArea" required>
              <option value="大阪">大阪</option>
              <option value="大阪・兵庫">大阪・兵庫（兵庫からも通える）</option>
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
              最低報酬（0円なら食事招待も届きます）
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
          {next ? <input name="next" type="hidden" value={next} /> : null}
          <span className="eyebrow">RESTAURANT</span>
          <h2>PR案件を募集する</h2>
          <p>店舗情報を登録し、食事招待か現金報酬と、来店可能枠を設定して募集します。</p>

          <label>
            店舗名
            <input name="name" required />
          </label>
          <input name="prefecture" type="hidden" value="大阪" />
          <label>
            エリア（大阪府内）
            <input placeholder="梅田 / 難波 / 天王寺" name="area" required />
          </label>
          <p className="field-help">現在は大阪府内の店舗のみご利用いただけます。</p>
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
