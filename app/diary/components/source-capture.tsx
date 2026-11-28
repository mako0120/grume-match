"use client";

import { useEffect } from "react";
import { DIARY_SOURCE_STORAGE_KEY, normalizeLeadSource } from "@/lib/diary/source";

/**
 * Remembers `?ref=` from the landing URL for this browser tab, so the
 * inquiry form can say which link brought the visitor (e.g. ?ref=ig_bio).
 * The first known ref wins; unknown values are ignored.
 */
export function SourceCapture() {
  useEffect(() => {
    const ref = normalizeLeadSource(new URLSearchParams(window.location.search).get("ref"));
    if (!ref) return;
    try {
      if (!window.sessionStorage.getItem(DIARY_SOURCE_STORAGE_KEY)) {
        window.sessionStorage.setItem(DIARY_SOURCE_STORAGE_KEY, ref);
      }
    } catch {
      // Storage can be blocked (private mode); the form still works without it.
    }
  }, []);
  return null;
}

export function readCapturedSource(): string {
  try {
    return normalizeLeadSource(window.sessionStorage.getItem(DIARY_SOURCE_STORAGE_KEY));
  } catch {
    return "";
  }
}
