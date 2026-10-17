import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDiaryInquiry } from "../lib/diary/inquiry.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("first consultation submits with only essential public inputs and no lead-sale friction", () => {
  const form = read("app/diary/components/inquiry-form.tsx");
  assert.match(form, /inquiryKind === "consultation"/);
  assert.match(form, /<details className="diary-extra-details">/);
  assert.match(form, /name="service" value="consultation"/);
  assert.match(form, /name="budget" value="undecided"/);
  assert.match(form, /name="restaurant_name" required/);
  assert.match(form, /name="contact_name" required/);
  assert.match(form, /name="email" type="email" required/);
  assert.match(form, /name="message" required minLength={10}/);
  assert.match(form, /name="consent" required/);
  assert.match(form, /name="compliance_confirmed" required/);
  assert.match(form, /data-sitekey={siteKey}/);
  const valid = validateDiaryInquiry({
    inquiry_kind: "consultation",
    restaurant_name: "大阪食堂",
    contact_name: "担当者",
    email: "hello@example.com",
    service: "consultation",
    budget: "undecided",
    message: "新メニューのInstagram投稿について相談したいです。",
    consent: true,
    compliance_confirmed: true,
  });
  assert.equal(valid.ok, true);
});

test("application keeps meaningful brief and verified price while consultation stays contract-free", () => {
  const form = read("app/diary/components/inquiry-form.tsx");
  const schema = read("lib/diary/inquiry.ts");
  const home = read("app/diary/page.tsx");
  assert.match(form, /name="desired_coverage" rows={3} maxLength={1200} required/);
  assert.match(form, /name="budget" defaultValue="undecided" required/);
  assert.match(schema, /inquiry_kind === "application" && !desired_coverage/);
  assert.match(home, /投稿前に内容・費用を確認/);
  assert.match(home, /合意するまで契約なし/);
});

test("three marketing goals lead to allowlisted, contextualized inquiry page", () => {
  const page = read("app/diary/page.tsx");
  const request = read("app/diary/request/page.tsx");
  for (const key of ["new_menu", "first_visit", "story"]) {
    assert.ok(page.includes("goal=" + key));
    assert.ok(request.includes('goal === "' + key + '"'));
  }
  assert.match(request, /initialGoal={goalLabel}/);
  assert.match(request, /ご相談テーマ/);
  assert.doesNotMatch(request, /document\.cookie|localStorage|trackingId/);
});

test("compliance, Instagram-only evidence, and secure failed-closed intake remain", () => {
  const form = read("app/diary/components/inquiry-form.tsx");
  const home = read("app/diary/page.tsx");
  const api = read("app/api/diary/inquiries/route.ts");
  assert.match(form, /食べログ・Googleマップ等への報酬や飲食提供を条件とする口コミ/);
  assert.match(form, /<details className="diary-compliance diary-policy-details"/);
  assert.match(home, /<PostShowcase \/>/);
  assert.doesNotMatch(home, /canva\.com|canva\.link|viewUrl|DIARY_PORTFOLIO/i);
  assert.match(api, /DIARY_INQUIRIES_ENABLED !== "true"/);
  assert.match(api, /verifyChallenge/);
});
