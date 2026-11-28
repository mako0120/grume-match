import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { diarySiteOrigin, diaryStructuredData, toJsonLd, DIARY_OG_IMAGE } from "../lib/diary/seo.ts";

const read = (path) => readFile(path, "utf8");

test("diary titles use their own template, never the PR OS brand", async () => {
  const layout = await read("app/diary/layout.tsx");
  assert.match(layout, /template: "%s"/);
  assert.match(layout, /default: "大阪の飲食店PR・Instagram撮影｜グルメ日誌｜大阪"/);
  assert.doesNotMatch(layout, /GOURMET DIARY PR OS/);
  const home = await read("app/diary/page.tsx");
  assert.match(home, /title: \{ absolute: "大阪の飲食店PR・Instagram撮影｜グルメ日誌｜大阪" \}/);
  // Indexing stays behind its own launch flag.
  assert.match(layout, /index: process\.env\.DIARY_PUBLIC_INDEX_ENABLED === "true"/);
});

test("every public diary page declares its canonical URL", async () => {
  for (const [path, canonical] of [
    ["app/diary/page.tsx", "/diary"],
    ["app/diary/pr/page.tsx", "/diary/pr"],
    ["app/diary/services/page.tsx", "/diary/services"],
    ["app/diary/request/page.tsx", "/diary/request"],
    ["app/diary/policy/page.tsx", "/diary/policy"],
  ]) {
    assert.match(await read(path), new RegExp(`canonical: "${canonical}"`), path);
  }
});

test("the share image exists at the advertised size", async () => {
  const file = await stat("public" + DIARY_OG_IMAGE.url);
  assert.ok(file.size > 10_000 && file.size < 400_000);
  assert.equal(DIARY_OG_IMAGE.width, 1200);
  assert.equal(DIARY_OG_IMAGE.height, 630);
});

test("structured data states only facts shown on the page", () => {
  const origin = diarySiteOrigin("https://example.netlify.app/");
  assert.equal(origin, "https://example.netlify.app");
  assert.equal(diarySiteOrigin("http://insecure.example"), null);
  assert.equal(diarySiteOrigin(undefined), null);

  const data = diaryStructuredData(origin, 8000);
  const [org, service] = data["@graph"];
  assert.equal(org["@type"], "Organization");
  assert.deepEqual(org.sameAs, ["https://www.instagram.com/gurunavi_diary/"]);
  assert.equal(service.areaServed.name, "大阪府");
  assert.equal(service.offers.price, 8000);
  assert.equal(service.offers.priceCurrency, "JPY");
  const json = JSON.stringify(data);
  assert.doesNotMatch(json, /aggregateRating|review|address|telephone/i);

  // Without a site URL there are no relative or broken absolute links.
  assert.doesNotMatch(JSON.stringify(diaryStructuredData(null, 8000)), /"url":"\//);
  assert.equal(toJsonLd({ a: "</script>" }), '{"a":"\\u003c/script>"}');
});

test("the PR landing page is in the sitemap once diary indexing is on", async () => {
  const sitemap = await read("app/sitemap.ts");
  const diaryBlock = sitemap.slice(sitemap.indexOf("diaryPublic\n"), sitemap.indexOf("marketplacePublic\n      ?"));
  assert.match(diaryBlock, /\["\/diary\/pr", "monthly", 0\.9\]/);
});
