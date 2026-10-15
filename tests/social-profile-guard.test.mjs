import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedMetric,
  normalizeSocialHandle,
  validSocialHandle,
  validSocialProfileUrl,
} from "../lib/social-profile.ts";
import { readFile } from "node:fs/promises";

test("social profile validation only accepts trusted HTTPS profile hosts", () => {
  assert.equal(
    validSocialProfileUrl("instagram", "https://www.instagram.com/example/"),
    true,
  );
  assert.equal(
    validSocialProfileUrl("instagram", "http://instagram.com/example/"),
    false,
  );
  assert.equal(
    validSocialProfileUrl("instagram", "https://example.com/instagram"),
    false,
  );
  assert.equal(
    validSocialProfileUrl("tiktok", "https://www.tiktok.com/@example"),
    true,
  );
  assert.equal(
    validSocialProfileUrl("youtube", "https://www.youtube.com/@example"),
    true,
  );
});

test("social handle and metrics are bounded", () => {
  assert.equal(normalizeSocialHandle("@gourmet_diary"), "gourmet_diary");
  assert.equal(validSocialHandle("gourmet_diary"), true);
  assert.equal(validSocialHandle("bad handle"), false);
  assert.equal(validSocialHandle("bad/handle"), false);
  assert.equal(boundedMetric("999999999999"), 2_000_000_000);
  assert.equal(boundedMetric("not-a-number"), 0);
});

test("database also enforces social URL integrity", async () => {
  const source = await readFile(
    "supabase/migrations/202610150010_social_profile_guard.sql",
    "utf8",
  );

  assert.match(source, /invalid_social_profile_url/);
  assert.match(source, /instagram\\\.com|instagram\\?\.com/);
  assert.match(source, /creator_social_validate/);
});
