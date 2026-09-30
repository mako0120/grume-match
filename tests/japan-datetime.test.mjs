import assert from "node:assert/strict";
import test from "node:test";
import { japanLocalDateTimeToIso } from "../lib/japan-datetime.ts";

test("converts Japan local datetime to UTC ISO without server timezone ambiguity", () => {
  assert.equal(
    japanLocalDateTimeToIso("2026-10-05T18:00"),
    "2026-10-05T09:00:00.000Z",
  );
});

test("rejects incomplete local datetime", () => {
  assert.throws(
    () => japanLocalDateTimeToIso("2026-10-05"),
    /invalid_japan_local_datetime/,
  );
});
