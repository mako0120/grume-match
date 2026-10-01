import { getCreatorWallet } from "@/server/queries/wallet";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const statusLabels: Record<string, string> = {
  pending: "確認待ち",
  approved: "支払承認済み",
  scheduled: "振込予定",
  paid: "支払済み",
  failed: "要確認",
};

export default async function CreatorWalletPage() {
  const { payments, totals } = await getCreatorWallet();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Creator</span>
      </header>

      <h1 className="page-title">報酬Wallet</h1>
      <p className="page-subtitle">
        PR案件ごとの報酬と支払い状況を一か所で確認します。
      </p>

      <section className="wallet-summary">
        <div>
          <span>累計報酬</span>
          <strong>¥{totals.total.toLocaleString()}</strong>
        </div>
        <div>
          <span>支払済み</span>
          <strong>¥{totals.paid.toLocaleString()}</strong>
        </div>
        <div>
          <span>振込予定</span>
          <strong>¥{totals.upcoming.toLocaleString()}</strong>
        </div>
        <div>
          <span>確認待ち</span>
          <strong>¥{totals.pending.toLocaleString()}</strong>
        </div>
      </section>

      {payments.length ? (
        <section className="campaign-list">
          {payments.map((payment) => {
            const booking = relationOne(payment.bookings);
            const campaign = relationOne(booking?.campaigns);
            const restaurant = relationOne(campaign?.restaurants);

            return (
              <article className="booking-card" key={payment.id}>
                <div>
                  <span className="meta-pill">
                    {statusLabels[payment.status] ?? payment.status}
                  </span>
                  <h2>{restaurant?.name ?? "店舗"}</h2>
                  <p>{campaign?.title ?? "PR案件"}</p>
                </div>
                <div className="booking-money">
                  ¥{Number(payment.amount).toLocaleString()}
                  <small>{payment.currency}</small>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>まだ報酬履歴はありません</strong>
          <p>案件が採用されると報酬がここに追加されます。</p>
        </section>
      )}
    </main>
  );
}
