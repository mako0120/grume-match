import Link from "next/link";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { importFromEvidence, reviewEvidence } from "@/server/actions/performance";
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
        Creatorが送ったインサイトのスクリーンショットを読み取って登録します。Claudeに「実績スクショを読み取って」と頼むと、同じ処理を代わりに行います（docs/CREATOR_PERFORMANCE.md）。
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

              <form action={importFromEvidence} className="campaign-form">
                <input name="evidenceId" type="hidden" value={item.id} />
                <label>
                  計測日（スクショの日）
                  <input defaultValue={item.measuredOn} name="measuredOn" required type="date" />
                </label>
                <label>
                  読み取った数字（1投稿1行）
                  <textarea
                    name="insights"
                    placeholder="淡路市 / 刺身好きなら一度は行きたい / 2.7万 / 1,106 / 27 / 12 / 5 / 3週間"
                    rows={8}
                    spellCheck={false}
                  />
                </label>
                <p className="field-help">
                  エリア / 見出し / 閲覧数 / いいね / コメント / リポスト / シェア / 投稿時期。登録すると「運営確認済み」になり、Creatorに通知されます。
                </p>
                <button className="primary-button" type="submit">
                  この内容で登録
                </button>
              </form>

              {item.summary && item.summary.measuredOn === item.measuredOn ? (
                <details>
                  <summary className="field-help">Creatorが入力済みの数字と照合する</summary>
                  <PerformanceSummaryCard postLimit={20} summary={item.summary} />
                </details>
              ) : null}

              <form action={reviewEvidence} className="campaign-form">
                <input name="evidenceId" type="hidden" value={item.id} />
                <label>
                  差し戻し理由（差し戻す場合のみ）
                  <textarea name="note" rows={2} />
                </label>
                <div className="review-actions">
                  <button className="secondary-button" name="decision" type="submit" value="reject">
                    読めないので差し戻す
                  </button>
                  {item.summary && item.summary.measuredOn === item.measuredOn ? (
                    <button className="secondary-button" name="decision" type="submit" value="approve">
                      入力済みの数字と一致
                    </button>
                  ) : null}
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
