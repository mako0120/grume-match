import test from "node:test";
import assert from "node:assert/strict";
import { validateDiaryInquiry, detectProhibitedPRRequest } from "../lib/diary/inquiry.ts";

const base = {
  inquiry_kind: "consultation",
  desired_coverage: "",
  featured_menu: "",
  requested_outcome: "",
  visit_preference: "",
  restaurant_name: "大阪食堂",
  contact_name: "山田",
  email: "HELLO@example.com",
  phone: "",
  instagram_url: "https://www.instagram.com/osaka_food/",
  service: "instagram_feed",
  budget: "undecided",
  desired_period: "",
  message: "お店の魅力を紹介してください。",
  consent: true,
  compliance_confirmed: true,
};

test("accepts a valid first-party PR inquiry and normalizes email", () => {
  const result = validateDiaryInquiry(base);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.email, "hello@example.com");
    assert.equal(result.data.phone, null);
  }
});
test("rejects unknown service and budget", () => {
  assert.equal(validateDiaryInquiry({ ...base, service: "free_review" }).ok, false);
  assert.equal(validateDiaryInquiry({ ...base, budget: "free" }).ok, false);
});
test("rejects absent privacy consent", () => {
  assert.equal(validateDiaryInquiry({ ...base, consent: false }).ok, false);
});
test("rejects oversized messages and invalid emails", () => {
  assert.equal(validateDiaryInquiry({ ...base, message: "x".repeat(2001) }).ok, false);
  assert.equal(validateDiaryInquiry({ ...base, email: "not-an-email" }).ok, false);
});
test("allows Instagram HTTPS profiles only", () => {
  assert.equal(validateDiaryInquiry({ ...base, instagram_url: "https://evil.example/" }).ok, false);
  assert.equal(validateDiaryInquiry({ ...base, instagram_url: "javascript:alert(1)" }).ok, false);
  assert.equal(validateDiaryInquiry({ ...base, instagram_url: "https://instagram.com/" }).ok, true);
});
test("rejects invalid payloads", () => {
  assert.equal(validateDiaryInquiry(null).ok, false);
  assert.equal(validateDiaryInquiry([]).ok, false);
});

test("rejects absent PR-policy acknowledgement", () => {
  const result = validateDiaryInquiry({ ...base, compliance_confirmed: false });
  assert.equal(result.ok, false);
  assert.equal(result.error, "compliance_acknowledgement_required");
});

test("rejects paid or incentivized review-site request terms", () => {
  for (const bad of [
    "食べログの口コミも必ず投稿してください",
    "Googleマップにレビューをお願いします",
    "Google Maps reviews as well please",
    "星5の高評価をお願いしたいです",
    "お店のクチコミ投稿が必須です",
    "PR表記なしで投稿してください",
    "ステマとして投稿をお願いします",
    "食べずに感想を書いてください",
  ]) {
    assert.notEqual(detectProhibitedPRRequest(bad), null, bad);
    assert.equal(validateDiaryInquiry({ ...base, message: bad }).ok, false, bad);
  }
});

test("accepts disclosed Instagram promotion with a first-hand genuine description", () => {
  const result = validateDiaryInquiry({
    ...base,
    message: "来店して実際に食べた感想を、PR表記付きのInstagramリールとして投稿してほしいです。",
  });
  assert.equal(result.ok, true);
});

test("two inquiry paths: consultation accepts a draft, application requires a meaningful brief", () => {
  assert.equal(validateDiaryInquiry({ ...base, inquiry_kind: "consultation" }).ok, true);
  assert.equal(validateDiaryInquiry({ ...base, inquiry_kind: "application" }).ok, false);
  assert.equal(validateDiaryInquiry({
    ...base,
    inquiry_kind: "application",
    desired_coverage: "お店の自家製メニューと店内を紹介したいです。",
    featured_menu: "看板のオムライス",
    requested_outcome: "大阪周辺の方にお店を知ってほしい",
    visit_preference: "平日18:00以降",
  }).ok, true);
  assert.equal(validateDiaryInquiry({ ...base, inquiry_kind: "unknown" }).ok, false);
});

test("video-included PR is eligible with legal first-party content", () => {
  assert.equal(validateDiaryInquiry({
    ...base, inquiry_kind: "application",
    service: "instagram_feed_video",
    desired_coverage: "写真とショート動画で新メニューをご紹介ください。",
    message: "Instagramで新メニューを紹介してほしいです。",
  }).ok, true);
  assert.equal(validateDiaryInquiry({
    ...base, inquiry_kind: "application",
    service: "instagram_feed_video", desired_coverage: "食べログも投稿してください",
  }).ok, false);
});
