import Link from "next/link";
import { bookingStatusLabels } from "@/lib/status-labels";
import { listRestaurantUpcomingBookings } from "@/server/queries/restaurant-bookings";

export default async function RestaurantBookingsPage() {
  const bookings = await listRestaurantUpcomingBookings();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">来店管理</span>
      </header>

      <h1 className="page-title">来店管理</h1>
      <p className="page-subtitle">
        これからの来店と、直近で確認が必要な来店をまとめて表示します。
      </p>

      {bookings.length ? (
        <section className="campaign-list">
          {bookings.map((booking) => (
            <Link
              className="booking-card"
              href={"/restaurant/bookings/" + booking.id}
              key={booking.id}
            >
              <div>
                <div className="booking-meta-row">
                  <span className="meta-pill">{booking.visitLabel}</span>
                  <span className="meta-pill">
                    {bookingStatusLabels[booking.status] ?? booking.status}
                  </span>
                </div>
                <h2>{booking.creatorName}</h2>
                <p>
                  {booking.campaignTitle}・{booking.partySize}名
                  {booking.needsVisitConfirmation ? "・来店確認待ち" : ""}
                </p>
              </div>

              <span className="admin-arrow">→</span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>現在、確認する来店はありません</strong>
          <p>来店日時が確定すると、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
