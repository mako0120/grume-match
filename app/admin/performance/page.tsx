import Link from "next/link";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { reviewEvidence } from "@/server/actions/performance";
import { listPendingEvidence } from "@/server/queries/performance";

export default async function AdminPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const items = await listPendingEvidence();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">要対応</Link>
          <Link href="/admin/payments">報酬支払い</Link>
        </nav>
      </header>

      <h1 className="page-title">実績の確認</h1>
      <p className="page-subtitle">
        Creatorが送ったインサイトのスクリーンショットと、入力された数字を照合します。
      </p>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {items.length ? (
        <div className="studio-library">
          {items.map((item) => (
            <article className="studio-entry" key={item.id}>
              <div className="studio-entry-head">
                <div>
                  <strong>{item.creatorName}</strong>
                  <p>
                    {item.measuredOn}計測・{item.platform}
                  </p>
                </div>
              </div>

              {item.imageUrl ? (
                <a href={item.imageUrl} rel="noreferrer" target="_blank">
                  {/* Short-lived signed URL; next/image would cache it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="インサイトのスクリーンショット" className="evidence-image" src={item.imageUrl} />
                </a>
              ) : (
                <div className="pending-box">画像を開けませんでした。</div>
              )}

              {item.summary ? (
                <PerformanceSummaryCard postLimit={20} summary={item.summary} />
              ) : (
                <div className="pending-box">照合する実績がまだ入力されていません。</div>
              )}

              <form action={reviewEvidence} className="campaign-form">
                <input name="evidenceId" type="hidden" value={item.id} />
                <label>
                  差し戻し理由（差し戻す場合のみ）
                  <textarea name="note" rows={2} />
                </label>
                <div className="review-actions">
                  <button className="secondary-button" name="decision" type="submit" value="reject">
                    差し戻す
                  </button>
                  <button className="primary-button review-approve" name="decision" type="submit" value="approve">
                    一致を確認
                  </button>
                </div>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <section className="section-card">
          <strong>確認待ちはありません</strong>
          <p>Creatorがスクリーンショットを送ると、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
