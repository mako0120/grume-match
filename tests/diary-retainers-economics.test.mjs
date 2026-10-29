import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateDiaryMonthlyProfit, DEFAULT_DIARY_PROFIT_SCENARIO,
  DIARY_RETAINER_PLANS, DIARY_RETAINER_COMMON_CONDITIONS, retainerPlan,
} from "../lib/diary/retainers.ts";
import { validateDiaryInquiry } from "../lib/diary/inquiry.ts";

test("published recurring PR plans have explicit content limits and no unlimited deliverables", () => {
  assert.deepEqual(DIARY_RETAINER_PLANS.map(p => p.id), ["monthly_photo", "monthly_growth"]);
  assert.deepEqual(DIARY_RETAINER_PLANS.map(p => p.priceYenInclTax), [29800, 49800]);
  assert.ok(DIARY_RETAINER_COMMON_CONDITIONS.some(p => p.includes("自動課金は発生しません")));
  assert.ok(DIARY_RETAINER_COMMON_CONDITIONS.some(p => p.includes("二次利用")));
  assert.ok(DIARY_RETAINER_PLANS.every(p => p.estimatedOwnerHours > 0 &&
    p.estimatedOutOfPocketYen >= 0 && p.features.length === 4));
  assert.equal(retainerPlan("monthly_growth")?.priceYenInclTax, 49800);
  assert.equal(retainerPlan("unlimited_review"), null);
});

test("default scenario hits 300k monthly sales without mistaking it for net profit", () => {
  const e = calculateDiaryMonthlyProfit(DEFAULT_DIARY_PROFIT_SCENARIO);
  assert.equal(e.recurringContracts, 7);
  assert.equal(e.recurringSalesInclTaxYen, 288600);
  assert.equal(e.monthlySalesInclTaxYen, 303600);
  assert.equal(e.netRevenueYen, 276000);
  assert.equal(e.estimatedTaxIncludedYen, 27600);
  assert.equal(e.directCostsYen, 28500);
  assert.equal(e.ownerHours, 56);
  assert.equal(e.ownerLaborCostYen, 112000);
  assert.equal(e.fixedMonthlyExpenseYen, 15000);
  assert.equal(e.operatingSurplusAfterOwnerLaborYen, 120500);
  assert.equal(e.operatingMarginPercent, 43.7);
});

test("zero contracts are zero profit minus fixed monthly costs, losses are NOT masked", () => {
  const e = calculateDiaryMonthlyProfit({
    ...DEFAULT_DIARY_PROFIT_SCENARIO,
    monthlyPhoto: 0, monthlyGrowth: 0, oneOffVideo: 0,
  });
  assert.equal(e.netRevenueYen, 0);
  assert.equal(e.recurringSalesInclTaxYen, 0);
  assert.equal(e.operatingSurplusAfterOwnerLaborYen, -15000);
  assert.equal(e.operatingMarginPercent, 0);
});

test("exempt scenario and fee/cost changes shift expected profit correctly", () => {
  const a = calculateDiaryMonthlyProfit(DEFAULT_DIARY_PROFIT_SCENARIO);
  const b = calculateDiaryMonthlyProfit({ ...DEFAULT_DIARY_PROFIT_SCENARIO, taxable: false });
  assert.equal(b.netRevenueYen, b.monthlySalesInclTaxYen);
  assert.equal(b.operatingSurplusAfterOwnerLaborYen - a.operatingSurplusAfterOwnerLaborYen, 27600);
  const c = calculateDiaryMonthlyProfit({ ...DEFAULT_DIARY_PROFIT_SCENARIO, hourlyOwnerCostYen: 3000 });
  assert.equal(c.operatingSurplusAfterOwnerLaborYen, a.operatingSurplusAfterOwnerLaborYen - 56000);
});

test("invalid, unsafe or impossible scenario values are rejected before calculation", () => {
  for (const sample of [-1, 1.5, NaN, Infinity, 1000000000]) {
    assert.throws(() => calculateDiaryMonthlyProfit({
      ...DEFAULT_DIARY_PROFIT_SCENARIO, monthlyGrowth: sample,
    }));
  }
  assert.throws(() => calculateDiaryMonthlyProfit({
    ...DEFAULT_DIARY_PROFIT_SCENARIO, taxable: "maybe",
  }));
});

test("both monthly plans are accepted as first-party inquiries but not review incentives", () => {
  const base = {
    inquiry_kind: "application",
    desired_coverage: "新メニューを毎月Instagramで紹介したいです",
    restaurant_name: "テスト店",
    contact_name: "担当者",
    email: "test@example.com",
    service: "monthly_photo",
    budget: "30000_50000",
    message: "新商品を毎月写真でPRしてほしいです",
    consent: true,
    compliance_confirmed: true,
  };
  for (const service of ["monthly_photo", "monthly_growth"]) {
    assert.equal(validateDiaryInquiry({ ...base, service }).ok, true, service);
    assert.equal(validateDiaryInquiry({ ...base, service, message: "Googleマップへ有料口コミをお願い" }).ok, false);
  }
});

test("public inquiry works through Netlify Forms, direct API and Instagram DM fallback", () => {
  const netlify = readFileSync("app/diary/components/netlify-inquiry-form.tsx", "utf8");
  const api = readFileSync("app/diary/components/inquiry-form.tsx", "utf8");
  const dm = readFileSync("lib/diary/dm-template.ts", "utf8");
  const ops = readFileSync("app/diary/ops/components/diary-ops-console.tsx", "utf8");
  const page = readFileSync("app/diary/services/page.tsx", "utf8");
  for (const id of ["monthly_photo", "monthly_growth"]) {
    assert.ok(netlify.includes(id));
    assert.ok(api.includes(id));
    assert.ok(dm.includes(id));
    assert.ok(ops.includes(id));
  }
  assert.match(page,/DiaryRetainerPricing/);
  assert.match(netlify,/DIARY_RETAINER_PLANS/);
  assert.match(api,/DIARY_RETAINER_PLANS/);
  assert.match(ops,/DiaryProfitPlanner/);
});

test("new contract consultation does not create an unconsented recurring charge", () => {
  const plans = readFileSync("app/diary/components/retainer-pricing.tsx", "utf8");
  assert.match(plans,/契約\/決済ではない|NOT checkout/);
  assert.doesNotMatch(plans,/createCheckout|createSubscription|paymentIntent|automaticCharge/);
  assert.match(plans,/intent=application/);
});
