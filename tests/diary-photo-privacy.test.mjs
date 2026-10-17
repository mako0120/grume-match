import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("business pages explain normal Instagram posting instead of complex filming briefs", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  const panel = read("app/diary/components/pricing-panel.tsx");
  const form = read("app/diary/components/inquiry-form.tsx");
  assert.match(home, /普段のInstagram投稿と同じスタイル/);
  assert.match(services, /細かな撮影指示を決めていただく必要はありません/);
  assert.match(panel, /普段のInstagram投稿と同じスタイル/);
  assert.match(form, /撮影方法の細かい指定は不要/);
  assert.match(home, /画像枚数による追加料金なし|写真枚数による追加料金/);
});

test("site describes real privacy safeguards without promising automated face detection", () => {
  const home = read("app/diary/page.tsx");
  const services = read("app/diary/services/page.tsx");
  const form = read("app/diary/components/inquiry-form.tsx");
  const policy = read("app/diary/policy/page.tsx");
  const css = read("app/diary/modern.css");
  assert.match(home, /お客様のプライバシーに配慮/);
  assert.match(services, /必要な許可なく投稿しません/);
  assert.match(form, /顔・声・個人情報/);
  assert.match(policy, /お客様やスタッフのプライバシー保護/);
  assert.match(policy, /撮り直し・トリミング・ぼかし・音声の除去/);
  assert.match(policy, /十分に匿名化できない素材/);
  assert.match(css, /diary-v2-photo-privacy/);
  for (const src of [home, services, form, policy]) {
    assert.doesNotMatch(src, /自動顔認識|AIが自動的に顔を消去|canva\.com/i);
  }
});

test("compliance review and contract gates remain explicit", () => {
  const policy = read("app/diary/policy/page.tsx");
  const form = read("app/diary/components/inquiry-form.tsx");
  assert.match(policy, /食べログ・Googleマップ等の口コミ投稿/);
  assert.match(form, /name="consent" required/);
  assert.match(form, /name="compliance_confirmed" required/);
});
