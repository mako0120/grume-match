import Link from "next/link";
import { formatFeeRule, platformFeeStatusLabels } from "@/lib/pricing";
import { getRestaurantBilling } from "@/server/queries/billing";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
});

export default async function RestaurantBillingPage() {
  const months = await getRestaurantBilling();

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
        初期費用・月額は0円です。手数料は{formatFeeRule()}。最初の1件は無料です。手数料は月ごとにまとめてご請求します。
      </p>

      {months.length ? (
        months.map((month) => (
          <section className="dashboard-section" key={month.label}>
            <div className="section-heading">
              <h2>{month.label}</h2>
              <span className="status-pill">手数料 ¥{month.feeTotal.toLocaleString("ja-JP")}</span>
            </div>
            <p className="field-help">
              この月に完了したPR {month.fees.length}件・Creator報酬 ¥{month.creatorTotal.toLocaleString("ja-JP")}（Creatorへ全額お支払い）
            </p>
            <ul className="signal-conversion-list">
              {month.fees.map((fee) => (
                <li key={fee.id}>
                  <div>
                    <strong>
                      {fee.creatorName}・手数料 ¥{fee.fee.toLocaleString("ja-JP")}
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
