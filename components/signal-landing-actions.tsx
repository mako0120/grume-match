"use client";

import { useEffect } from "react";

function sendView(code: string) {
  const payload = JSON.stringify({ code });

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
    sendView(code);
  }, [code]);

  return null;
}
