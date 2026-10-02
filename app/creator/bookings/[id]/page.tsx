import Link from "next/link";
import { notFound } from "next/navigation";
import { UgcAssetGrid } from "@/components/ugc-asset-grid";
import { UgcUploader } from "@/components/ugc-uploader";
import { UsageLicenseSummary } from "@/components/usage-license-summary";
import { ugcKindForPlatform } from "@/lib/content-rights";
import {
  paymentStatusLabels,
  platformLabels,
  verificationStatusLabels,
} from "@/lib/status-labels";
import { submitDeliverable } from "@/server/actions/deliverables";
import { removeUgcAsset, submitUgcDeliverable } from "@/server/actions/studio";
import { getCreatorBooking } from "@/server/queries/bookings";

export default async function CreatorBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { id } = await params;
  const { message, status } = await searchParams;
  const booking = await getCreatorBooking(id);

  if (!booking) notFound();

  return (
    <main className="creator-shell">
      <Link className="back-link" href="/creator/bookings">
        ← マイ案件
      </Link>

      <section className="booking-hero">
        <span className="eyebrow">CONFIRMED PR</span>
        <h1>{booking.restaurantName}</h1>
        <p>{booking.campaignTitle}</p>
        <div className="booking-visit">{booking.visitLabel}</div>
      </section>

      <section className="summary-grid">
        <div className="summary-item">
          <span>来店人数</span>
          <strong>{booking.partySize}名</strong>
        </div>
        <div className="summary-item">
          <span>提供</span>
          <strong>{booking.foodOffer || "案件詳細を確認"}</strong>
        </div>
        <div className="summary-item">
          <span>報酬</span>
          <strong>¥{booking.payment?.amount.toLocaleString() ?? "—"}</strong>
          {booking.license && booking.license.fee > 0 ? (
            <small>うち二次利用料 ¥{booking.license.fee.toLocaleString()}</small>
          ) : null}
        </div>
        <div className="summary-item">
          <span>支払い</span>
          <strong>
            {booking.payment
              ? paymentStatusLabels[booking.payment.status] ?? booking.payment.status
              : "—"}
          </strong>
        </div>
      </section>

      <section className="booking-actions">
        {booking.canReschedule ? (
          <Link className="secondary-button" href={`/creator/bookings/${booking.id}/reschedule`}>
            来店日時を変更
          </Link>
        ) : null}
        <Link className="secondary-button" href="/notifications">
          通知を見る
        </Link>
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
        <h2>投稿物を提出</h2>
        <p className="schedule-hint">
          SNS投稿はURLを、UGC素材は写真・動画ファイルを提出すると店舗側で確認できます。
        </p>

        {booking.deliverables.map((deliverable) => {
          const ugcKind = ugcKindForPlatform(deliverable.platform);

          if (ugcKind) {
            const approved = deliverable.verification_status === "approved";

            return (
              <article className="deliverable-card" key={deliverable.id}>
                <div className="deliverable-head">
                  <strong>{platformLabels[deliverable.platform] ?? deliverable.platform}</strong>
                  <span className={`status-chip status-${deliverable.verification_status}`}>
                    {deliverable.submitted_at || approved
                      ? verificationStatusLabels[deliverable.verification_status] ??
                        deliverable.verification_status
                      : "未納品"}
                  </span>
                </div>

                {deliverable.verification_note ? (
                  <div className="form-message">{deliverable.verification_note}</div>
                ) : null}

                <UgcAssetGrid
                  assets={deliverable.assets}
                  bookingId={booking.id}
                  removeAction={approved ? undefined : removeUgcAsset}
                />

                {approved ? (
                  <div className="pending-box">承認済みの素材です。</div>
                ) : (
                  <>
                    <UgcUploader
                      bookingId={booking.id}
                      deliverableId={deliverable.id}
                      existingCount={deliverable.assets.length}
                      kind={ugcKind}
                      userId={booking.viewerUserId}
                    />
                    <form action={submitUgcDeliverable}>
                      <input name="deliverableId" type="hidden" value={deliverable.id} />
                      <input name="bookingId" type="hidden" value={booking.id} />
                      <button
                        className="secondary-button"
                        disabled={!deliverable.assets.length}
                        type="submit"
                      >
                        {deliverable.submitted_at ? "素材を再納品" : "この素材を納品"}
                      </button>
                    </form>
                  </>
                )}
              </article>
            );
          }

          return (
            <form action={submitDeliverable} className="deliverable-card" key={deliverable.id}>
              <input name="deliverableId" type="hidden" value={deliverable.id} />
              <input name="bookingId" type="hidden" value={booking.id} />

              <div className="deliverable-head">
                <strong>{platformLabels[deliverable.platform] ?? deliverable.platform}</strong>
                <span className={`status-chip status-${deliverable.verification_status}`}>
                  {verificationStatusLabels[deliverable.verification_status] ??
                    deliverable.verification_status}
                </span>
              </div>

              <label>
                投稿URL
                <input
                  defaultValue={deliverable.submitted_url ?? ""}
                  name="url"
                  disabled={deliverable.verification_status === "approved"}
                  placeholder="https://..."
                  required
                  type="url"
                />
              </label>

              {deliverable.verification_note ? (
                <div className="form-message">{deliverable.verification_note}</div>
              ) : null}

              {deliverable.verification_status !== "approved" ? (
                <button className="secondary-button" type="submit">
                  {deliverable.submitted_url ? "URLを更新" : "投稿URLを提出"}
                </button>
              ) : (
                <div className="pending-box">承認済みの投稿URLです。</div>
              )}
            </form>
          );
        })}
      </section>
    </main>
  );
}
