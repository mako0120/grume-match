import assert from "node:assert/strict";
import test from "node:test";

function generateTimeLabels({ startMinutes, endMinutes, intervalMinutes }) {
  if (intervalMinutes <= 0) throw new Error("intervalMinutes must be greater than zero");
  if (endMinutes <= startMinutes) throw new Error("endMinutes must be after startMinutes");

  const labels = [];
  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return labels;
}

test("17:00-21:00 generates 30 minute slots", () => {
  assert.deepEqual(
    generateTimeLabels({
      startMinutes: 17 * 60,
      endMinutes: 21 * 60,
      intervalMinutes: 30,
    }),
    ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"],
  );
});

test("invalid interval is rejected", () => {
  assert.throws(
    () =>
      generateTimeLabels({
        startMinutes: 17 * 60,
        endMinutes: 21 * 60,
        intervalMinutes: 0,
      }),
    /greater than zero/,
  );
});
