import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DIARY_PR_EMAIL,
  buildDiaryApplicationEmail,
  buildDiaryConsultationEmail,
} from "../lib/diary/email-draft.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("the original PR inbox opens in Gmail with a stable recipient and mailto fallback", () => {
  assert.equal(DIARY_PR_EMAIL, "23610083grume1@gmail.com");
  const draft = buildDiaryConsultationEmail();
  const url = new URL(draft.gmailUrl);
  assert.equal(url.origin, "https://mail.google.com");
  assert.equal(url.pathname, "/mail/");
  assert.equal(url.searchParams.get("to"), DIARY_PR_EMAIL);
  assert.match(url.searchParams.get("body"), /店舗名/);
  assert.match(draft.mailtoUrl, /^mailto:23610083grume1@gmail\.com\?subject=/);
});

test("application includes the user's submitted restaurant details but does not transmit them to our server", () => {
  const draft = buildDiaryApplicationEmail({
    restaurant: "大阪食堂",
    contact: "田中さん",
    replyTo: "hello@example.com",
    service: "instagram_feed_video",
    coverage: "昼の定食の新メニューを紹介してください",
    menu: "季節限定ランチ",
    visitPreference: "11月11日 18時",
    message: "初めてのお客様に店の雰囲気も紹介してもらいたいです。",
  });
  const url = new URL(draft.gmailUrl);
  assert.equal(url.searchParams.get("to"), DIARY_PR_EMAIL);
  for(const text of ["大阪食堂", "田中さん", "hello@example.com", "写真フィード＋ショート動画", "季節限定ランチ", "11月11日 18時"]) {
    assert.ok(draft.body.includes(text), text);
    assert.ok(url.searchParams.get("body").includes(text), text);
  }
  assert.match(draft.body, /合意してから確定/);
});

test("email inputs are bounded and cannot inject extra headers via CRLF", () => {
  const draft = buildDiaryApplicationEmail({
    restaurant: "A\r\nBcc: outsider@example.org",
    contact: "担当者",
    replyTo: "owner@example.com",
    service: "instagram_feed",
    message: "PRの内容を相談したいです。",
  });
  assert.doesNotMatch(draft.subject, /\r|\n/);
  assert.ok(draft.subject.length <= 150);
  assert.equal(new URL(draft.gmailUrl).searchParams.get("to"), DIARY_PR_EMAIL);
  assert.ok(draft.gmailUrl.length < 8000);
});

test("fallback uses secure manual handoff, preserves hosted form gates and prices", () => {
  const request = read("app/diary/request/page.tsx");
  const form = read("app/diary/components/inquiry-form.tsx");
  const emailFallback = read("app/diary/components/email-inquiry-fallback.tsx");
  const landing = read("app/diary/pr/page.tsx");
  assert.match(request, /DIARY_NETLIFY_FORMS_ENABLED === "true"/);
  assert.match(form, /<NetlifyDiaryInquiryForm/);
  assert.match(form, /<DiaryEmailInquiryFallback/);
  assert.match(emailFallback, /photoFeedPriceYen\.toLocaleString/);
  assert.match(emailFallback, /videoPackageStartYen\.toLocaleString/);
  assert.match(emailFallback, /type="checkbox" name="consent" required/);
  assert.match(emailFallback, /type="checkbox" name="compliance_confirmed" required/);
  assert.match(emailFallback, /type="submit"/);
  assert.match(emailFallback, /Gmailで申込みメールを開く/);
  assert.match(landing, /Gmailで直接相談する/);
  assert.doesNotMatch(emailFallback, /fetch\(|localStorage|sessionStorage|window\.open/i);
  assert.doesNotMatch(emailFallback, /29,800|49,800|monthly_growth/);
});
