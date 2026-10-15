import Link from "next/link";
import { notFound } from "next/navigation";
import {
  bookingStatusLabels,
  paymentStatusLabels,
  verificationStatusLabels,
} from "@/lib/status-labels";
import {
  cancelBooking,
  markBookingNoShow,
  markBookingVisited,
} from "@/server/actions/bookings";
import { reviewDeliverable } from "@/server/actions/deliverables";
import { openBookingDispute } from "@/server/actions/disputes";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { id } = await params;
  const { message, status } = await searchParams;
  const booking = await getRestaurantBooking(id);

  if (!booking) notFound();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant/bookings">
        ← 来店予定
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
          <span>来店状態</span>
          <strong>{bookingStatusLabels[booking.status] ?? booking.status}</strong>
        </div>
        <div className="summary-item">
          <span>支払い状態</span>
          <strong>
            {paymentStatusLabels[booking.paymentStatus] ?? booking.paymentStatus}
          </strong>
        </div>
      </section>

      {booking.canMarkVisited || booking.canCancel || booking.canMarkNoShow ? (
        <section className="booking-lifecycle-card">
          <span className="eyebrow">VISIT</span>
          <h2>来店状況</h2>

          {booking.canMarkVisited ? (
            <form action={markBookingVisited}>
              <input name="bookingId" type="hidden" value={booking.id} />
              <button className="primary-button" type="submit">
                来店済みにする
              </button>
            </form>
          ) : null}

          {booking.canCancel ? (
            <details className="danger-details">
              <summary>この来店をキャンセル</summary>
              <form action={cancelBooking} className="danger-form">
                <input name="bookingId" type="hidden" value={booking.id} />
                <input name="scope" type="hidden" value="restaurant" />
                <label>
                  理由（任意）
                  <input name="reason" placeholder="急な休業など" />
                </label>
                <button className="secondary-button" type="submit">
                  キャンセルを確定
                </button>
              </form>
            </details>
          ) : null}

          {booking.canMarkNoShow ? (
            <details className="danger-details">
              <summary>来店なしとして記録</summary>
              <form action={markBookingNoShow} className="danger-form">
                <input name="bookingId" type="hidden" value={booking.id} />
                <label>
                  メモ（任意）
                  <input name="reason" placeholder="連絡なし・30分経過など" />
                </label>
                <button className="secondary-button" type="submit">
                  来店なしを確定
                </button>
              </form>
            </details>
          ) : null}
        </section>
      ) : null}

      {booking.dispute ? (
        <section className="section-card">
          <span className="meta-pill">運営確認中</span>
          <strong>この案件は運営が確認しています</strong>
          <p>{booking.dispute.reason}</p>
        </section>
      ) : booking.status !== "cancelled" ? (
        <details className="section-card">
          <summary>運営に確認を依頼する</summary>
          <form action={openBookingDispute} className="form-stack">
            <input name="bookingId" type="hidden" value={booking.id} />
            <input name="scope" type="hidden" value="restaurant" />
            <label>
              確認してほしい内容
              <textarea
                name="reason"
                placeholder="来店状況・投稿条件・報酬など、確認してほしい内容を入力"
                required
                rows={3}
              />
            </label>
            <button className="secondary-button" type="submit">
              運営確認を開始
            </button>
          </form>
        </details>
      ) : null}

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

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
                {verificationStatusLabels[deliverable.verification_status] ??
                  deliverable.verification_status}
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

            {deliverable.submitted_url &&
            deliverable.verification_status !== "approved" ? (
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
            ) : deliverable.verification_status === "approved" ? (
              <div className="pending-box">承認済みです。</div>
            ) : null}
          </form>
        ))}
      </section>
    </main>
  );
}
