import { PendingSubmitButton } from "@/components/pending-submit-button";
import type { BookingReview, BookingReviewState } from "@/server/queries/pr-feedback";
import { submitReview } from "@/server/actions/pr-feedback";

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`星${rating}つ`} className="review-stars">
      {"★".repeat(rating)}
      <span aria-hidden="true">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewView({ review, title }: { review: BookingReview; title: string }) {
  return (
    <div className="review-view">
      <span>{title}</span>
      <Stars rating={review.rating} />
      {review.tags.length ? (
        <div className="review-tags">
          {review.tags.map((tag) => (
            <span className="meta-pill" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {review.comment ? <p>{review.comment}</p> : null}
    </div>
  );
}

// 相互評価. Double-blind: the other side's review appears only after the
// viewer has reviewed too (or 14 days later).
export function PrReviewSection({
  bookingId,
  counterpart,
  state,
  viewer,
}: {
  bookingId: string;
  counterpart: string;
  state: BookingReviewState;
  viewer: "creator" | "restaurant";
}) {
  if (!state.open && !state.mine && !state.theirs) return null;

  return (
    <section className="deliverable-section">
      <h2>相互評価</h2>

      {state.mine ? (
        <ReviewView review={state.mine} title="あなたの評価" />
      ) : (
        <form action={submitReview} className="deliverable-card review-form">
          <input name="bookingId" type="hidden" value={bookingId} />
          <input name="viewer" type="hidden" value={viewer} />
          <p className="schedule-hint">
            {counterpart}を評価してください。お互いが評価するまで、相手の評価は表示されません。送信後は変更できません。
          </p>

          <fieldset className="star-picker">
            <legend>総合評価</legend>
            {[5, 4, 3, 2, 1].map((value) => (
              <label key={value}>
                <input name="rating" required type="radio" value={value} />
                <span>{"★".repeat(value)}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="review-tag-picker">
            <legend>よかったところ（任意・複数可）</legend>
            {state.tagChoices.map((tag) => (
              <label key={tag}>
                <input name="tags" type="checkbox" value={tag} />
                <span>{tag}</span>
              </label>
            ))}
          </fieldset>

          <label>
            コメント（任意・300文字まで）
            <textarea maxLength={300} name="comment" rows={2} />
          </label>

          <PendingSubmitButton idleLabel="評価を送信" pendingLabel="送信中..." />
        </form>
      )}

      {state.theirs ? (
        <ReviewView review={state.theirs} title={`${counterpart}からの評価`} />
      ) : state.mine ? (
        <div className="pending-box">{counterpart}の評価を待っています。</div>
      ) : null}
    </section>
  );
}
