import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewDeliverable } from "@/server/actions/deliverables";
import { getRestaurantBooking } from "@/server/queries/restaurant-booking";

const platformLabels: Record<string, string> = {
  instagram_feed: "Instagram Feed",
  instagram_reel: "Instagram Reel",
  instagram_story: "Instagram Story",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  ugc_photo: "UGC写真",
  ugc_video: "UGC動画",
};

export default async function RestaurantBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = await getRestaurantBooking(id);

  if (!booking) notFound();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant/campaigns/new">
        ← 店舗管理
      </Link>

      <section className="booking-hero">
        <span className="eyebrow">PR BOOKING</span>
        <h1>{booking.creatorName}</h1>
        <p>{booking.campaignTitle}</p>
        <div className="booking-visit">{booking.visitLabel}</div>
      </section>

      <section className="summary-grid">
        <div className="summary-item">
          <span>Instagram</span>
          <strong>{booking.followerCount.toLocaleString()} followers</strong>
        </div>
        <div className="summary-item">
          <span>来店人数</span>
          <strong>{booking.partySize}名</strong>
        </div>
        <div className="summary-item">
          <span>報酬</span>
          <strong>¥{booking.cashReward.toLocaleString()}</strong>
        </div>
        <div className="summary-item">
          <span>支払い状態</span>
          <strong>{booking.paymentStatus}</strong>
        </div>
      </section>

      <section className="deliverable-section">
        <h2>投稿確認</h2>
        <p className="schedule-hint">
          Creatorが提出したURLを確認し、承認または修正依頼を行います。
        </p>

        {booking.deliverables.map((deliverable) => (
          <form action={reviewDeliverable} className="deliverable-card" key={deliverable.id}>
            <input name="deliverableId" type="hidden" value={deliverable.id} />
            <input name="bookingId" type="hidden" value={booking.id} />

            <div className="deliverable-head">
              <strong>{platformLabels[deliverable.platform] ?? deliverable.platform}</strong>
              <span className={`status-chip status-${deliverable.verification_status}`}>
                {deliverable.verification_status}
              </span>
            </div>

            {deliverable.submitted_url ? (
              <a
                className="submitted-link"
                href={deliverable.submitted_url}
                rel="noreferrer"
                target="_blank"
              >
                投稿を確認 →
              </a>
            ) : (
              <div className="pending-box">まだ投稿URLが提出されていません。</div>
            )}

            {deliverable.submitted_url ? (
              <>
                <label>
                  修正依頼メモ（必要な場合のみ）
                  <textarea name="note" rows={2} />
                </label>
                <div className="review-actions">
                  <button
                    className="secondary-button"
                    name="decision"
                    type="submit"
                    value="reject"
                  >
                    修正を依頼
                  </button>
                  <button
                    className="primary-button review-approve"
                    name="decision"
                    type="submit"
                    value="approve"
                  >
                    承認する
                  </button>
                </div>
              </>
            ) : null}
          </form>
        ))}
      </section>
    </main>
  );
}
