import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildOutreachEmail, gmailComposeUrl, isEmail } from "../lib/outreach.ts";
import { safeReturnTo } from "../lib/return-to.ts";

const highlights = [
  "直近30日の8投稿で合計約12.4万閲覧",
  "全投稿が5,000閲覧以上",
  "8本中5本が1万閲覧超え",
  "最高約2.7万閲覧（淡路市・小野原）",
  "8エリアで実績",
];

test("sales email states the flat plan and links to the order page", () => {
  const { subject, body } = buildOutreachEmail({
    creatorName: "グルメ日誌",
    companyName: "焼肉 ひまわり",
    contactName: "山田",
    price: 8000,
    orderUrl: "https://pr.example.com/order/gourmet-diary",
    highlights,
    verified: true,
  });

  assert.equal(subject, "【グルメ日誌】焼肉 ひまわり様 PRのご提案（一律¥8,000・税込）");
  assert.match(body, /^焼肉 ひまわり\n山田様/);
  assert.match(body, /直近の実績（運営確認済み）：\n・直近30日の8投稿で合計約12\.4万閲覧/);
  assert.match(body, /・一律¥8,000（税込）でInstagramリール1本を投稿/);
  assert.match(body, /・お食事は1名分のみご提供ください/);
  assert.match(body, /■ ご依頼はこちらから\nhttps:\/\/pr\.example\.com\/order\/gourmet-diary/);
  // At most four highlights keep the email short.
  assert.doesNotMatch(body, /8エリアで実績/);
});

test("sales email works without a contact name or performance yet", () => {
  const { body } = buildOutreachEmail({
    creatorName: "グルメ日誌",
    companyName: "カフェ つばめ",
    price: 8000,
    orderUrl: "https://pr.example.com/order/gourmet-diary",
    highlights: [],
    verified: false,
  });

  assert.match(body, /^カフェ つばめ ご担当者様/);
  assert.doesNotMatch(body, /直近の実績/);
});

test("Gmail compose URL carries recipient, subject and body", () => {
  const url = new URL(gmailComposeUrl("info@example.com", "件名", "本文\n2行目"));

  assert.equal(url.origin + url.pathname, "https://mail.google.com/mail/");
  assert.equal(url.searchParams.get("view"), "cm");
  assert.equal(url.searchParams.get("to"), "info@example.com");
  assert.equal(url.searchParams.get("su"), "件名");
  assert.equal(url.searchParams.get("body"), "本文\n2行目");
  assert.equal(new URL(gmailComposeUrl("", "s", "b")).searchParams.has("to"), false);

  assert.equal(isEmail("info@example.com"), true);
  assert.equal(isEmail("info@example"), false);
  assert.equal(isEmail("a b@example.com"), false);
});

test("return-to only allows order pages (no open redirect)", () => {
  assert.equal(safeReturnTo("/order/gourmet-diary"), "/order/gourmet-diary");

  for (const value of [
    "https://evil.example.com",
    "//evil.example.com",
    "/order/../admin",
    "/restaurant",
    "/order/a",
    "/order/gourmet-diary?x=1",
    "/order/GOURMET",
    null,
    undefined,
    42,
  ]) {
    assert.equal(safeReturnTo(value), null, String(value));
  }
});

test("flat-plan price and deliverable come from the database, not the form", async () => {
  const [migration, action] = await Promise.all([
    readFile("supabase/migrations/202610030004_pr_desk.sql", "utf8"),
    readFile("server/actions/order.ts", "utf8"),
  ]);

  assert.match(migration, /v_creator\.flat_plan_price,\s*'tax_included',\s*'1名分提供',\s*0,/);
  assert.match(migration, /array\['instagram_reel'\]/);
  assert.doesNotMatch(action, /price|cashReward|platform/i);
});

test("screenshot reading needs no external AI API", async () => {
  const [script, skill, pkg] = await Promise.all([
    readFile("scripts/insights-queue.mjs", "utf8"),
    readFile(".claude/skills/read-insights/SKILL.md", "utf8"),
    readFile("package.json", "utf8"),
  ]);

  assert.doesNotMatch(script + pkg, /anthropic|openai|vision|tesseract/i);
  assert.match(skill, /Never guess a number/);
});
