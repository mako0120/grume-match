import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { InsightImportForm } from "@/components/insight-import-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { formatCompactViews } from "@/lib/creator-performance";
import { getSiteOrigin } from "@/lib/site-origin";
import { deletePostMetric, saveMediaKit } from "@/server/actions/performance";
import { getOwnPerformance } from "@/server/queries/performance";

const evidenceLabels = {
  pending: "確認待ち",
  verified: "確認済み",
  rejected: "差し戻し",
} as const;

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function suggestedSlug(name: string) {
  const ascii = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.length >= 3 ? ascii.slice(0, 30) : "";
}

export default async function CreatorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const [data, origin] = await Promise.all([getOwnPerformance(), getSiteOrigin()]);

  if (!data) notFound();

  const today = todayInTokyo();
  const { summary, profile } = data;
  const kitUrl = profile.media_kit_slug ? `${origin}/k/${profile.media_kit_slug}` : null;
  const latestMeasuredOn = summary?.measuredOn ?? data.rows[0]?.measuredOn ?? null;
  const latestRows = latestMeasuredOn
    ? data.rows.filter((row) => row.measuredOn === latestMeasuredOn)
    : [];

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Creator</span>
      </header>

      <Link className="back-link" href="/creator/profile">
        ← プロフィール
      </Link>

      <span className="eyebrow">PROOF</span>
      <h1 className="page-title">過去30日の実績</h1>
      <p className="page-subtitle">
        インサイトの数字を貼り付けるだけで、店舗が依頼を判断するための実績になります。応募・指名オファー・メディアキットに自動で表示されます。
      </p>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {summary ? (
        <PerformanceSummaryCard summary={summary} />
      ) : (
        <section className="section-card">
          <strong>まだ実績がありません</strong>
          <p>
            Instagramのインサイト →「コンテンツ」→「30日間」→「閲覧数」順の画面を見ながら、下の欄に貼り付けてください。
          </p>
        </section>
      )}

      <section className="form-section performance-section">
        <span className="eyebrow">01 IMPORT</span>
        <h2>インサイトを貼り付け</h2>
        <InsightImportForm today={today} />
      </section>

      <section className="form-section performance-section">
        <span className="eyebrow">02 VERIFY</span>
        <h2>運営確認（任意）</h2>
        <p className="field-help">
          入力した画面のスクリーンショットを送ると、運営が照合して「運営確認済み」を付けます。確認済みの実績は店舗から信頼されやすくなります。数字を編集すると確認は外れます。
        </p>
        {latestMeasuredOn ? (
          <EvidenceUploader
            measuredOn={latestMeasuredOn}
            platform={summary?.platform ?? latestRows[0]?.platform ?? "instagram"}
            userId={data.userId}
          />
        ) : (
          <div className="pending-box">先に実績を保存してください。</div>
        )}
        {data.evidence.length ? (
          <ul className="evidence-list">
            {data.evidence.map((item) => (
              <li key={item.id}>
                <span>{item.measured_on}計測のスクショ</span>
                <span
                  className={`status-chip ${item.status === "verified" ? "status-approved" : item.status === "rejected" ? "status-rejected" : ""}`}
                >
                  {evidenceLabels[item.status]}
                </span>
                {item.review_note ? <p>{item.review_note}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="form-section performance-section">
        <span className="eyebrow">03 MEDIA KIT</span>
        <h2>店舗に送れるメディアキット</h2>
        <p className="field-help">
          公開すると、ログインしていない店舗にもURLで実績を見せられます。DMや営業メールにそのまま貼れます。連絡先やスクリーンショットは表示されません。
        </p>

        <form action={saveMediaKit} className="campaign-form media-kit-form">
          <label>
            URL
            <div className="slug-input">
              <span>/k/</span>
              <input
                defaultValue={profile.media_kit_slug ?? suggestedSlug(profile.display_name)}
                maxLength={30}
                minLength={3}
                name="slug"
                pattern="[a-z0-9][a-z0-9\-]{2,29}"
                placeholder="gourmet-diary"
                required
              />
            </div>
          </label>
          <label className="toggle-row">
            <input defaultChecked={profile.media_kit_public} name="public" type="checkbox" />
            URLを知っている人に公開する
          </label>
          <PendingSubmitButton idleLabel="保存する" pendingLabel="保存中..." />
        </form>

        {kitUrl && profile.media_kit_public ? (
          <div className="signal-link-row">
            <code>{kitUrl}</code>
            <CopyButton value={kitUrl} />
          </div>
        ) : null}
        {kitUrl && profile.media_kit_public ? (
          <Link className="secondary-button media-kit-preview" href={`/k/${profile.media_kit_slug}`}>
            公開ページを確認 →
          </Link>
        ) : null}
      </section>

      {latestRows.length ? (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>登録済みの投稿</h2>
            <span className="status-pill">{latestMeasuredOn}計測</span>
          </div>
          <ul className="signal-conversion-list">
            {latestRows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    {row.area}
                    {row.headline ? `｜${row.headline}` : ""}
                  </strong>
                  <p>
                    {row.viewsApprox ? "約" : ""}
                    {formatCompactViews(row.views)}閲覧・♡{row.likes.toLocaleString("ja-JP")}・
                    {row.postedOn}
                    {row.postedOnApprox ? "頃" : ""}投稿
                    {row.verified ? "・確認済み" : ""}
                  </p>
                </div>
                <form action={deletePostMetric}>
                  <input name="metricId" type="hidden" value={row.id} />
                  <button className="text-button" type="submit">
                    削除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
