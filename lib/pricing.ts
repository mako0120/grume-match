// GOURMET DIARY pricing (decided 2026-10-03, see docs/BUSINESS_MODEL_ANALYSIS.md):
// no setup or monthly fee; a platform fee only when a PR is completed
// (the post is approved). The Creator always receives the full reward.
// Same formula as public.platform_fee_for() in the database.

export const PLATFORM_FEE_RATE = 0.2;
export const PLATFORM_FEE_MINIMUM = 2000;

/**
 * Fee for one completed PR, from what the Restaurant pays the Creator.
 * A meal-only invitation (¥0) pays the minimum.
 */
export function platformFee(creatorPayment: number) {
  return Math.max(Math.round(Math.max(creatorPayment, 0) * PLATFORM_FEE_RATE), PLATFORM_FEE_MINIMUM);
}

/** "¥8,000" or, for a meal-only invitation, "食事招待". */
export function formatReward(cashReward: number) {
  return cashReward > 0 ? `¥${cashReward.toLocaleString("ja-JP")}` : "食事招待";
}

/** What one completed PR costs the Restaurant in total (meal cost aside). */
export function restaurantTotal(creatorPayment: number, waived = false) {
  return creatorPayment + (waived ? 0 : platformFee(creatorPayment));
}

export function formatFeeRule() {
  return `PRが完了した時だけ、報酬の${PLATFORM_FEE_RATE * 100}%（最低¥${PLATFORM_FEE_MINIMUM.toLocaleString("ja-JP")}。食事招待のみは¥${PLATFORM_FEE_MINIMUM.toLocaleString("ja-JP")}）`;
}

export const platformFeeStatusLabels: Record<string, string> = {
  pending: "請求予定",
  invoiced: "請求済み",
  paid: "お支払い済み",
  waived: "無料",
};
