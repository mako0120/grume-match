import Link from "next/link";
import { RestaurantRescheduleReview } from "@/components/restaurant-reschedule-review";
import { listRestaurantPendingReschedules } from "@/server/queries/reschedules";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default async function RestaurantReschedulesPage() {
  const requests = await listRestaurantPendingReschedules();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/restaurant">店舗管理</Link>
          <Link href="/notifications">通知</Link>
        </nav>
      </header>

      <h1 className="page-title">日時変更リクエスト</h1>
      <p className="page-subtitle">
        Creatorの変更希望と空き枠を確認し、タップで承認または却下します。
      </p>

      {requests.length ? (
        <section className="campaign-list">
          {requests.map((request) => {
            const booking = relationOne(request.bookings);
            const creator = relationOne(booking?.creator_profiles);
            const campaign = relationOne(booking?.campaigns);
            const currentSlot = relationOne(booking?.campaign_slots);
            const requestedSlot = relationOne(request.campaign_slots);

            if (!booking || !currentSlot || !requestedSlot) return null;

            return (
              <RestaurantRescheduleReview
                bookingId={request.booking_id}
                campaignTitle={campaign?.title ?? "PR案件"}
                creatorName={creator?.display_name ?? "Creator"}
                currentLabel={dateFormatter.format(new Date(currentSlot.starts_at))}
                key={request.id}
                requestId={request.id}
                requestedLabel={dateFormatter.format(new Date(requestedSlot.starts_at))}
              />
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>日時変更リクエストはありません</strong>
          <p>変更申請が届いた時だけ、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
