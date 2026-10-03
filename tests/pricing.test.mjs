import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PLATFORM_FEE_MINIMUM, PLATFORM_FEE_RATE, formatReward, platformFee, restaurantTotal } from "../lib/pricing.ts";

test("fee is 20% of the Creator payment, at least ¥2,000", () => {
  assert.equal(platformFee(8000), 2000);
  assert.equal(platformFee(10000), 2000);
  assert.equal(platformFee(15000), 3000);
  assert.equal(platformFee(12345), 2469);
  // Meal-only invitation: the minimum.
  assert.equal(platformFee(0), 2000);
  assert.equal(restaurantTotal(0), 2000);
  assert.equal(restaurantTotal(15000), 18000);
  assert.equal(restaurantTotal(15000, true), 15000);
});

test("meal-only invitations read as 食事招待", () => {
  assert.equal(formatReward(0), "食事招待");
  assert.equal(formatReward(8000), "¥8,000");
});

test("meal-only invitations can be published", async () => {
  const migration = await readFile("supabase/migrations/202610030009_meal_invitations.sql", "utf8");
  assert.match(migration, /drop trigger if exists campaigns_require_positive_cash_reward/);
  assert.match(migration, /when \(new\.amount > 0\)/);
});

test("the database uses the same formula and waives the first PR", async () => {
  const migration = await readFile("supabase/migrations/202610030008_platform_fees.sql", "utf8");
  assert.match(migration, new RegExp(`round\\(greatest\\(coalesce\\(p_amount, 0\\), 0\\) \\* ${PLATFORM_FEE_RATE}\\)::integer, ${PLATFORM_FEE_MINIMUM}\\)`));
  assert.match(migration, /case when v_first then 'waived' else 'pending' end/);
  // Only the Operator changes fee status; there is no write policy.
  assert.doesNotMatch(migration, /create policy[^;]*for (insert|update|delete)/i);
});

test("the landing page states the fee from the same constants", async () => {
  const page = await readFile("app/page.tsx", "utf8");
  assert.match(page, /PLATFORM_FEE_RATE \* 100/);
  assert.match(page, /初期費用・月額 0円/);
});
