import Link from "next/link";
import { updatePaymentStatus } from "@/server/actions/payments";
import { listAdminPayments } from "@/server/queries/admin-payments";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AdminPaymentsPage() {
  const payments = await listAdminPayments();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
        </nav>
      </header>

      <h1 className="page-title">報酬支払い</h1>
      <p className="page-subtitle">
        SOLO MVPでは実際の振込後に状態を更新します。自動送金は後続フェーズです。
      </p>

      {payments.length ? (
        <section className="campaign-list">
          {payments.map((payment) => {
            const creator = relationOne(payment.creator_profiles);
            const booking = relationOne(payment.bookings);
            const campaign = relationOne(booking?.campaigns);
            const restaurant = relationOne(campaign?.restaurants);

            return (
              <article className="payment-admin-card" key={payment.id}>
                <div>
                  <span className="meta-pill">{payment.status}</span>
                  <h2>{creator?.display_name ?? "Creator"}</h2>
                  <p>
                    {restaurant?.name ?? "店舗"}・{campaign?.title ?? "PR案件"}
                  </p>
                </div>

                <div className="payment-admin-amount">
                  ¥{Number(payment.amount).toLocaleString()}
                </div>

                <form action={updatePaymentStatus} className="payment-admin-actions">
                  <input name="id" type="hidden" value={payment.id} />
                  <button
                    className="secondary-button"
                    name="status"
                    type="submit"
                    value="scheduled"
                  >
                    振込予定
                  </button>
                  <button
                    className="primary-button review-approve"
                    name="status"
                    type="submit"
                    value="paid"
                  >
                    支払済みにする
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>支払い対応はありません</strong>
          <p>投稿物がすべて承認されると、支払い対象がここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
