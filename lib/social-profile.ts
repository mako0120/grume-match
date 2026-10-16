const SOCIAL_HOSTS: Record<string, Set<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com"]),
  youtube: new Set(["youtube.com", "www.youtube.com"]),
};

export function normalizeSocialHandle(value: string) {
  return value.trim().replace(/^@/, "");
}

export function validSocialHandle(value: string) {
  return (
    value.length > 0 &&
    value.length <= 100 &&
    !/[\s/]/.test(value)
  );
}

export function validSocialProfileUrl(platform: string, value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(SOCIAL_HOSTS[platform]?.has(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

export function boundedMetric(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(2_000_000_000, Math.floor(parsed));
}
