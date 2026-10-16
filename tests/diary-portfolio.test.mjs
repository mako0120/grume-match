import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIARY_PORTFOLIO } from "../lib/diary/portfolio.ts";
import { priceForFollowers, pricingSnapshot, DIARY_PR_PRICE_TIERS } from "../lib/diary/pricing.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("exactly three operator-provided Canva designs have verified IDs and page counts", () => {
  assert.deepEqual(
    DIARY_PORTFOLIO.map(({ id, name, pages }) => ({ id, name, pages })),
    [
      { id: "DAHX3RmQv9A", name: "北浜 焼とりporc", pages: 20 },
      { id: "DAHWjXqkIUg", name: "銀蔵 小野原本店", pages: 16 },
      { id: "DAHVJGkwLVk", name: "煮炊き焼き鳥 御尽", pages: 10 },
    ],
  );
});
test("public portfolio links use only read-only Canva view URLs", () => {
  for (const work of DIARY_PORTFOLIO) {
    assert.match(work.viewUrl, /^https:\/\/www\.canva\.com\/d\/[A-Za-z0-9_-]+$/);
    assert.doesNotMatch(work.viewUrl, /\/edit|utm_|token/i);
  }
  const component = read("app/diary/components/canva-portfolio.tsx");
  assert.match(component, /rel="noopener noreferrer"/);
  assert.match(component, /すべてを有償PR実績とするものではありません/);
  assert.match(component, /実際のCanva制作物を見る/);
});
test("editorial portfolio and price guide are visible before the direct inquiry", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  assert.match(home, /<CanvaPortfolio \/>/);
  assert.match(services, /<CanvaPortfolio pricing \/>/);
  assert.match(services, /\/diary\/request/);
  const component = read("app/diary/components/canva-portfolio.tsx");
  assert.match(component, /formatDiaryYen\(price\.amountYen\)/);
  assert.match(component, /DIRECT PR PRICE/);
  assert.doesNotMatch(component, /DIARY_CAROUSEL_PRICE_GUIDE/);
  assert.equal(priceForFollowers(5000), 8000);
});

test("future prices increase only at verified follower thresholds", () => {
  assert.deepEqual(DIARY_PR_PRICE_TIERS.map(({ minFollowers, amountYen }) => [minFollowers, amountYen]), [
    [0, 8000], [7500, 10000], [10000, 12000], [15000, 16000], [20000, 20000]
  ]);
  for (const [followers, expected] of [
    [0, 8000], [5000, 8000], [7499, 8000], [7500, 10000],
    [9999, 10000], [10000, 12000], [15000, 16000], [20000, 20000], [40000, 20000],
  ]) assert.equal(priceForFollowers(followers), expected, String(followers));
  assert.throws(() => priceForFollowers(-1));
  assert.throws(() => priceForFollowers(5000.5));
});

test("snapshot contains price and upcoming follower milestone", () => {
  assert.deepEqual(pricingSnapshot(5000, "2026-10-16"), {
    followers: 5000, amountYen: 8000, nextMilestone: 7500,
    nextAmountYen: 10000, asOf: "2026-10-16",
  });
  assert.equal(pricingSnapshot(20000, "2026-10-16").nextMilestone, null);
});

test("app saves price and follower snapshot server-side on new inquiry", () => {
  const api = read("app/api/diary/inquiries/route.ts");
  const schema = read("supabase/migrations/202610160002_diary_direct_inquiries.sql");
  const admin = read("app/admin/diary-inquiries/page.tsx");
  assert.match(api, /const pricing = currentDiaryPricing\(\)/);
  assert.match(api, /post_price_reference_yen/);
  assert.match(api, /followers_at_inquiry/);
  assert.match(schema, /post_price_reference_yen integer/);
  assert.match(admin, /申込み時の基本料金/);
  assert.doesNotMatch(api, /payload\.post_price_reference_yen/);
});
