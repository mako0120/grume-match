import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  describeUsageRights,
  licenseState,
  parseUsageRightsInput,
  ugcKindForPlatform,
  ugcObjectPath,
  validateUgcFile,
} from "../lib/content-rights.ts";

test("secondary use is opt-in and never perpetual", () => {
  assert.equal(
    parseUsageRightsInput({ mode: "none", durationDays: "90", fee: "5000" }),
    null,
  );

  assert.deepEqual(
    parseUsageRightsInput({ mode: "organic", durationDays: "30", fee: "" }),
    { scope: "organic", duration_days: 30, fee: 0 },
  );

  for (const durationDays of ["0", "60", "730", "", "forever"]) {
    assert.throws(
      () => parseUsageRightsInput({ mode: "organic", durationDays, fee: "0" }),
      /利用期間/,
    );
  }
});

test("ads usage requires a positive fee within bounds", () => {
  assert.throws(
    () => parseUsageRightsInput({ mode: "organic_and_ads", durationDays: "90", fee: "0" }),
    /広告/,
  );

  assert.deepEqual(
    parseUsageRightsInput({ mode: "organic_and_ads", durationDays: "365", fee: "20000" }),
    { scope: "organic_and_ads", duration_days: 365, fee: 20000 },
  );

  for (const fee of ["-1", "1.5", "1000001", "abc"]) {
    assert.throws(
      () => parseUsageRightsInput({ mode: "organic", durationDays: "90", fee }),
      /二次利用料/,
    );
  }

  assert.throws(
    () => parseUsageRightsInput({ mode: "unlimited", durationDays: "90", fee: "0" }),
    /範囲/,
  );
});

test("usage rights summary states scope, term and fee", () => {
  assert.equal(
    describeUsageRights({ usageScope: "organic_and_ads", durationDays: 90, fee: 5000 }),
    "店舗SNS・Web＋広告で利用・90日間・＋¥5,000",
  );
  assert.equal(
    describeUsageRights({ usageScope: "organic", durationDays: 30, fee: 0 }),
    "店舗SNS・Webで利用・30日間・追加料金なし",
  );
});

test("license state counts down to expiry", () => {
  const now = new Date("2026-10-01T00:00:00Z");

  assert.deepEqual(licenseState({ status: "pending", expiresAt: null }, now), {
    state: "not_started",
    daysLeft: null,
  });
  assert.deepEqual(
    licenseState({ status: "active", expiresAt: "2026-12-30T00:00:00Z" }, now),
    { state: "active", daysLeft: 90 },
  );
  assert.deepEqual(
    licenseState({ status: "active", expiresAt: "2026-10-05T12:00:00Z" }, now),
    { state: "expiring", daysLeft: 5 },
  );
  assert.deepEqual(
    licenseState({ status: "active", expiresAt: "2026-09-30T23:59:59Z" }, now),
    { state: "expired", daysLeft: 0 },
  );
});

test("UGC uploads are limited by kind, type and size", () => {
  assert.equal(ugcKindForPlatform("ugc_photo"), "photo");
  assert.equal(ugcKindForPlatform("ugc_video"), "video");
  assert.equal(ugcKindForPlatform("instagram_reel"), null);

  assert.equal(validateUgcFile("photo", { type: "image/jpeg", size: 2_000_000 }), null);
  assert.equal(validateUgcFile("video", { type: "video/quicktime", size: 40_000_000 }), null);

  assert.match(validateUgcFile("photo", { type: "video/mp4", size: 1000 }), /写真/);
  assert.match(validateUgcFile("video", { type: "image/png", size: 1000 }), /動画/);
  assert.match(validateUgcFile("photo", { type: "image/png", size: 16 * 1024 * 1024 }), /15MB/);
  assert.match(validateUgcFile("video", { type: "video/mp4", size: 51 * 1024 * 1024 }), /50MB/);
  assert.match(validateUgcFile("photo", { type: "image/png", size: 0 }), /空/);
});

test("UGC object paths match the Storage policy layout", () => {
  assert.equal(
    ugcObjectPath("user-1", "deliverable-1", "video/quicktime", "abc-123"),
    "user-1/deliverable-1/abc-123.mov",
  );
  assert.equal(
    ugcObjectPath("u", "d", "image/jpeg", "../../evil"),
    "u/d/evil.jpg",
  );
  assert.throws(() => ugcObjectPath("u", "d", "application/pdf", "x"), /unsupported/);
});

test("UGC files stay private and access ends with the license", async () => {
  const migration = await readFile(
    "supabase/migrations/202610030001_ugc_studio.sql",
    "utf8",
  );

  assert.match(migration, /'ugc-assets',\s*'ugc-assets',\s*false/);
  assert.match(migration, /l\.status = 'active' and l\.expires_at > now\(\)/);
  assert.match(migration, /check \(duration_days in \(30, 90, 365\)\)/);
  assert.match(migration, /check \(usage_scope <> 'organic_and_ads' or fee > 0\)/);
  assert.match(migration, /campaign_usage_rights_locked_after_application/);
  assert.match(migration, /deferrable initially deferred/);
});

test("signed UGC URLs are short-lived", async () => {
  const source = await readFile("server/queries/ugc-assets.ts", "utf8");

  assert.match(source, /const SIGNED_URL_SECONDS = 10 \* 60;/);
  assert.doesNotMatch(source, /getPublicUrl/);
});
