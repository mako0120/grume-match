"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { CampaignSlot } from "@/lib/domain/types";
import type { RestaurantApplicationChoice } from "@/server/queries/restaurant-applications";
import { confirmApplicationBooking } from "@/server/actions/bookings";

type Props = {
  campaignId: string;
  applicationId: string;
  slots: CampaignSlot[];
  creatorName: string;
  followerCount: number;
  cashReward: number;
  partySize: number;
  choices: RestaurantApplicationChoice[];
};

function localDateKey(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function RestaurantScheduleConfirm({
  campaignId,
  applicationId,
  slots,
  creatorName,
  followerCount,
  cashReward,
  partySize,
  choices,
}: Props) {
  const [confirmedSlotId, setConfirmedSlotId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligibleSlots = useMemo(() => {
    const slotMap = new Map(slots.map((slot) => [slot.id, slot]));
    const resolved = new Map<string, CampaignSlot>();

    for (const choice of choices) {
      if (choice.kind === "exact") {
        const slot = slotMap.get(choice.slotId);
        if (slot?.isOpen && slot.remaining > 0) resolved.set(slot.id, slot);
        continue;
      }

      for (const slot of slots) {
        if (
          localDateKey(slot.startsAt) === choice.dateLocal &&
          slot.timeLabel >= choice.after &&
          slot.isOpen &&
          slot.remaining > 0
        ) {
          resolved.set(slot.id, slot);
        }
      }
    }

    return [...resolved.values()].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  }, [choices, slots]);

  const grouped = useMemo(() => {
    const map = new Map<string, CampaignSlot[]>();
    for (const slot of eligibleSlots) {
      const current = map.get(slot.dateLabel) ?? [];
      current.push(slot);
      map.set(slot.dateLabel, current);
    }
    return [...map.entries()];
  }, [eligibleSlots]);

  const confirmed = confirmedSlotId
    ? slots.find((slot) => slot.id === confirmedSlotId)
    : undefined;

  function confirm(slotId: string) {
    if (isPending) return;
    setMessage(null);

    startTransition(async () => {
      const result = await confirmApplicationBooking(
        campaignId,
        applicationId,
        slotId,
      );

      if (result.ok) {
        setConfirmedSlotId(slotId);
        setBookingId(result.bookingId);
        setMessage("採用と来店日時の確定が完了しました。");
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <section className="restaurant-panel">
      <div className="applicant-card">
        <div>
          <span className="eyebrow">APPLICANT</span>
          <h2>{creatorName}</h2>
          <p>Instagram {followerCount.toLocaleString()} followers</p>
        </div>
        <div className="applicant-reward">
          ¥{cashReward.toLocaleString()}
          <small>報酬</small>
        </div>
      </div>

      {confirmed ? (
        <div className="confirmed-card" aria-live="polite">
          <span className="eyebrow">BOOKING CONFIRMED</span>
          <h2>{confirmed.dateLabel} {confirmed.timeLabel}</h2>
          <p>{creatorName}・{partySize}名で確定しました。</p>
          {bookingId ? (
            <Link className="primary-button booking-review-link" href={`/restaurant/bookings/${bookingId}`}>
              投稿・報酬管理へ
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <h2 className="section-title">候補日時から確定</h2>
          <p className="schedule-hint">
            Creatorが選んだ候補と、現在空いている枠の共通部分だけ表示します。
          </p>

          {grouped.length ? (
            grouped.map(([dateLabel, dateSlots]) => (
              <div className="date-card" key={dateLabel}>
                <div className="date-head">
                  <strong>{dateLabel}</strong>
                  <span>{dateSlots.length}候補</span>
                </div>
                <div className="slot-grid">
                  {dateSlots.map((slot) => (
                    <button
                      className="restaurant-slot-button"
                      disabled={isPending}
                      key={slot.id}
                      onClick={() => confirm(slot.id)}
                      type="button"
                    >
                      {slot.timeLabel}
                      <small>{isPending ? "確定中..." : "この時間で採用"}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="form-message">
              現在確定できる共通時間がありません。別候補の依頼機能は後続Issueで追加します。
            </div>
          )}
        </>
      )}

      {message ? (
        <div className={confirmed ? "inline-success" : "form-message"} aria-live="polite">
          {message}
        </div>
      ) : null}
    </section>
  );
}
