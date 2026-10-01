export type FlashTiming = {
  startsAtIso: string;
  deadlineIso: string;
};

export function buildFlashTiming(
  localStartsAt: string,
  now = new Date(),
): FlashTiming {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localStartsAt)) {
    throw new Error("invalid_flash_datetime");
  }

  const startsAt = new Date(localStartsAt + ":00+09:00");
  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("invalid_flash_datetime");
  }

  const diffMs = startsAt.getTime() - now.getTime();

  if (diffMs < 60 * 60_000) {
    throw new Error("flash_requires_60_minutes_notice");
  }

  return {
    startsAtIso: startsAt.toISOString(),
    deadlineIso: new Date(startsAt.getTime() - 30 * 60_000).toISOString(),
  };
}
