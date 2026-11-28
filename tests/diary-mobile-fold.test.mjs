import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const FOLDED = ["consultation-themes", "results", "work", "services", "philosophy", "flow", "faq"];

test("phone visitors can open only the sections they want", async () => {
  const page = await readFile("app/diary/page.tsx", "utf8");
  for (const id of FOLDED) {
    assert.match(page, new RegExp(`<MobileFold id="${id}" title="[^"]+">`), id);
  }
  assert.equal(page.match(/<MobileFold /g)?.length, FOLDED.length);
  assert.equal(page.match(/<\/MobileFold>/g)?.length, FOLDED.length);
  // The hero, price ribbon and closing CTA always stay visible.
  assert.doesNotMatch(page.slice(0, page.indexOf('id="consultation-themes"')), /<MobileFold/);
});

test("the fold is an accessible toggle that links can open", async () => {
  const fold = await readFile("app/diary/components/mobile-fold.tsx", "utf8");
  assert.match(fold, /type="button"/);
  assert.match(fold, /aria-expanded=\{open\}/);
  assert.match(fold, /aria-controls=\{bodyId\}/);
  assert.match(fold, /hashchange/);
  assert.match(fold, /link\.hash === `#\$\{id\}`/);
});

test("only phones fold; wider screens keep the original layout", async () => {
  const css = await readFile("app/diary/modern.css", "utf8");
  assert.match(css, /\.diary-fold-toggle \{ display: none; \}/);
  assert.match(css, /\.diary-fold-body \{ display: contents; \}/);
  const phone = css.slice(css.lastIndexOf("@media (max-width: 700px)"));
  assert.match(phone, /\.diary-fold-body\[data-open="false"\] \{ display: none; \}/);
});
