"use client";

import { useMemo, useState, useTransition } from "react";
import type { CampaignSlot } from "@/lib/domain/types";
import { requestReschedule } from "@/server/actions/reschedules";

export function CreatorReschedulePicker({
  bookingId,
  slots,
}: {
  bookingId: string;
  slots: CampaignSlot[];
}) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const groups = new Map<string, CampaignSlot[]>();

    for (const slot of slots.filter((item) => item.isOpen && item.remaining > 0)) {
      const current = groups.get(slot.dateLabel) ?? [];
      current.push(slot);
      groups.set(slot.dateLabel, current);
    }

    return [...groups.entries()];
  }, [slots]);

  function submit() {
    if (!selectedSlotId || isPending) return;

    startTransition(async () => {
      const result = await requestReschedule(bookingId, selectedSlotId);

      if (result.ok) {
        setMessage("日時変更を申請しました。店舗の承認をお待ちください。");
        return;
      }

      setMessage(result.message);
    });
  }

  return (
    <>
      {grouped.length ? (
        grouped.map(([dateLabel, dateSlots]) => (
          <div className="date-card" key={dateLabel}>
            <div className="date-head">
              <strong>{dateLabel}</strong>
              <span>{dateSlots.length}枠</span>
            </div>

            <div className="slot-grid">
              {dateSlots.map((slot) => (
                <button
                  className="slot-button"
                  data-selected={selectedSlotId === slot.id}
                  disabled={isPending}
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  type="button"
                >
                  {slot.timeLabel}
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <section className="section-card">
          <strong>変更できる空き枠がありません</strong>
          <p>店舗側で新しい枠が追加されると選択できます。</p>
        </section>
      )}

      {message ? (
        <div className="form-message" aria-live="polite">
          {message}
        </div>
      ) : null}

      <button
        className="primary-button publish-button"
        disabled={!selectedSlotId || isPending}
        onClick={submit}
        type="button"
      >
        {isPending ? "申請中..." : "この時間へ変更申請"}
      </button>
    </>
  );
}
