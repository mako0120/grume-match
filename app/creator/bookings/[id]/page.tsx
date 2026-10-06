import { isCalendarExportable } from "@/lib/calendar-export";
import { formatReward } from "@/lib/pricing";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { PostReportCard } from "@/components/post-report-card";
import { PostReportUploader } from "@/components/post-report-uploader";
import { PrReviewSection } from "@/components/pr-review-section";
import { UgcAssetGrid } from "@/components/ugc-asset-grid";
import { UgcUploader } from "@/components/ugc-uploader";
import { UsageLicenseSummary } from "@/components/usage-license-summary";
import { ugcKindForPlatform } from "@/lib/content-rights";
import { formatSignalCode } from "@/lib/signal-metrics";
import { getSiteOrigin } from "@/lib/site-origin";
import {
  paymentStatusLabels,
  platformLabels,
  verificationStatusLabels,
} from "@/lib/status-labels";
import { submitDeliverable } from "@/server/actions/deliverables";
import { removeUgcAsset, submitUgcDeliverable } from "@/server/actions/studio";
import { getCreatorBooking } from "@/server/queries/bookings";
import { getBookingPostReports, getBookingReviews } from "@/server/queries/pr-feedback";
import { getCreatorSignal } from "@/server/queries/signal";

export default async function CreatorBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { id } = await params;
  const { message, status } = await searchParams;
  const [booking, signal, origin, reviews, reports] = await Promise.all([
    getCreatorBooking(id),
    getCreatorSignal(id),
    getSiteOrigin(),
    getBookingReviews(id, "creator"),
    getBookingPostReports(id),
  ]);

  if (!booking) notFound();

  const signalUrl = signal ? `${origin}/r/${signal.code}` : null;

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
          <strong>{booking.payment ? formatReward(booking.payment.amount) : "—"}</strong>
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
        {isCalendarExportable(booking.status) ? (
          <a className="secondary-button" href={`/bookings/${booking.id}/calendar.ics`} download>
            カレンダーに追加
          </a>
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

      {signal && signalUrl ? (
        <section className="signal-link-card">
          <div className="deliverable-head">
            <strong>あなた専用のPRリンク</strong>
            <span className="status-chip">PRコード {formatSignalCode(signal.code)}</span>
          </div>
          <p>
            投稿のキャプションやプロフィールに貼ると、閲覧と来店があなたの成果として記録されます。お店では「PRコード」を伝えてもらうと来店が記録されます。
          </p>
          <div className="signal-link-row">
            <code>{signalUrl}</code>
            <CopyButton value={signalUrl} />
          </div>
          <dl className="signal-row-metrics">
            <div>
              <dt>閲覧</dt>
              <dd>{signal.landing_views}</dd>
            </div>
            <div>
              <dt>来店</dt>
              <dd>{signal.visits}</dd>
            </div>
          </dl>
        </section>
      ) : null}

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

          const report = reports.get(deliverable.id);

          return (
            <article className="deliverable-card" key={deliverable.id}>
            <form action={submitDeliverable} className="deliverable-form">
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
                <>
                  <label className="consent-check">
                    <input name="prDisclosed" required type="checkbox" value="yes" />
                    <span>
                      投稿に「PR」「広告」など、広告だとわかる表記をしました（食事招待のみでも必要です）
                    </span>
                  </label>
                  <button className="secondary-button" type="submit">
                    {deliverable.submitted_url ? "URLを更新" : "投稿URLを提出"}
                  </button>
                </>
              ) : (
                <div className="pending-box">承認済みの投稿URLです。</div>
              )}
            </form>

            {deliverable.submitted_url ? (
              report?.status === "verified" ? (
                <PostReportCard report={report} />
              ) : (
                <div className="post-report-request">
                  <strong>閲覧数レポート</strong>
                  <p>
                    {report?.status === "pending"
                      ? "スクショを受け取りました。読み取って登録したら通知でお知らせします。"
                      : "投稿から1週間ほどたったら、この投稿のインサイト画面のスクショを送ってください。閲覧数が店舗に「運営確認済み」で届き、次の案件の実績になります。"}
                  </p>
                  {report?.status === "rejected" && report.reviewNote ? (
                    <div className="form-message error-message">{report.reviewNote}</div>
                  ) : null}
                  <PostReportUploader
                    bookingId={booking.id}
                    deliverableId={deliverable.id}
                    userId={booking.viewerUserId}
                  />
                </div>
              )
            ) : null}
            </article>
          );
        })}
      </section>

      <PrReviewSection
        bookingId={booking.id}
        counterpart={booking.restaurantName}
        state={reviews}
        viewer="creator"
      />
    </main>
  );
}
