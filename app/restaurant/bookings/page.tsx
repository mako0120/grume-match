import Link from "next/link";
import { listRestaurantUpcomingBookings } from "@/server/queries/restaurant-bookings";

export default async function RestaurantBookingsPage() {
  const bookings = await listRestaurantUpcomingBookings();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">来店予定</span>
      </header>

      <h1 className="page-title">来店予定</h1>
      <p className="page-subtitle">
        確定したPR来店だけを、日時が近い順に表示します。
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
                <span className="meta-pill">{booking.visitLabel}</span>
                <h2>{booking.creatorName}</h2>
                <p>
                  {booking.campaignTitle}・{booking.partySize}名
                </p>
              </div>

              <span className="admin-arrow">→</span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>現在、来店予定はありません</strong>
          <p>Creatorの採用日時が確定すると、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
