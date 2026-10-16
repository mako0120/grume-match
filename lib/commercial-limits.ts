export const COMMERCIAL_LIMITS = {
  cashRewardYen: 1_000_000,
  creatorSlots: 50,
  companions: 10,
  campaignDescription: 5_000,
  category: 100,
  foodOffer: 1_000,
  note: 2_000,
  visitDurationMinutes: 12 * 60,
} as const;

export const SUPPORTED_CAMPAIGN_PLATFORMS = new Set([
  "instagram_feed",
  "instagram_reel",
  "instagram_story",
  "tiktok",
  "youtube_shorts",
  "ugc_photo",
  "ugc_video",
]);

export function validReward(value: number) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= COMMERCIAL_LIMITS.cashRewardYen
  );
}

export function validCreatorSlots(value: number) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= COMMERCIAL_LIMITS.creatorSlots
  );
}

export function validCompanions(value: number) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= COMMERCIAL_LIMITS.companions
  );
}

export function validVisitDuration(value: number) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= COMMERCIAL_LIMITS.visitDurationMinutes
  );
}

export function validText(value: string, max: number, required = false) {
  if (required && !value) return false;
  return value.length <= max;
}

export function validPlatforms(platforms: string[]) {
  return (
    platforms.length > 0 &&
    platforms.every((platform) => SUPPORTED_CAMPAIGN_PLATFORMS.has(platform))
  );
}
