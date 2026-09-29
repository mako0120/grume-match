"use client";

import { useMemo, useState } from "react";
import type { CampaignSlot } from "@/lib/domain/types";

type FlexibleChoice = {
  dateLabel: string;
  after: string;
};

type Props = {
  slots: CampaignSlot[];
  maxCompanions: number;
};

export function TapSchedule({ slots, maxCompanions }: Props) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [flexibleChoices, setFlexibleChoices] = useState<FlexibleChoice[]>([]);
  const [partySize, setPartySize] = useState(Math.min(2, maxCompanions + 1));
  const [submitted, setSubmitted] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, CampaignSlot[]>();
    for (const slot of slots) {
      const current = map.get(slot.dateLabel) ?? [];
      current.push(slot);
      map.set(slot.dateLabel, current);
    }
    return [...map.entries()];
  }, [slots]);

  const selectedCount = selectedSlotIds.size + flexibleChoices.length;

  function toggleExact(slot: CampaignSlot) {
    if (!slot.isOpen || slot.remaining <= 0) return;

    setFlexibleChoices((current) =>
      current.filter((choice) => choice.dateLabel !== slot.dateLabel),
    );

    setSelectedSlotIds((current) => {
      const next = new Set(current);
      if (next.has(slot.id)) next.delete(slot.id);
      else next.add(slot.id);
      return next;
    });

    setSubmitted(false);
  }

  function toggleFlexible(dateLabel: string, after = "19:00") {
    setSelectedSlotIds((current) => {
      const next = new Set(current);
      for (const slot of slots) {
        if (slot.dateLabel === dateLabel) next.delete(slot.id);
      }
      return next;
    });

    setFlexibleChoices((current) => {
      const exists = current.some(
        (choice) => choice.dateLabel === dateLabel && choice.after === after,
      );
      if (exists) {
        return current.filter(
          (choice) =>
            !(choice.dateLabel === dateLabel && choice.after === after),
        );
      }
      return [
        ...current.filter((choice) => choice.dateLabel !== dateLabel),
        { dateLabel, after },
      ];
    });

    setSubmitted(false);
  }

  function submitDemo() {
    if (selectedCount === 0) return;
    setSubmitted(true);
  }

  return (
    <>
      <section className="schedule-section">
        <h2>来店できる時間を選択</h2>
        <p className="schedule-hint">
          候補は複数選択できます。店舗は候補の中から日時を確定します。
        </p>

        {grouped.map(([dateLabel, dateSlots]) => {
          const flexibleSelected = flexibleChoices.some(
            (choice) => choice.dateLabel === dateLabel,
          );
          const availableCount = dateSlots.filter(
            (slot) => slot.isOpen && slot.remaining > 0,
          ).length;

          return (
            <div className="date-card" key={dateLabel}>
              <div className="date-head">
                <strong>{dateLabel}</strong>
                <span>選択可能 {availableCount}枠</span>
              </div>

              <div className="slot-grid">
                {dateSlots.map((slot) => (
                  <button
                    className="slot-button"
                    data-selected={selectedSlotIds.has(slot.id)}
                    disabled={!slot.isOpen || slot.remaining <= 0}
                    key={slot.id}
                    onClick={() => toggleExact(slot)}
                    type="button"
                  >
                    {slot.timeLabel}
                  </button>
                ))}

                <button
                  className="flex-button"
                  data-selected={flexibleSelected}
                  onClick={() => toggleFlexible(dateLabel)}
                  type="button"
                >
                  19:00以降ならいつでも
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="schedule-section">
        <h2>来店人数</h2>
        <div className="party-grid">
          {Array.from({ length: maxCompanions + 1 }, (_, index) => index + 1).map(
            (value) => (
              <button
                className="party-button"
                data-selected={partySize === value}
                key={value}
                onClick={() => setPartySize(value)}
                type="button"
              >
                {value}名
              </button>
            ),
          )}
        </div>
      </section>

      {submitted ? (
        <section className="section-card" aria-live="polite">
          <strong>応募デモを受け付けました</strong>
          <p>
            {selectedCount}候補・{partySize}名。次の実装でSupabaseへ保存します。
          </p>
        </section>
      ) : null}

      <div className="application-bar">
        <div className="application-count">
          <strong>{selectedCount}候補</strong>
          <span>選択中</span>
        </div>
        <button
          className="application-button"
          disabled={selectedCount === 0}
          onClick={submitDemo}
          type="button"
        >
          この候補で応募する
        </button>
      </div>
    </>
  );
}
