import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PLATFORM_FEE_TAX_RATE, feeTax, formatFeeRule, platformFeeStatusLabels } from "@/lib/pricing";
import { saveBillingEmail } from "@/server/actions/billing";
import { getRestaurantBilling, getRestaurantInvoices } from "@/server/queries/billing";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
});

function periodLabel(period: string) {
  const [year, month] = period.split("-");
  return `${year}年${Number(month)}月`;
}

export default async function RestaurantBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const [months, billing] = await Promise.all([getRestaurantBilling(), getRestaurantInvoices()]);

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← ホーム
      </Link>

      <span className="eyebrow">BILLING</span>
      <h1 className="page-title">ご請求</h1>
      <p className="page-subtitle">
        初期費用・月額は0円です。手数料は{formatFeeRule()}。最初の1件は無料です。手数料は月ごとにまとめ、消費税{PLATFORM_FEE_TAX_RATE * 100}%を加えて請求書をメールでお送りします（カード・銀行振込）。
      </p>

      {message ? (
        <div className="form-message inline-success" aria-live="polite">
          {message}
        </div>
      ) : null}

      {billing.invoices.length ? (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>請求書</h2>
          </div>
          <ul className="signal-conversion-list">
            {billing.invoices.map((invoice) => (
              <li key={invoice.id}>
                <div>
                  <strong>
                    {periodLabel(invoice.period)}分・¥{invoice.total.toLocaleString("ja-JP")}
                  </strong>
                  <p>
                    手数料 ¥{invoice.subtotal.toLocaleString("ja-JP")}＋消費税 ¥{invoice.tax.toLocaleString("ja-JP")}
                  </p>
                </div>
                {invoice.status === "paid" ? (
                  <span className="status-chip status-approved">お支払い済み</span>
                ) : invoice.hostedInvoiceUrl ? (
                  <a className="secondary-button" href={invoice.hostedInvoiceUrl} rel="noopener noreferrer" target="_blank">
                    請求書を開く
                  </a>
                ) : (
                  <span className="status-chip">お支払い待ち</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {billing.restaurantId ? (
        <form action={saveBillingEmail} className="form-section campaign-form">
          <span className="eyebrow">INVOICE</span>
          <h2>請求書の送付先</h2>
          <input name="restaurantId" type="hidden" value={billing.restaurantId} />
          <label>
            メールアドレス
            <input
              autoComplete="email"
              defaultValue={billing.billingEmail ?? ""}
              name="billingEmail"
              placeholder="keiri@example.com"
              required
              type="email"
            />
          </label>
          <p className="field-help">決済はStripeの請求書ページで行います。カード情報はこのアプリには保存されません。</p>
          <PendingSubmitButton idleLabel="保存する" pendingLabel="保存中..." />
        </form>
      ) : null}

      {months.length ? (
        months.map((month) => (
          <section className="dashboard-section" key={month.label}>
            <div className="section-heading">
              <h2>{month.label}</h2>
              <span className="status-pill">
                手数料 ¥{month.feeTotal.toLocaleString("ja-JP")}（税込 ¥{(month.feeTotal + feeTax(month.feeTotal)).toLocaleString("ja-JP")}）
              </span>
            </div>
            <p className="field-help">
              この月に完了したPR {month.fees.length}件・Creator報酬 ¥{month.creatorTotal.toLocaleString("ja-JP")}（Creatorへ全額お支払い）
            </p>
            <ul className="signal-conversion-list">
              {month.fees.map((fee) => (
                <li key={fee.id}>
                  <div>
                    <strong>
                      {fee.creatorName}・手数料 ¥{fee.fee.toLocaleString("ja-JP")}（税抜）
                    </strong>
                    <p>
                      {dateFormatter.format(new Date(fee.createdAt))}完了・{fee.campaignTitle}・報酬 ¥
                      {fee.baseAmount.toLocaleString("ja-JP")}
                      {fee.note ? `・${fee.note}` : ""}
                    </p>
                  </div>
                  <span className={fee.status === "paid" || fee.status === "waived" ? "status-chip status-approved" : "status-chip"}>
                    {platformFeeStatusLabels[fee.status] ?? fee.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <section className="section-card">
          <strong>まだご請求はありません</strong>
          <p>PRが完了（投稿を承認）した時に、ここに手数料が記録されます。最初の1件は無料です。</p>
        </section>
      )}
    </main>
  );
}
