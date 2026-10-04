// RFC 5545 (iCalendar) export for a confirmed PR visit. Pure functions so the
// output can be tested without Supabase or Next.js.

/** Booking statuses whose visit time is still expected to happen. */
export const CALENDAR_EXPORTABLE_STATUSES = ["confirmed", "reschedule_requested"] as const;

export function isCalendarExportable(status: string) {
  return (CALENDAR_EXPORTABLE_STATUSES as readonly string[]).includes(status);
}

export type BookingCalendarEvent = {
  bookingId: string;
  startsAt: string;
  endsAt: string;
  summary: string;
  location: string;
  description: string;
  url: string;
};

const PRODUCT_ID = "-//GOURMET DIARY PR OS//Booking Calendar//JA";
const UID_DOMAIN = "gourmet-diary-pr-os";

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold a content line to at most 75 octets per physical line (RFC 5545 §3.1),
 * never splitting a multi-byte UTF-8 character.
 */
export function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // Continuation lines start with a space, which counts toward the 75 octets.
  let limit = 75;

  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

/** Format an instant as a UTC DATE-TIME, e.g. 20261010T100000Z. */
export function toIcsUtc(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_calendar_datetime");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildBookingIcs(event: BookingCalendarEvent, now: Date = new Date()) {
  const start = toIcsUtc(event.startsAt);
  const end = toIcsUtc(event.endsAt);
  if (end <= start) throw new Error("invalid_calendar_range");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Stable per booking: re-downloading after a reschedule updates the same event.
    `UID:booking-${event.bookingId}@${UID_DOMAIN}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

const tokyoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ASCII-only download name; the Tokyo visit date keeps several files apart. */
export function bookingIcsFilename(startsAt: string) {
  return `gourmet-pr-${tokyoDate.format(new Date(startsAt)).replace(/-/g, "")}.ics`;
}
