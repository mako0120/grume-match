import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceUploader } from "@/components/evidence-uploader";
import { InsightImportForm } from "@/components/insight-import-form";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { formatCompactViews } from "@/lib/creator-performance";
import { deletePostMetric } from "@/server/actions/performance";
import { getOwnPerformance } from "@/server/queries/performance";

const evidenceLabels = {
  pending: "読み取り待ち",
  verified: "登録済み",
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

export default async function CreatorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const data = await getOwnPerformance();

  if (!data) notFound();

  const today = todayInTokyo();
  const { summary } = data;
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
        スクショを送るだけで、店舗が応募者を選ぶ時やおすすめCreatorに表示されます。実績があるほどマッチしやすくなります。
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
        <span className="eyebrow">月1回</span>
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
