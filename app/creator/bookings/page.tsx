import Link from "next/link";
import { listCreatorBookings } from "@/server/queries/bookings";

const paymentLabels: Record<string, string> = {
  pending: "確認待ち",
  approved: "支払承認済み",
  scheduled: "振込予定",
  paid: "支払済み",
  failed: "要確認",
};

export default async function CreatorBookingsPage() {
  const bookings = await listCreatorBookings();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Creator</span>
      </header>

      <h1 className="page-title">マイ案件</h1>
      <p className="page-subtitle">
        確定した来店日時、投稿期限、報酬状況をここで管理します。
      </p>

      {bookings.length ? (
        <section className="campaign-list">
          {bookings.map((booking) => (
            <Link className="booking-card" href={`/creator/bookings/${booking.id}`} key={booking.id}>
              <div>
                <span className="meta-pill">{booking.visitLabel}</span>
                <h2>{booking.restaurantName}</h2>
                <p>{booking.campaignTitle}</p>
              </div>
              <div className="booking-money">
                ¥{booking.paymentAmount.toLocaleString()}
                <small>{paymentLabels[booking.paymentStatus] ?? booking.paymentStatus}</small>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>確定済み案件はありません</strong>
          <p>応募した案件が採用されると、ここに来店予定が追加されます。</p>
        </section>
      )}
    </main>
  );
}
