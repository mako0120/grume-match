import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("modern diary interface has one consistent public navigation and mobile CTA", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  const request = read("app/diary/request/page.tsx");
  const header = read("app/diary/components/site-header.tsx");
  const layout = read("app/diary/layout.tsx");
  const css = read("app/diary/modern.css");
  for (const text of [home, services, request]) {
    assert.match(text, /<DiaryHeader/);
    assert.match(text, /id="diary-main"/);
    assert.doesNotMatch(text, /\bCanva\b|www\.canva\.com|DIARY_PORTFOLIO|pagesPerPost|perSlide/i);
  }
  assert.match(home, /<DiaryMobileCTA \/>/);
  assert.match(services, /<DiaryMobileCTA \/>/);
  assert.match(header, /href="#diary-main"/);
  assert.match(header, /currentDiaryPricing\(\)/);
  assert.match(layout, /import "\.\/modern\.css"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /:focus-visible/);
});

test("one Instagram post is the unit, not the number of photos in a carousel", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  const pricing = read("app/diary/components/pricing-panel.tsx");
  const request = read("app/diary/request/page.tsx");
  const logic = read("lib/diary/pricing.ts");
  assert.match(home, /1投稿/);
  assert.match(home, /画像枚数で料金は変わりません/);
  assert.match(services, /フィード投稿1件/);
  assert.match(pricing, /画像枚数による追加料金はありません/);
  assert.match(request, /1投稿/);
  assert.match(logic, /Instagramフィード投稿1件/);
  assert.doesNotMatch(logic, /pricePerPage|pricePerSlide|image_count/);
});

test("public proof is solely Instagram and directs to first-party inquiry routes", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  const portfolio = read("app/diary/components/post-showcase.tsx");
  assert.match(home, /<PostShowcase \/>/);
  assert.match(services, /<PostShowcase \/>/);
  assert.match(portfolio, /www\.instagram\.com\/p\//);
  assert.match(home, /href="\/diary\/request\?intent=consultation"/);
  assert.match(services, /\/diary\/request\?service=/);
});
