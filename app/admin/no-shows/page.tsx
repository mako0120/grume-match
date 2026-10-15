import Link from "next/link";
import { reviewNoShow } from "@/server/actions/no-shows";
import { listUnreviewedNoShows } from "@/server/queries/admin-no-shows";

export default async function AdminNoShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const rows = await listUnreviewedNoShows();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/disputes">運営確認</Link>
          <Link href="/admin/payments">報酬支払い</Link>
        </nav>
      </header>

      <h1 className="page-title">来店例外</h1>
      <p className="page-subtitle">
        来店なしとして記録された案件だけを確認します。確認後はInboxから外れます。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      {rows.length ? (
        <section className="campaign-list">
          {rows.map((row) => (
            <article className="payment-admin-card" key={row.id}>
              <div>
                <span className="meta-pill">来店なし</span>
                <h2>{row.creatorName} × {row.restaurantName}</h2>
                <p>{row.campaignTitle}</p>
                <p>{row.noShowLabel}</p>
              </div>

              {row.reason ? (
                <div className="section-card">
                  <strong>店舗メモ</strong>
                  <p>{row.reason}</p>
                </div>
              ) : null}

              <form action={reviewNoShow} className="campaign-form">
                <input name="bookingId" type="hidden" value={row.id} />
                <label>
                  運営メモ（任意）
                  <textarea
                    name="note"
                    placeholder="連絡履歴や対応内容を記録"
                    rows={2}
                  />
                </label>
                <button className="primary-button" type="submit">
                  確認済みにする
                </button>
              </form>

              <Link
                className="secondary-button"
                href={`/restaurant/bookings/${row.id}`}
              >
                案件詳細を見る
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>未確認の来店例外はありません</strong>
          <p>対応済みの案件はここに残りません。</p>
        </section>
      )}
    </main>
  );
}
