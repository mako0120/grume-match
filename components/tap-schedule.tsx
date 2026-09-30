"use client";

import { useMemo, useState, useTransition } from "react";
import type { CampaignSlot } from "@/lib/domain/types";
import { submitCampaignApplication } from "@/server/actions/applications";

type FlexibleChoice = {
  dateLabel: string;
  dateLocal: string;
  after: string;
};

type Props = {
  campaignId: string;
  slots: CampaignSlot[];
  maxCompanions: number;
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

export function TapSchedule({ campaignId, slots, maxCompanions }: Props) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [flexibleChoices, setFlexibleChoices] = useState<FlexibleChoice[]>([]);
  const [partySize, setPartySize] = useState(1);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

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
    if (!slot.isOpen || slot.remaining <= 0 || isPending) return;

    setFlexibleChoices((current) =>
      current.filter((choice) => choice.dateLabel !== slot.dateLabel),
    );

    setSelectedSlotIds((current) => {
      const next = new Set(current);
      if (next.has(slot.id)) next.delete(slot.id);
      else next.add(slot.id);
      return next;
    });

    setResult(null);
  }

  function toggleFlexible(dateLabel: string, dateLocal: string, after = "19:00") {
    if (isPending) return;

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
        { dateLabel, dateLocal, after },
      ];
    });

    setResult(null);
  }

  function submit() {
    if (selectedCount === 0 || isPending) return;

    startTransition(async () => {
      const response = await submitCampaignApplication({
        campaignId,
        partySize,
        exactSlotIds: [...selectedSlotIds],
        flexibleChoices: flexibleChoices.map((choice) => ({
          dateLocal: choice.dateLocal,
          afterLocal: choice.after,
        })),
      });

      if (response.ok) {
        setResult({
          ok: true,
          message: "応募しました。店舗が候補日時を選ぶと予約が確定します。",
        });
        return;
      }

      setResult({ ok: false, message: response.message });
    });
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
          const dateLocal = localDateKey(dateSlots[0].startsAt);

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
                    disabled={!slot.isOpen || slot.remaining <= 0 || isPending}
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
                  disabled={isPending || availableCount === 0}
                  onClick={() => toggleFlexible(dateLabel, dateLocal)}
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
        <div className="party-section-head">
          <div>
            <h2>来店人数</h2>
            <p className="schedule-hint">
              1人でも応募できます。同伴可能な案件では必要な場合だけ人数を増やしてください。
            </p>
          </div>
          {maxCompanions === 0 ? (
            <span className="solo-badge">1名限定</span>
          ) : (
            <span className="solo-badge">1名からOK</span>
          )}
        </div>
        <div className="party-grid">
          {Array.from({ length: maxCompanions + 1 }, (_, index) => index + 1).map(
            (value) => (
              <button
                className="party-button"
                data-selected={partySize === value}
                disabled={isPending}
                key={value}
                onClick={() => setPartySize(value)}
                type="button"
              >
                {value === 1 ? "1名（ひとり）" : `${value}名`}
              </button>
            ),
          )}
        </div>
      </section>

      {result ? (
        <section
          className={result.ok ? "section-card success-message" : "section-card error-message"}
          aria-live="polite"
        >
          <strong>{result.ok ? "応募完了" : "応募できませんでした"}</strong>
          <p>{result.message}</p>
        </section>
      ) : null}

      <div className="application-bar">
        <div className="application-count">
          <strong>{selectedCount}候補</strong>
          <span>選択中</span>
        </div>
        <button
          className="application-button"
          disabled={selectedCount === 0 || isPending || result?.ok === true}
          onClick={submit}
          type="button"
        >
          {isPending ? "応募中..." : result?.ok ? "応募済み" : "この候補で応募する"}
        </button>
      </div>
    </>
  );
}
