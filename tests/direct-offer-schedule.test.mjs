import assert from "node:assert/strict";
import test from "node:test";
import { buildDirectOfferSchedule } from "../lib/direct-offer-schedule.ts";

test("builds a simple direct offer from exact candidate times", () => {
  const schedule = buildDirectOfferSchedule(
    ["2026-10-05T19:00", "2026-10-07T20:00"],
    120,
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.equal(schedule.slots.length, 2);
  assert.equal(schedule.visitStart, "2026-10-05");
  assert.equal(schedule.visitEnd, "2026-10-07");
  assert.equal(schedule.slots[0].starts_at, "2026-10-05T10:00:00.000Z");
  assert.equal(schedule.slots[0].ends_at, "2026-10-05T12:00:00.000Z");
  assert.equal(schedule.deadlineIso, "2026-10-05T04:00:00.000Z");
});

test("deduplicates identical direct-offer candidate times", () => {
  const schedule = buildDirectOfferSchedule(
    ["2026-10-05T19:00", "2026-10-05T19:00"],
    90,
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.equal(schedule.slots.length, 1);
});

test("requires one to three candidate times", () => {
  assert.throws(
    () => buildDirectOfferSchedule([], 120, new Date("2026-10-01T00:00:00.000Z")),
    /candidate_count_must_be_1_to_3/,
  );

  assert.throws(
    () =>
      buildDirectOfferSchedule(
        [
          "2026-10-05T19:00",
          "2026-10-06T19:00",
          "2026-10-07T19:00",
          "2026-10-08T19:00",
        ],
        120,
        new Date("2026-10-01T00:00:00.000Z"),
      ),
    /candidate_count_must_be_1_to_3/,
  );
});
