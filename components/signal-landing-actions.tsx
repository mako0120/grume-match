"use client";

import { useEffect } from "react";

type TouchKind = "landing_view" | "reserve_click" | "call_click";

function sendTouch(code: string, kind: TouchKind) {
  const payload = JSON.stringify({ code, kind });

  // sendBeacon survives the navigation to the reservation site / dialer.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/signal",
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return;
  }

  void fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

// Counted from the browser so that link-preview crawlers that do not run
// JavaScript are not counted as views.
export function SignalLandingView({ code }: { code: string }) {
  useEffect(() => {
    const key = "signal-view:" + code;
    try {
      // One view per tab session; nothing is persisted beyond the tab.
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage may be unavailable (private mode); count the view anyway.
    }
    sendTouch(code, "landing_view");
  }, [code]);

  return null;
}

export function SignalLandingActions({
  code,
  phone,
  reservationUrl,
}: {
  code: string;
  phone: string | null;
  reservationUrl: string | null;
}) {
  if (!phone && !reservationUrl) return null;

  return (
    <div className="signal-actions">
      {reservationUrl ? (
        <a
          className="primary-button"
          href={reservationUrl}
          onClick={() => sendTouch(code, "reserve_click")}
          rel="noopener noreferrer"
          target="_blank"
        >
          予約する
        </a>
      ) : null}
      {phone ? (
        <a
          className="secondary-button"
          href={`tel:${phone}`}
          onClick={() => sendTouch(code, "call_click")}
        >
          電話で予約する
        </a>
      ) : null}
    </div>
  );
}
