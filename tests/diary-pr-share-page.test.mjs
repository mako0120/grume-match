import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/diary/pr/page.tsx", "utf8");
const css = readFileSync("app/diary/pr/pr.css", "utf8");
const pricing = readFileSync("lib/diary/pricing.ts", "utf8");

test("public share route is dedicated to one-off PR and never promotes rejected retainers", () => {
  assert.match(page, /function DiaryOneOffPrPage/);
  assert.match(page, /1案件・1投稿から/);
  assert.match(page, /月額契約・自動更新・自動課金はありません/);
  assert.doesNotMatch(page, /29,800|49,800|monthly_photo|monthly_growth|毎月フォトPR/);
  assert.match(page, /canonical: "\/diary\/pr"/);
  assert.match(page, /openGraph/);
});

test("share page uses agreed, versioned pricing instead of a second hardcoded amount", () => {
  assert.match(page, /currentDiaryPricing\(\)/);
  assert.match(page, /videoIncludedPriceForFollowers\(pricing\.followers\)/);
  assert.match(page, /formatDiaryYen\(pricing\.amountYen\)/);
  assert.match(pricing, /amountYen: 8000/);
  assert.match(pricing, /DIARY_VIDEO_PACKAGE_START_YEN = 15000/);
});

test("both application CTAs lead to existing first-party form by correct service code", () => {
  assert.match(page, /\/diary\/request\?service=instagram_feed&intent=application/);
  assert.match(page, /\/diary\/request\?service=instagram_feed_video&intent=application/);
  assert.match(page, /\/diary\/request\?intent=consultation/);
  assert.match(page, /instagram\.com\/gurunavi_diary/);
  assert.match(page, /<PostShowcase \/>/);
});

test("public copy is not misleading about publishing, consent and reviews", () => {
  assert.match(page, /相談・見積もり無料/);
  assert.match(page, /料金は事前に合意/);
  assert.match(page, /食べログ/);
  assert.match(page, /PR表示/);
  assert.match(page, /売上は保証するものではありません/);
  assert.doesNotMatch(page, /フォロワー[0-9]|来店保証|月商30万|営業成績/);
});

test("mobile, keyboard focus and reduced motion are covered by scoped design", () => {
  assert.match(css, /diary-pr-page/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(page, /<DiaryHeader/);
  assert.match(page, /<DiaryMobileCTA/);
});
