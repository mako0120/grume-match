import Link from "next/link";
import { updatePaymentStatus } from "@/server/actions/payments";
import { listAdminPayments } from "@/server/queries/admin-payments";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const paymentLabels: Record<string, string> = {
  approved: "支払承認済み",
  scheduled: "振込予定",
  failed: "要確認",
  paid: "支払済み",
};

const accountTypeLabels: Record<string, string> = {
  ordinary: "普通",
  current: "当座",
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const payments = await listAdminPayments();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/disputes">運営確認</Link>
        </nav>
      </header>

      <h1 className="page-title">報酬支払い</h1>
      <p className="page-subtitle">
        未払い対応と直近30日の支払済み記録だけを表示します。支払済みの証跡は変更できません。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={
            status === "error"
              ? "form-message error-message"
              : "form-message inline-success"
          }
        >
          {message}
        </div>
      ) : null}

      {payments.length ? (
        <section className="campaign-list">
          {payments.map((payment) => {
            const creator = relationOne(payment.creator_profiles);
            const payout = relationOne(creator?.creator_payout_profiles);
            const booking = relationOne(payment.bookings);
            const campaign = relationOne(booking?.campaigns);
            const restaurant = relationOne(campaign?.restaurants);
            const isPaid = payment.status === "paid";

            return (
              <article className="payment-admin-card" key={payment.id}>
                <div>
                  <span className="meta-pill">
                    {paymentLabels[payment.status] ?? payment.status}
                  </span>
                  <h2>{creator?.display_name ?? "Creator"}</h2>
                  <p>
                    {restaurant?.name ?? "店舗"}・{campaign?.title ?? "PR案件"}
                  </p>
                </div>

                <div className="payment-admin-amount">
                  ¥{Number(payment.amount).toLocaleString()}
                </div>

                {payout ? (
                  <section className="section-card">
                    <strong>振込先</strong>
                    <p>
                      {payout.bank_name} {payout.branch_name}
                    </p>
                    <p>
                      {accountTypeLabels[payout.account_type] ?? payout.account_type}
                      ・{payout.account_number}
                      ・{payout.account_holder}
                    </p>
                  </section>
                ) : (
                  <div className="form-message error-message">
                    Creatorの振込先が未登録です。
                  </div>
                )}

                {isPaid ? (
                  <section className="section-card">
                    <strong>振込証跡</strong>
                    <p>参照番号: {payment.transfer_reference ?? "未記録"}</p>
                    {payment.transfer_note ? <p>{payment.transfer_note}</p> : null}
                    <p>
                      {payment.transfer_recorded_at
                        ? dateFormatter.format(new Date(payment.transfer_recorded_at))
                        : payment.paid_at
                          ? dateFormatter.format(new Date(payment.paid_at))
                          : "記録時刻なし"}
                    </p>
                  </section>
                ) : (
                  <form action={updatePaymentStatus} className="payment-admin-actions">
                    <input name="id" type="hidden" value={payment.id} />

                    <label>
                      振込参照番号
                      <input
                        defaultValue={payment.transfer_reference ?? ""}
                        name="transferReference"
                        placeholder="支払済みにする時は必須"
                      />
                    </label>

                    <label>
                      運営メモ（任意）
                      <input
                        defaultValue={payment.transfer_note ?? ""}
                        name="transferNote"
                        placeholder="振込日・確認事項など"
                      />
                    </label>

                    {payment.status === "approved" ? (
                      <>
                        <button
                          className="secondary-button"
                          disabled={!payout}
                          name="status"
                          type="submit"
                          value="scheduled"
                        >
                          振込予定にする
                        </button>
                        <button
                          className="primary-button review-approve"
                          disabled={!payout}
                          name="status"
                          type="submit"
                          value="paid"
                        >
                          振込済みとして確定
                        </button>
                      </>
                    ) : null}

                    {payment.status === "scheduled" ? (
                      <>
                        <button
                          className="primary-button review-approve"
                          disabled={!payout}
                          name="status"
                          type="submit"
                          value="paid"
                        >
                          振込済みとして確定
                        </button>
                        <button
                          className="secondary-button"
                          name="status"
                          type="submit"
                          value="failed"
                        >
                          振込エラー
                        </button>
                      </>
                    ) : null}

                    {payment.status === "failed" ? (
                      <button
                        className="secondary-button"
                        disabled={!payout}
                        name="status"
                        type="submit"
                        value="scheduled"
                      >
                        再度振込予定
                      </button>
                    ) : null}
                  </form>
                )}
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
