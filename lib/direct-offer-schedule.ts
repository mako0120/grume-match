function japanLocalDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("invalid_japan_local_datetime");
  }

  const date = new Date(value + ":00+09:00");

  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_japan_local_datetime");
  }

  return date.toISOString();
}

export type DirectOfferSlot = {
  starts_at: string;
  ends_at: string;
  capacity: number;
};

export type DirectOfferSchedule = {
  slots: DirectOfferSlot[];
  visitStart: string;
  visitEnd: string;
  deadlineIso: string;
};

export function buildDirectOfferSchedule(
  candidateLocalDateTimes: string[],
  durationMinutes = 120,
  now = new Date(),
): DirectOfferSchedule {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("invalid_duration");
  }

  const unique = [...new Set(candidateLocalDateTimes.map((v) => v.trim()).filter(Boolean))];

  if (unique.length < 1 || unique.length > 3) {
    throw new Error("candidate_count_must_be_1_to_3");
  }

  const parsed = unique
    .map((local) => ({
      local,
      startsAt: japanLocalDateTimeToIso(local),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const nowMs = now.getTime();
  if (parsed.some((item) => new Date(item.startsAt).getTime() <= nowMs + 30 * 60_000)) {
    throw new Error("candidate_must_be_future");
  }

  const slots = parsed.map((item) => {
    const startMs = new Date(item.startsAt).getTime();
    return {
      starts_at: item.startsAt,
      ends_at: new Date(startMs + durationMinutes * 60_000).toISOString(),
      capacity: 1,
    };
  });

  const visitDates = parsed.map((item) => item.local.slice(0, 10));
  const earliestMs = new Date(parsed[0].startsAt).getTime();
  const sixHoursBefore = earliestMs - 6 * 60 * 60_000;
  const minimumResponseWindow = nowMs + 30 * 60_000;
  const deadlineMs = Math.max(sixHoursBefore, minimumResponseWindow);

  if (deadlineMs >= earliestMs) {
    throw new Error("candidate_too_soon");
  }

  return {
    slots,
    visitStart: visitDates[0],
    visitEnd: visitDates[visitDates.length - 1],
    deadlineIso: new Date(deadlineMs).toISOString(),
  };
}
