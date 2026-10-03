import Link from "next/link";
import { notFound } from "next/navigation";
import { PostReportCard } from "@/components/post-report-card";
import { PrReviewSection } from "@/components/pr-review-section";
import { UgcAssetGrid } from "@/components/ugc-asset-grid";
import { UsageLicenseSummary } from "@/components/usage-license-summary";
import { ugcKindForPlatform } from "@/lib/content-rights";
import {
  paymentStatusLabels,
  platformLabels,
  verificationStatusLabels,
} from "@/lib/status-labels";
import { reviewDeliverable } from "@/server/actions/deliverables";
import { platformFeeStatusLabels } from "@/lib/pricing";
import { getBookingFee } from "@/server/queries/billing";
import { getBookingPostReports, getBookingReviews } from "@/server/queries/pr-feedback";
import { getRestaurantBooking } from "@/server/queries/restaurant-booking";

export default async function RestaurantBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { id } = await params;
  const { message, status } = await searchParams;
  const [booking, reviews, reports] = await Promise.all([
    getRestaurantBooking(id),
    getBookingReviews(id, "restaurant"),
    getBookingPostReports(id),
  ]);

  if (!booking) notFound();

  const fee = await getBookingFee(booking.id, booking.cashReward);

  // PR cost (reward + fee) spread over the posts, for the cost per 1,000 views.
  const prCost = booking.cashReward + fee.fee;
  const costPerPost = booking.deliverables.length
    ? Math.round(prCost / booking.deliverables.length)
    : prCost;

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
          {booking.license && booking.license.fee > 0 ? (
            <small>うち二次利用料 ¥{booking.license.fee.toLocaleString()}</small>
          ) : null}
        </div>
        <div className="summary-item">
          <span>手数料</span>
          <strong>¥{fee.fee.toLocaleString()}</strong>
          <small>
            {fee.estimate
              ? fee.note ?? "PR完了時（投稿承認時）に確定"
              : fee.note ?? platformFeeStatusLabels[fee.status] ?? fee.status}
          </small>
        </div>
        <div className="summary-item">
          <span>支払い状態</span>
          <strong>
            {paymentStatusLabels[booking.paymentStatus] ?? booking.paymentStatus}
          </strong>
        </div>
      </section>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {booking.license ? <UsageLicenseSummary license={booking.license} /> : null}

      <section className="deliverable-section">
        <h2>投稿確認</h2>
        <p className="schedule-hint">
          Creatorが提出したURL・素材を確認し、承認または修正依頼を行います。
        </p>

        {booking.deliverables.map((deliverable) => (
          <form action={reviewDeliverable} className="deliverable-card" key={deliverable.id}>
            <input name="deliverableId" type="hidden" value={deliverable.id} />
            <input name="bookingId" type="hidden" value={booking.id} />

            <div className="deliverable-head">
              <strong>{platformLabels[deliverable.platform] ?? deliverable.platform}</strong>
              <span className={`status-chip status-${deliverable.verification_status}`}>
                {deliverable.submitted_at || deliverable.verification_status === "approved"
                  ? verificationStatusLabels[deliverable.verification_status] ??
                    deliverable.verification_status
                  : "未提出"}
              </span>
            </div>

            {ugcKindForPlatform(deliverable.platform) ? (
              deliverable.submitted_at ? (
                <UgcAssetGrid assets={deliverable.assets} showDownload />
              ) : (
                <div className="pending-box">まだ素材が納品されていません。</div>
              )
            ) : deliverable.submitted_url ? (
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

            {reports.get(deliverable.id)?.status === "verified" ? (
              <PostReportCard costYen={costPerPost} report={reports.get(deliverable.id)!} />
            ) : deliverable.submitted_url && !ugcKindForPlatform(deliverable.platform) ? (
              <div className="pending-box">
                閲覧数のレポートは、投稿から1週間ほどでCreatorがインサイトを送り、運営が確認すると表示されます。
              </div>
            ) : null}

            {deliverable.submitted_at &&
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

      <PrReviewSection
        bookingId={booking.id}
        counterpart={`${booking.creatorName}さん`}
        state={reviews}
        viewer="restaurant"
      />
    </main>
  );
}
