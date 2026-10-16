import test from "node:test";
import assert from "node:assert/strict";
import { validateDiaryInquiry } from "../lib/diary/inquiry.ts";

const base = {
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
