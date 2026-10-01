import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorReschedulePicker } from "@/components/creator-reschedule-picker";
import { getBookingRescheduleOptions } from "@/server/queries/reschedules";

export default async function CreatorReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = await getBookingRescheduleOptions(id);

  if (!booking) notFound();

  return (
    <main className="creator-shell">
      <Link className="back-link" href={`/creator/bookings/${id}`}>
        ← 案件詳細
      </Link>

      <h1 className="page-title">来店日時を変更</h1>
      <p className="page-subtitle">
        DMを使わず、現在空いている時間から変更候補を選んで申請します。
      </p>

      <section className="section-card">
        <span className="eyebrow">CURRENT BOOKING</span>
        <h2>{booking.restaurantName}</h2>
        <p>{booking.campaignTitle}</p>
      </section>

      {!booking.canReschedule ? (
        <section className="section-card">
          <strong>この来店日時は変更できません</strong>
          <p>来店開始後の日時変更はアプリから受け付けていません。</p>
        </section>
      ) : booking.pendingRequest ? (
        <section className="section-card success-message">
          <strong>日時変更を申請中です</strong>
          <p>店舗が承認または却下すると通知が届きます。</p>
        </section>
      ) : (
        <section className="schedule-section">
          <h2>変更先を選択</h2>
          <p className="schedule-hint">
            変更先は現在空いている枠のみ表示されます。
          </p>
          <CreatorReschedulePicker bookingId={id} slots={booking.slots} />
        </section>
      )}
    </main>
  );
}
