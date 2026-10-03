import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("landing page states the differences without naming competitors", async () => {
  const [page, analysis] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("docs/COMPETITIVE_ANALYSIS.md", "utf8"),
  ]);

  for (const topic of ["Creatorへの対価", "日程調整", "Creatorの選び方", "実績の信頼性", "効果測定", "写真・動画の二次利用"]) {
    assert.match(page, new RegExp(topic));
  }

  // Competitors are compared in the internal doc only.
  for (const name of ["ユニット", "QUANT", "モグカツ", "FOODee", "tags-Restaurant", "グルキャス"]) {
    assert.doesNotMatch(page, new RegExp(name));
    assert.match(analysis, new RegExp(name));
  }
});
