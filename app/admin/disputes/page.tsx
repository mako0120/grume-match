import Link from "next/link";
import { paymentStatusLabels } from "@/lib/status-labels";
import { resolveBookingDispute } from "@/server/actions/disputes";
import { listOpenBookingDisputes } from "@/server/queries/admin-disputes";

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const disputes = await listOpenBookingDisputes();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/payments">報酬支払い</Link>
          <Link href="/admin/audit">監査</Link>
        </nav>
      </header>

      <h1 className="page-title">運営確認</h1>
      <p className="page-subtitle">
        Creator・店舗から届いた例外だけを確認します。確認中は未払い報酬を動かしません。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      {disputes.length ? (
        <section className="campaign-list">
          {disputes.map((dispute) => (
            <article className="payment-admin-card" key={dispute.id}>
              <div>
                <span className="meta-pill">運営確認中</span>
                <h2>{dispute.creatorName} × {dispute.restaurantName}</h2>
                <p>{dispute.campaignTitle}</p>
                <p>受付: {dispute.createdLabel}</p>
              </div>

              <div className="section-card">
                <strong>確認内容</strong>
                <p>{dispute.reason}</p>
              </div>

              <div className="summary-grid">
                <div className="summary-item">
                  <span>報酬</span>
                  <strong>¥{dispute.paymentAmount.toLocaleString()}</strong>
                </div>
                <div className="summary-item">
                  <span>支払い</span>
                  <strong>
                    {paymentStatusLabels[dispute.paymentStatus] ?? dispute.paymentStatus}
                  </strong>
                </div>
                <div className="summary-item">
                  <span>来店状態</span>
                  <strong>{dispute.bookingStatus}</strong>
                </div>
              </div>

              <form action={resolveBookingDispute} className="campaign-form">
                <input name="disputeId" type="hidden" value={dispute.id} />
                <label>
                  運営メモ（任意）
                  <textarea name="note" rows={2} />
                </label>

                <div className="review-actions">
                  <button
                    className="secondary-button"
                    name="outcome"
                    type="submit"
                    value="cancel_unpaid"
                  >
                    未払い報酬を停止
                  </button>
                  <button
                    className="primary-button review-approve"
                    name="outcome"
                    type="submit"
                    value="resume"
                  >
                    通常フローへ戻す
                  </button>
                </div>
              </form>

              <Link
                className="secondary-button"
                href={`/restaurant/bookings/${dispute.bookingId}`}
              >
                案件詳細を見る
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>運営確認はありません</strong>
          <p>通常案件はそのまま自動で進みます。</p>
        </section>
      )}
    </main>
  );
}
