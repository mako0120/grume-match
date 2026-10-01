type SlotInput = {
  starts_at: string;
  ends_at: string;
  capacity: number;
};

type BuildCampaignSlotsInput = {
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  visitDurationMinutes: number;
  capacity: number;
};

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("invalid_date");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("invalid_time");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("invalid_time");
  return hour * 60 + minute;
}

function toDateString(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function toTimeString(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function buildCampaignSlots(input: BuildCampaignSlotsInput): SlotInput[] {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const startTimeMinutes = parseTime(input.startTime);
  const endTimeMinutes = parseTime(input.endTime);

  if (input.intervalMinutes <= 0 || input.visitDurationMinutes <= 0) {
    throw new Error("invalid_interval");
  }
  if (endTimeMinutes <= startTimeMinutes) {
    throw new Error("invalid_time_range");
  }
  if (input.capacity <= 0) {
    throw new Error("invalid_capacity");
  }

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  if (endUtc < startUtc) throw new Error("invalid_date_range");

  const allowedWeekdays = new Set(input.weekdays);
  const slots: SlotInput[] = [];

  for (let cursor = startUtc; cursor <= endUtc; cursor += 86_400_000) {
    const date = new Date(cursor);
    if (!allowedWeekdays.has(date.getUTCDay())) continue;

    const dateLabel = toDateString(date);

    for (
      let time = startTimeMinutes;
      time < endTimeMinutes;
      time += input.intervalMinutes
    ) {
      const endVisit = time + input.visitDurationMinutes;
      if (endVisit > 24 * 60) continue;

      slots.push({
        starts_at: `${dateLabel}T${toTimeString(time)}:00+09:00`,
        ends_at: `${dateLabel}T${toTimeString(endVisit)}:00+09:00`,
        capacity: input.capacity,
      });
    }
  }

  return slots;
}
