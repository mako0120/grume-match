"use client";

import { useState, useTransition } from "react";
import { setStandby } from "@/server/actions/standby";

export function StandbyToggle({
  initialActive,
  availableUntil,
}: {
  initialActive: boolean;
  availableUntil: string | null;
}) {
  const [active, setActive] = useState(initialActive);
  const [until, setUntil] = useState(availableUntil);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;

    startTransition(async () => {
      const result = await setStandby(!active);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      const nextActive = !active;
      setActive(nextActive);
      setUntil(nextActive ? result.availableUntil : null);
      setMessage(
        nextActive
          ? "4時間、FLASHの通知を受け取れる状態にしました。"
          : "「今行ける」をOFFにしました。",
      );
    });
  }

  const untilLabel = until
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(until))
    : null;

  return (
    <section className={active ? "standby-card active" : "standby-card"}>
      <div className="standby-state">
        <span className={active ? "standby-dot active" : "standby-dot"} />
        <div>
          <strong>{active ? "今行ける：ON" : "今行ける：OFF"}</strong>
          <p>
            {active && untilLabel
              ? untilLabel + "まで有効です。"
              : "ONにすると4時間だけ有効になります。"}
          </p>
        </div>
      </div>

      <button
        className={active ? "secondary-button standby-toggle" : "primary-button standby-toggle"}
        disabled={isPending}
        onClick={toggle}
        type="button"
      >
        {isPending ? "更新中..." : active ? "OFFにする" : "今行けるをON"}
      </button>

      {message ? <div className="inline-message">{message}</div> : null}
    </section>
  );
}
