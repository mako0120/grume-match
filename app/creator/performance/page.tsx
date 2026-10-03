import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { InsightImportForm } from "@/components/insight-import-form";
import { OutreachComposer } from "@/components/outreach-composer";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { formatCompactViews } from "@/lib/creator-performance";
import { getSiteOrigin } from "@/lib/site-origin";
import { deletePostMetric, savePrDesk } from "@/server/actions/performance";
import { getOwnPerformance } from "@/server/queries/performance";

const evidenceLabels = {
  pending: "読み取り待ち",
  verified: "登録済み",
  rejected: "差し戻し",
} as const;

const sentFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
});

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toSlug(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

// Instagram handle first (Japanese display names have no Latin letters).
function suggestedSlug(handles: string[], name: string, userId: string) {
  for (const candidate of [...handles, name]) {
    const slug = toSlug(candidate);
    if (slug.length >= 3) return slug;
  }
  return `creator-${userId.slice(0, 8)}`;
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
  const deskOpen = profile.flat_plan_enabled && profile.media_kit_public && Boolean(profile.media_kit_slug);
  const orderUrl = profile.media_kit_slug ? `${origin}/order/${profile.media_kit_slug}` : null;
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

      <span className="eyebrow">PR DESK</span>
      <h1 className="page-title">実績とPR窓口</h1>
      <p className="page-subtitle">
        スクショを送る → 窓口を公開する → 営業メールを送る。この3つだけです。
      </p>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {summary ? <PerformanceSummaryCard postLimit={5} summary={summary} /> : null}

      <section className="form-section performance-section">
        <span className="eyebrow">1 実績</span>
        <h2>インサイトのスクショを送る</h2>
        <p className="field-help">
          Instagramのインサイト →「コンテンツ」→「30日間」→「閲覧数」順の画面を撮って送るだけ。数字は読み取って登録し、「運営確認済み」で店舗に表示されます。月1回送ってください。
        </p>
        <EvidenceUploader
          measuredOn={today}
          platform={summary?.platform ?? "instagram"}
          userId={data.userId}
        />
        {data.evidence.length ? (
          <ul className="evidence-list">
            {data.evidence.slice(0, 3).map((item) => (
              <li key={item.id}>
                <span>{item.measured_on}のスクショ</span>
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

        <details className="manual-entry">
          <summary>自分で数字を入力する</summary>
          <InsightImportForm today={today} />
        </details>
      </section>

      <section className="form-section performance-section">
        <span className="eyebrow">2 PR窓口</span>
        <h2>一律料金で依頼を受け付ける</h2>
        <p className="field-help">
          公開すると、店舗は専用ページから候補日時を選ぶだけで依頼できます。内容はInstagramリール1本・税込・お食事は1名分。価格交渉はありません。
        </p>

        <form action={savePrDesk} className="campaign-form media-kit-form">
          <label>
            料金（税込）
            <div className="slug-input">
              <span>¥</span>
              <input
                defaultValue={profile.flat_plan_price ?? 8000}
                inputMode="numeric"
                max="1000000"
                min="1000"
                name="price"
                required
                step="500"
                type="number"
              />
            </div>
          </label>
          <label className="toggle-row">
            <input defaultChecked={deskOpen} name="enabled" type="checkbox" />
            PR窓口を公開する
          </label>
          <details>
            <summary className="field-help">ページのURLを変える</summary>
            <div className="slug-input">
              <span>/order/</span>
              <input
                defaultValue={profile.media_kit_slug ?? suggestedSlug(
                  (profile.creator_social_accounts ?? [])
                    .sort((a) => (a.platform === "instagram" ? -1 : 1))
                    .map((account) => account.handle),
                  profile.display_name,
                  data.userId,
                )}
                maxLength={30}
                minLength={3}
                name="slug"
                pattern="[a-z0-9][a-z0-9\-]{2,29}"
                required
              />
            </div>
          </details>
          <PendingSubmitButton idleLabel="保存する" pendingLabel="保存中..." />
        </form>

        {deskOpen && orderUrl ? (
          <>
            <div className="signal-link-row">
              <code>{orderUrl}</code>
              <CopyButton value={orderUrl} />
            </div>
            <Link className="secondary-button media-kit-preview" href={`/order/${profile.media_kit_slug}`}>
              店舗から見たページを確認 →
            </Link>
          </>
        ) : null}
      </section>

      <section className="form-section performance-section">
        <span className="eyebrow">3 営業</span>
        <h2>Gmailで依頼ページを送る</h2>
        {deskOpen && orderUrl ? (
          <>
            <OutreachComposer
              creatorName={profile.display_name}
              highlights={summary?.highlights ?? []}
              orderUrl={orderUrl}
              price={profile.flat_plan_price}
              verified={summary?.verified === "all"}
            />
            {data.outreach.length ? (
              <details className="outreach-log">
                <summary>送った店舗（{data.outreach.length}件）</summary>
                <ul className="evidence-list">
                  {data.outreach.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.company_name}
                        {item.contact_name ? `・${item.contact_name}様` : ""}
                      </span>
                      <span className="status-chip">
                        {sentFormatter.format(new Date(item.created_at))}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : (
          <div className="pending-box">先に「PR窓口を公開する」をオンにしてください。</div>
        )}
      </section>

      {latestRows.length ? (
        <details className="dashboard-section registered-posts">
          <summary>
            登録済みの投稿（{latestMeasuredOn}・{latestRows.length}件）
          </summary>
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
                    {formatCompactViews(row.views)}閲覧・♡{row.likes.toLocaleString("ja-JP")}
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
        </details>
      ) : null}
    </main>
  );
}
