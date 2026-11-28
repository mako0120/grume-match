import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { priceForFollowers, pricingSnapshot, DIARY_PR_PRICE_TIERS, videoIncludedPriceForFollowers, priceForDiaryService } from "../lib/diary/pricing.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public portfolio is Instagram only: no editing links or internal templates exposed", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  const pricing = read("app/diary/components/pricing-panel.tsx");
  const posts = read("app/diary/components/post-showcase.tsx");
  const publicSources = home + services + pricing + posts;
  assert.doesNotMatch(publicSources, /canva|viewUrl|DIARY_PORTFOLIO|carousel-portfolio|DAHX|canva\.link/i);
  assert.match(home, /<PostShowcase \/>/);
  assert.match(services, /<PostShowcase \/>/);
  assert.match(services, /<DiaryPricingPanel \/>/);
  assert.match(pricing, /formatDiaryYen\(price\.amountYen\)/);
  assert.match(posts, /www\.instagram\.com\/p\//);
  assert.match(services, /\/diary\/request/);
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

test("photo and video package public price floors are respected", () => {
  assert.equal(priceForDiaryService("instagram_feed", 5000), 8000);
  assert.equal(priceForDiaryService("instagram_feed_video", 5000), 15000);
  assert.equal(priceForDiaryService("instagram_feed_video", 7500), 17000);
  assert.equal(videoIncludedPriceForFollowers(10000), 19000);
  assert.equal(priceForDiaryService("instagram_reel", 5000), null);
});
