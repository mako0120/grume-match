import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIARY_CAROUSEL_PRICE_GUIDE, DIARY_PORTFOLIO } from "../lib/diary/portfolio.ts";

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
  assert.deepEqual(DIARY_CAROUSEL_PRICE_GUIDE.map((tier) => tier.max), [18000, 25000, 30000]);
  assert.ok(DIARY_CAROUSEL_PRICE_GUIDE.every((tier) => tier.min >= 18000 && tier.max >= tier.min));
});
