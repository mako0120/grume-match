"use client";

import { useState, useTransition } from "react";
import { reviewReschedule } from "@/server/actions/reschedules";

type Props = {
  requestId: string;
  bookingId: string;
  creatorName: string;
  campaignTitle: string;
  currentLabel: string;
  requestedLabel: string;
};

export function RestaurantRescheduleReview({
  requestId,
  bookingId,
  creatorName,
  campaignTitle,
  currentLabel,
  requestedLabel,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function decide(approve: boolean) {
    if (isPending || completed) return;

    startTransition(async () => {
      const result = await reviewReschedule(
        requestId,
        bookingId,
        approve,
      );

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setCompleted(true);
      setMessage(
        approve
          ? "日時変更を承認しました。新しい時間でBookingを更新しました。"
          : "日時変更を却下しました。元の予約時間を維持します。",
      );
    });
  }

  return (
    <article className="reschedule-review-card">
      <div className="reschedule-review-head">
        <div>
          <span className="eyebrow">RESCHEDULE REQUEST</span>
          <h2>{creatorName}</h2>
          <p>{campaignTitle}</p>
        </div>
      </div>

      <div className="reschedule-route">
        <div>
          <span>現在</span>
          <strong>{currentLabel}</strong>
        </div>
        <div className="reschedule-arrow">→</div>
        <div>
          <span>希望</span>
          <strong>{requestedLabel}</strong>
        </div>
      </div>

      {message ? (
        <div className={completed ? "inline-success" : "form-message"} aria-live="polite">
          {message}
        </div>
      ) : null}

      {!completed ? (
        <div className="review-actions">
          <button
            className="secondary-button"
            disabled={isPending}
            onClick={() => decide(false)}
            type="button"
          >
            却下
          </button>
          <button
            className="primary-button review-approve"
            disabled={isPending}
            onClick={() => decide(true)}
            type="button"
          >
            {isPending ? "処理中..." : "この時間へ変更"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
