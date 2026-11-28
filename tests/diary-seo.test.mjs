import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { diarySiteOrigin, diaryStructuredData, toJsonLd, DIARY_OG_IMAGE } from "../lib/diary/seo.ts";

const read = (path) => readFile(path, "utf8");

test("diary titles use their own template, never the PR OS brand", async () => {
  const layout = await read("app/diary/layout.tsx");
  assert.match(layout, /template: "%s"/);
  assert.match(layout, /default: "グルメ日誌｜大阪グルメ紹介・飲食店のInstagram PR"/);
  assert.doesNotMatch(layout, /GOURMET DIARY PR OS/);
  const home = await read("app/diary/page.tsx");
  assert.match(home, /title: \{ absolute: "グルメ日誌｜大阪グルメ紹介・飲食店のInstagram PR" \}/);
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
  assert.deepEqual(org.sameAs, ["https://www.instagram.com/grunavi_diary/"]);
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

test("the FAQ shown on the page and the FAQ sent to Google come from one list", async () => {
  const { DIARY_FAQS } = await import("../lib/diary/seo.ts");
  const faq = diaryStructuredData("https://example.netlify.app", 8000)["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.equal(faq.mainEntity.length, DIARY_FAQS.length);
  assert.ok(DIARY_FAQS.length >= 5);
  faq.mainEntity.forEach((question, i) => {
    assert.equal(question.name, DIARY_FAQS[i].question);
    assert.equal(question.acceptedAnswer.text, DIARY_FAQS[i].answer);
  });
  const page = await read("app/diary/page.tsx");
  assert.match(page, /DIARY_FAQS\.map\(/);
  assert.doesNotMatch(page, /<details><summary>[^{]/);
});

test("services, request and policy pages share their own title and image", async () => {
  for (const path of ["app/diary/services/page.tsx", "app/diary/request/page.tsx", "app/diary/policy/page.tsx"]) {
    const source = await read(path);
    assert.match(source, /openGraph: \{\n    title: "[^"]+｜グルメ日誌｜大阪"/, path);
    assert.match(source, /images: \[DIARY_OG_IMAGE\]/, path);
  }
});

test("every Instagram link points at the real account @grunavi_diary", async () => {
  const { readdir } = await import("node:fs/promises");
  // The old, non-existent handle sent visitors to "Profile isn't available".
  const stale = [];
  for (const dir of ["app", "lib", "components"]) {
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(tsx?|mjs)$/.test(entry.name)) continue;
      const file = `${entry.parentPath}/${entry.name}`;
      if ((await readFile(file, "utf8")).includes("gurunavi_diary")) stale.push(file);
    }
  }
  assert.deepEqual(stale, []);
  const home = await readFile("app/diary/page.tsx", "utf8");
  assert.match(home, /instagram\.com\/grunavi_diary\//);
});

test("search for 大阪グルメ紹介 or the account name finds this site", async () => {
  const home = await readFile("app/diary/page.tsx", "utf8");
  assert.match(home, /title: \{ absolute: "グルメ日誌｜大阪グルメ紹介[^"]*" \}/);
  assert.match(home, /<h1 id="diary-v2-hero-heading"><span className="diary-v2-hero-kicker">大阪グルメ紹介アカウント「グルメ日誌」<\/span>/);
  const graph = diaryStructuredData("https://example.netlify.app", 8000)["@graph"];
  const site = graph.find((node) => node["@type"] === "WebSite");
  assert.equal(site.name, "グルメ日誌");
  assert.ok(site.alternateName.includes("grunavi_diary"));
  assert.ok(graph[0].alternateName.includes("グルメ日誌"));
});
