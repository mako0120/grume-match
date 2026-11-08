import test from "node:test";
import assert from "node:assert/strict";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";

test("PR-only launch remains discoverable without exposing marketplace routes", () => {
  const previous = {
    PUBLIC_LAUNCH_ENABLED: process.env.PUBLIC_LAUNCH_ENABLED,
    DIARY_PUBLIC_INDEX_ENABLED: process.env.DIARY_PUBLIC_INDEX_ENABLED,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
  try {
    delete process.env.PUBLIC_LAUNCH_ENABLED;
    delete process.env.DIARY_PUBLIC_INDEX_ENABLED;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.netlify.app";
    assert.equal(robots().rules.disallow, "/");
    assert.deepEqual(sitemap(), []);

    process.env.DIARY_PUBLIC_INDEX_ENABLED = "true";
    const diaryRules = robots().rules;
    assert.ok(diaryRules.allow.includes("/diary"));
    assert.ok(diaryRules.disallow.includes("/"));
    assert.ok(diaryRules.disallow.includes("/diary/ops"));
    assert.ok(diaryRules.disallow.includes("/diary/confirm/"));
    assert.ok(diaryRules.disallow.includes("/diary/thanks"));
    const diaryUrls = sitemap().map(entry => entry.url);
    assert.ok(diaryUrls.includes("https://example.netlify.app/diary"));
    assert.ok(diaryUrls.includes("https://example.netlify.app/diary/request"));
    assert.ok(diaryUrls.includes("https://example.netlify.app/legal/operator"));
    assert.ok(!diaryUrls.some(url => url.endsWith("/signup") || url.endsWith("/diary/ops")));

    delete process.env.DIARY_PUBLIC_INDEX_ENABLED;
    process.env.PUBLIC_LAUNCH_ENABLED = "true";
    const marketplaceUrls = sitemap().map(entry => entry.url);
    assert.ok(marketplaceUrls.includes("https://example.netlify.app/signup"));
    assert.ok(!marketplaceUrls.includes("https://example.netlify.app/diary"));
    assert.ok(robots().rules.disallow.includes("/diary/ops"));

    process.env.DIARY_PUBLIC_INDEX_ENABLED = "true";
    assert.ok(sitemap().some(entry => entry.url.endsWith("/diary")));
    const count = sitemap().filter(entry => entry.url.endsWith("/legal/operator")).length;
    assert.equal(count, 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
