/**
 * First-party グルメ日誌 direct PR pricing.
 * This is an operator's proposed future price ladder, not an automatic
 * Instagram API integration or a binding quotation.
 *
 * The owner verifies follower totals and updates DIARY_VERIFIED_FOLLOWERS.
 * Pricing changes apply to NEW inquiries only; agreed contracts never change.
 */
export const DIARY_PR_PRICE_TIERS = [
  { minFollowers: 0, amountYen: 8000 },
  { minFollowers: 7500, amountYen: 10000 },
  { minFollowers: 10000, amountYen: 12000 },
  { minFollowers: 15000, amountYen: 16000 },
  { minFollowers: 20000, amountYen: 20000 },
] as const;

export const DIARY_BASE_POST_DESCRIPTION =
  "Instagramフィード投稿1件（店舗訪問、撮影、画像編集、紹介文、適切なPR表記・投稿）";

export type DiaryPriceSnapshot = {
  followers: number;
  amountYen: number;
  nextMilestone: number | null;
  nextAmountYen: number | null;
  asOf: string;
};

export function priceForFollowers(followers: number): number {
  if (!Number.isSafeInteger(followers) || followers < 0) {
    throw new Error("Invalid verified follower count");
  }
  let amount: number = DIARY_PR_PRICE_TIERS[0].amountYen;
  for (const tier of DIARY_PR_PRICE_TIERS) {
    if (followers >= tier.minFollowers) amount = tier.amountYen;
  }
  return amount;
}

export function pricingSnapshot(followers: number, asOf: string): DiaryPriceSnapshot {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error("Invalid follower verification date");
  }
  const next = DIARY_PR_PRICE_TIERS.find((tier) => tier.minFollowers > followers);
  return {
    followers,
    amountYen: priceForFollowers(followers),
    nextMilestone: next?.minFollowers ?? null,
    nextAmountYen: next?.amountYen ?? null,
    asOf,
  };
}

export function currentDiaryPricing(): DiaryPriceSnapshot {
  // Fallback reflects the dated owner's self-reported ~5k followers.
  // The owner MUST replace these with verified numbers before going live.
  const envFollowers = process.env.DIARY_VERIFIED_FOLLOWERS ?? "5000";
  const count = Number(envFollowers);
  const asOf = process.env.DIARY_FOLLOWERS_VERIFIED_AT ?? "2026-10-16";
  if (!/^\d+$/.test(envFollowers) || !Number.isSafeInteger(count)) {
    throw new Error("Invalid DIARY_VERIFIED_FOLLOWERS configuration");
  }
  return pricingSnapshot(count, asOf);
}

export function formatDiaryYen(amountYen: number): string {
  return amountYen.toLocaleString("ja-JP") + "円";
}
