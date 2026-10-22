import { createHash, randomBytes } from "node:crypto";

export function makeBookingToken(): string {
  return randomBytes(32).toString("hex");
}

export function bookingTokenHash(token: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function parseVisitDate(value: unknown, now = Date.now()): string | null {
  // Japanese wall clock YYYY-MM-DDTHH:mm, interpreted as fixed Asia/Tokyo.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const parsed = new Date(value + ":00+09:00");
  if (Number.isNaN(parsed.getTime()) ||
      parsed.getTime() < now + 4 * 3600_000 ||
      parsed.getTime() > now + 180 * 86400_000) return null;
  // Enforce genuine date (not 2026-02-31).
  const check = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(parsed).replace(" ", "T");
  if (check !== value) return null;
  return parsed.toISOString();
}

export function formatTokyoVisit(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

export function sevenDaysAfter(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid publication time");
  return new Date(date.getTime() + 7 * 86400_000).toISOString();
}

export function safeBookingSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new Error("Site URL not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Production booking requires HTTPS root origin");
  }
  return url.origin;
}
