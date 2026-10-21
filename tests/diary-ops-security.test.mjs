import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const helperSource = readFileSync("lib/diary/ops.ts", "utf8");
const { outputText } = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const {
  parseDiaryCsv,
  casesFromDiaryCsv,
  diaryOpsExportCsv,
  LIMIT_FILE_BYTES,
} = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));

test("CSV parser understands quoted commas/newlines and CRLF", () => {
  const rows = parseDiaryCsv('\uFEFFrestaurant_name,email,message\r\n"大阪,食堂",test@example.com,"改行\n続き"\r\n');
  assert.deepEqual(rows, [["restaurant_name", "email", "message"], ["大阪,食堂", "test@example.com", "改行\n続き"]]);
});

test("imports Netlify original fields and preserves contact data only in memory", () => {
  const input = [
    "id,created_at,restaurant_name,contact_name,email,service,inquiry_kind,message",
    'abc123,2026-10-20T11:00:00Z,大阪食堂,担当者,shop@example.com,instagram_feed,consultation,"PRをお願いします"',
  ].join("\n");
  const rows = casesFromDiaryCsv(input);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "abc123");
  assert.equal(rows[0].restaurant, "大阪食堂");
  assert.equal(rows[0].status, "未対応");
  assert.equal(rows[0].agreedFee, 0);
  assert.equal(rows[0].contact, "担当者");
});

test("accepts exported Japanese columns and round-trips status and amounts", () => {
  const csv = [
    "Netlify受付ID,店舗・企業名,メールアドレス,進捗ステータス,成約金額（税込）,入金済金額,次にやること",
    "abc123,大阪食堂,shop@example.com,制作中,8000,3000,納品日を確認",
  ].join("\n");
  const rows = casesFromDiaryCsv(csv);
  assert.equal(rows[0].status, "制作中");
  assert.equal(rows[0].agreedFee - rows[0].paidAmount, 5000);
  const again = casesFromDiaryCsv(diaryOpsExportCsv(rows));
  assert.equal(again[0].status, "制作中");
  assert.equal(again[0].nextAction, "納品日を確認");
  assert.equal(again[0].agreedFee, 8000);
});

test("does not import unrelated or malformed CSV", () => {
  assert.throws(() => casesFromDiaryCsv("something,else\nfoo,bar"), /列が必要/);
  assert.throws(() => parseDiaryCsv('name,email\n"unclosed,foo'), /引用符/);
  assert.throws(() => parseDiaryCsv("X".repeat(LIMIT_FILE_BYTES + 1)), /2MB/);
});

test("duplicate submission IDs are ignored to prevent duplicate case rows", () => {
  const csv = "id,restaurant_name,email\nabc123,大阪食堂,a@example.com\nabc123,大阪食堂,a@example.com";
  assert.equal(casesFromDiaryCsv(csv).length, 1);
});

test("CSV export neutralizes untrusted Excel/Sheets formula execution", () => {
  const items = casesFromDiaryCsv("restaurant_name,email,message\n=HYPERLINK(1),shop@example.com,+1+2");
  const output = diaryOpsExportCsv(items);
  assert.ok(output.includes('"\'=HYPERLINK(1)"'));
  assert.ok(output.includes('"\' +1"') === false);
  assert.ok(output.includes('"\' +1+2"') === false);
  assert.ok(output.includes('"\' +1+2"') === false);
  assert.ok(output.includes('"\'+1+2"'));
  assert.ok(output.startsWith("\uFEFF"));
});

test("no automatic network reads, client persistence or homemade authentication", () => {
  const src = readFileSync("app/diary/ops/components/diary-ops-console.tsx", "utf8");
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(src, /Bearer|api[_-]?token|DIARY_OPS_PASSWORD/i);
  assert.match(src, /file\.text\(\)/);
  assert.match(src, /CSVで保存/);
  assert.doesNotMatch(helperSource, /createHmac|SESSION_SECRET|DIARY_OPS_PASSWORD/);
});

test("private workspace has noindex metadata and protected no-store response", () => {
  const route = readFileSync("app/diary/ops/page.tsx", "utf8");
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(route, /index: false, follow: false, nocache: true/);
  assert.match(config, /source: "\/diary\/ops\/:path\*"/);
  assert.match(config, /"X-Robots-Tag"/);
  assert.match(config, /"Cache-Control"/);
  assert.match(config, /connect-src 'self'/);
});
