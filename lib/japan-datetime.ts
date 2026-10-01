export function japanLocalDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("invalid_japan_local_datetime");
  }

  const date = new Date(`${value}:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_japan_local_datetime");
  }

  return date.toISOString();
}
