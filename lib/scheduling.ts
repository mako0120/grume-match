export type TimeRange = {
  startMinutes: number;
  endMinutes: number;
  intervalMinutes: number;
};

export function generateTimeLabels({
  startMinutes,
  endMinutes,
  intervalMinutes,
}: TimeRange): string[] {
  if (intervalMinutes <= 0) {
    throw new Error("intervalMinutes must be greater than zero");
  }
  if (endMinutes <= startMinutes) {
    throw new Error("endMinutes must be after startMinutes");
  }

  const labels: string[] = [];

  for (
    let minutes = startMinutes;
    minutes < endMinutes;
    minutes += intervalMinutes
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    labels.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  }

  return labels;
}
