import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  bookingIcsFilename,
  buildBookingIcs,
  escapeIcsText,
  foldIcsLine,
  isCalendarExportable,
  toIcsUtc,
} from "../lib/calendar-export.ts";

function event(overrides = {}) {
  return {
    bookingId: "11111111-2222-3333-4444-555555555555",
    startsAt: "2026-10-10T10:00:00+00:00",
    endsAt: "2026-10-10T11:30:00+00:00",
    summary: "PR来店: 鮨 たなか",
    location: "鮨 たなか 大阪府大阪市北区1-2-3",
    description: "秋のおまかせPR\n来店人数: 2名",
    url: "https://example.com/creator/bookings/11111111-2222-3333-4444-555555555555",
    ...overrides,
  };
}

const now = new Date("2026-10-04T00:00:00Z");

test("only bookings whose visit is still expected can be exported", () => {
  assert.equal(isCalendarExportable("confirmed"), true);
  assert.equal(isCalendarExportable("reschedule_requested"), true);
  for (const status of ["held", "visited", "cancelled", "no_show", ""]) {
    assert.equal(isCalendarExportable(status), false, status);
  }
});

test("times are written in UTC without milliseconds", () => {
  assert.equal(toIcsUtc("2026-10-10T19:00:00+09:00"), "20261010T100000Z");
  assert.throws(() => toIcsUtc("not a date"), /invalid_calendar_datetime/);
});

test("TEXT values escape backslash, separators and newlines", () => {
  assert.equal(escapeIcsText("a\\b;c,d\ne\r\nf"), "a\\\\b\\;c\\,d\\ne\\nf");
});

test("long lines fold at 75 octets without splitting UTF-8 characters", () => {
  const folded = foldIcsLine(`DESCRIPTION:${"焼鳥".repeat(60)}`);
  const encoder = new TextEncoder();
  for (const physical of folded.split("\r\n")) {
    assert.ok(encoder.encode(physical).length <= 75, physical);
    assert.doesNotMatch(physical, /�/);
  }
  assert.equal(folded.replace(/\r\n /g, ""), `DESCRIPTION:${"焼鳥".repeat(60)}`);
  assert.equal(foldIcsLine("SHORT:ok"), "SHORT:ok");
});

test("the calendar holds one confirmed event with a stable UID", () => {
  const ics = buildBookingIcs(event(), now);

  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.doesNotMatch(ics.replace(/\r\n/g, ""), /\n/);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.match(ics, /\r\nUID:booking-11111111-2222-3333-4444-555555555555@gourmet-diary-pr-os\r\n/);
  assert.match(ics, /\r\nDTSTAMP:20261004T000000Z\r\n/);
  assert.match(ics, /\r\nDTSTART:20261010T100000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261010T113000Z\r\n/);
  assert.match(ics, /\r\nDESCRIPTION:秋のおまかせPR\\n来店人数: 2名\r\n/);
  assert.match(ics, /\r\nSTATUS:CONFIRMED\r\n/);

  // Same booking downloaded again (e.g. after a reschedule) keeps its UID.
  const again = buildBookingIcs(event({ startsAt: "2026-10-11T10:00:00Z", endsAt: "2026-10-11T11:00:00Z" }), now);
  assert.equal(again.match(/UID:[^\r]+/)[0], ics.match(/UID:[^\r]+/)[0]);
});

test("empty location and url are omitted; reversed ranges are rejected", () => {
  const ics = buildBookingIcs(event({ location: "", url: "" }), now);
  assert.doesNotMatch(ics, /LOCATION:/);
  assert.doesNotMatch(ics, /\r\nURL:/);
  assert.throws(
    () => buildBookingIcs(event({ endsAt: "2026-10-10T10:00:00Z" }), now),
    /invalid_calendar_range/,
  );
});

test("the file name uses the Tokyo visit date", () => {
  // 08:00 JST is still the previous day in UTC.
  assert.equal(bookingIcsFilename("2026-10-09T23:00:00Z"), "gourmet-pr-20261010.ics");
});

test("calendar export reads through RLS and leaves money out", async () => {
  const query = await readFile("server/queries/booking-calendar.ts", "utf8");
  const route = await readFile("app/bookings/[id]/calendar.ics/route.ts", "utf8");

  // The viewer's own session client, never the service-role admin client.
  assert.match(query, /from "@\/lib\/supabase\/server"/);
  assert.doesNotMatch(query + route, /supabase\/admin|createAdminClient|SERVICE_ROLE/);
  assert.match(query, /auth\.getUser\(\)/);
  assert.match(query, /isCalendarExportable/);
  // Rewards, fees and payment state never reach a calendar file.
  assert.doesNotMatch(query, /cash_reward|payments|platform_fee|amount/);

  assert.match(route, /text\/calendar; charset=utf-8/);
  assert.match(route, /private, no-store/);
  assert.match(route, /status: 404/);
});
