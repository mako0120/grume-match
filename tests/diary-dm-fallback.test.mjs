import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDiaryDmTemplate } from "../lib/diary/dm-template.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("DM fallback provides useful copy-ready text without personal details or fees", () => {
  const text = buildDiaryDmTemplate();
  assert.match(text, /グルメ日誌様/);
  assert.match(text, /【店舗名】/);
  assert.match(text, /【紹介したいメニュー】/);
  assert.match(text, /【ご希望の来店時期】/);
  assert.match(text, /PRの内容と料金について/);
  assert.doesNotMatch(text, /メールアドレス|電話番号|https?:\/\//);
});

test("all three safe marketing goals appear in the generated Instagram message", () => {
  for (const goal of ["新メニューを紹介したい", "初めてのお客様にお店を知ってほしい", "お店のこだわりを伝えたい"]) {
    const text = buildDiaryDmTemplate({ goal });
    assert.ok(text.includes(goal === "お店のこだわりを伝えたい" ? "料理やお店のこだわりを伝えたい" : goal));
  }
});

test("supported application service selection is included, no pricing is invented", () => {
  const text = buildDiaryDmTemplate({ service: "instagram_feed_video", inquiryKind: "application" });
  assert.match(text, /写真フィード＋ショート動画/);
  assert.match(text, /PR依頼について/);
  assert.doesNotMatch(text, /割引|再生保証|売上保証/);
});

test("unknown service and goal parameters cannot be injected into copied message", () => {
  const value = "<script>bad-content</script>";
  const text = buildDiaryDmTemplate({service: value, goal: value});
  assert.doesNotMatch(text, /bad-content|<script>/);
  assert.match(text, /Instagram PR/);
  assert.match(text, /料理やお店の魅力を知ってもらいたい/);
});

test("disabled native intake exposes manual Gmail composition and a structured application form", () => {
  const form = read("app/diary/components/inquiry-form.tsx");
  const request = read("app/diary/request/page.tsx");
  const fallback = read("app/diary/components/email-inquiry-fallback.tsx");
  assert.match(form, /if \(!enabled \|\| !siteKey\)/);
  assert.match(form, /<DiaryEmailInquiryFallback/);
  assert.match(fallback, /buildDiaryConsultationEmail/);
  assert.match(fallback, /buildDiaryApplicationEmail/);
  assert.match(fallback, /validateDiaryInquiry/);
  assert.match(fallback, /name="restaurant_name" required/);
  assert.match(fallback, /name="email" type="email" required/);
  assert.match(fallback, /name="consent" required/);
  assert.match(fallback, /name="compliance_confirmed" required/);
  assert.match(fallback, /メールは送信されません/);
  assert.match(fallback, /当サイトのサーバーへ送信されません/);
  assert.match(request, /メールの下書きを作成できます/);
  assert.doesNotMatch(fallback, /localStorage|sessionStorage|fetch\(/i);
});

test("both modes preserve the privacy and anti-spam gates", () => {
  const form = read("app/diary/components/inquiry-form.tsx");
  const api = read("app/api/diary/inquiries/route.ts");
  assert.match(form, /name="consent" required/);
  assert.match(form, /name="compliance_confirmed" required/);
  assert.match(form, /data-sitekey=\{siteKey\}/);
  assert.match(api, /DIARY_INQUIRIES_ENABLED !== "true"/);
});
