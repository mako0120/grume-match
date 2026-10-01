import assert from "node:assert/strict";
import test from "node:test";
import { buildFlashTiming } from "../lib/flash-timing.ts";

test("FLASH automatically closes 30 minutes before the visit", () => {
  const timing = buildFlashTiming(
    "2026-10-05T19:00",
    new Date("2026-10-05T08:00:00.000Z"),
  );

  assert.equal(timing.startsAtIso, "2026-10-05T10:00:00.000Z");
  assert.equal(timing.deadlineIso, "2026-10-05T09:30:00.000Z");
});

test("FLASH requires at least 60 minutes notice", () => {
  assert.throws(
    () =>
      buildFlashTiming(
        "2026-10-05T19:00",
        new Date("2026-10-05T09:15:00.000Z"),
      ),
    /flash_requires_60_minutes_notice/,
  );
});
