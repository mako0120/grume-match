"use client";

import { useMemo, useState } from "react";
import type { CampaignSlot } from "@/lib/domain/types";

type ExactChoice = {
  kind: "exact";
  slotId: string;
};

type FlexibleChoice = {
  kind: "flexible";
  dateLabel: string;
  after: string;
};

type AvailabilityChoice = ExactChoice | FlexibleChoice;

type Props = {
  slots: CampaignSlot[];
  creatorName: string;
  followerCount: number;
  cashReward: number;
  partySize: number;
  choices: AvailabilityChoice[];
};

export function RestaurantScheduleConfirm({
  slots,
  creatorName,
  followerCount,
  cashReward,
  partySize,
  choices,
}: Props) {
  const [confirmedSlotId, setConfirmedSlotId] = useState<string | null>(null);

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
          slot.dateLabel === choice.dateLabel &&
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
          <p>
            {creatorName}・{partySize}名で確定しました。
            本番ではこの操作がDB transactionで枠数を確保します。
          </p>
          <button
            className="secondary-button"
            onClick={() => setConfirmedSlotId(null)}
            type="button"
          >
            デモを戻す
          </button>
        </div>
      ) : (
        <>
          <h2 className="section-title">候補日時から確定</h2>
          <p className="schedule-hint">
            Creatorが選んだ候補と、現在空いている枠の共通部分だけ表示します。
          </p>

          {grouped.map(([dateLabel, dateSlots]) => (
            <div className="date-card" key={dateLabel}>
              <div className="date-head">
                <strong>{dateLabel}</strong>
                <span>{dateSlots.length}候補</span>
              </div>
              <div className="slot-grid">
                {dateSlots.map((slot) => (
                  <button
                    className="restaurant-slot-button"
                    key={slot.id}
                    onClick={() => setConfirmedSlotId(slot.id)}
                    type="button"
                  >
                    {slot.timeLabel}
                    <small>この時間で採用</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
