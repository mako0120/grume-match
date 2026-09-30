import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignSlots } from "../lib/campaign-slot-builder.ts";

test("builds recurring weekday arrival slots in Asia/Tokyo", () => {
  const slots = buildCampaignSlots({
    startDate: "2026-10-01",
    endDate: "2026-10-07",
    weekdays: [1, 2, 3, 4],
    startTime: "17:00",
    endTime: "21:00",
    intervalMinutes: 30,
    visitDurationMinutes: 120,
    capacity: 1,
  });

  assert.equal(slots.length, 32);
  assert.deepEqual(slots[0], {
    starts_at: "2026-10-01T17:00:00+09:00",
    ends_at: "2026-10-01T19:00:00+09:00",
    capacity: 1,
  });
  assert.equal(slots.at(-1)?.starts_at, "2026-10-07T20:30:00+09:00");
});

test("rejects an invalid arrival time range", () => {
  assert.throws(
    () =>
      buildCampaignSlots({
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        weekdays: [4, 5],
        startTime: "21:00",
        endTime: "17:00",
        intervalMinutes: 30,
        visitDurationMinutes: 120,
        capacity: 1,
      }),
    /invalid_time_range/,
  );
});

test("returns no slots when no selected weekday appears in the date range", () => {
  const slots = buildCampaignSlots({
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    weekdays: [1],
    startTime: "17:00",
    endTime: "21:00",
    intervalMinutes: 30,
    visitDurationMinutes: 120,
    capacity: 1,
  });

  assert.deepEqual(slots, []);
});
