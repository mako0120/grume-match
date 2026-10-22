import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Google Apps Script code is executed against a bounded, in-memory Sheet.
// No real customers, tokens, or external writes are involved.
const source = readFileSync("scripts/diary-netlify-sheets-sync.gs", "utf8");
const ID1 = "abcdef0123456789abcdef01";
const ID2 = "abcdef0123456789abcdef02";

function fixture() {
  const cells = Array.from({ length: 800 }, () => Array(26).fill(""));
  const headings = cells[4];
  headings[2] = "店舗・企業";
  headings[3] = "進捗ステータス";
  headings[20] = "Netlify受付ID";
  // A previous manual case with only a case ID must not be overwritten.
  cells[5][0] = "manual-only";
  cells[5][3] = "返信済";
  // Another manual record already linked to a Netlify ID must be retained.
  cells[6][2] = "既存店舗";
  cells[6][20] = ID2;
  cells[6][8] = 8000;
  // A third manual draft has only a due date and must remain untouched.
  cells[7][5] = "2026-10-30";
  const writes = [];
  const board = {
    getMaxRows: () => cells.length,
    getLastRow: () => cells.length, // L contains template formulas up to row 800
    getRange(row, col, height, width) {
      return {
        getDisplayValues: () => cells.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(col - 1, col - 1 + width)),
        getFormulas: () => cells.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(col - 1, col - 1 + width).map(value =>
            typeof value === "string" && value.startsWith("=") ? value : "")),
        setValues(rows) {
          assert.equal(width, 26);
          assert.equal(height, 1);
          for (const [index, values] of rows.entries()) {
            writes.push({ row: row + index, values });
            cells[row + index - 1].splice(col - 1, width, ...values);
          }
        },
      };
    },
    insertRowsAfter(end, count) {
      assert.equal(end, cells.length);
      for (let i = 0; i < count; i++) cells.push(Array(26).fill(""));
    },
  };
  const sheet = { getSheetByName: name => name === "01_案件ボード" ? board : null };
  const ctx = vm.createContext({});
  vm.runInContext(source, ctx);
  return { ctx, sheet, cells, writes };
}

function lead(id, restaurant = "大阪テスト店舗") {
  return [
    id, "2026-10-22T12:00:00Z", restaurant,
    "担当者", "owner@example.test", "instagram_feed",
    "consultation", "'=HYPERLINK(1)", "", "",
    "Netlify Forms", "", "未確認", "",
  ];
}

test("reconcile appends once, preserves existing ops, and survives retry", () => {
  const env = fixture();
  assert.equal(env.ctx.diaryReconcileBoard_(env.sheet, [lead(ID1), lead(ID2)]), 1);
  assert.equal(env.writes.length, 1);
  assert.equal(env.writes[0].row, 9); // Do not overwrite any partially filled case
  const row = env.cells[8];
  assert.equal(row[0], ID1);
  assert.equal(row[2], "大阪テスト店舗");
  assert.equal(row[3], "未対応");
  assert.equal(row[20], ID1);
  assert.equal(row[16], "担当者");
  assert.equal(row[23], "'=HYPERLINK(1)");
  assert.match(row[11], /\$C9.*\$I9.*\$M9/);
  assert.equal(env.cells[5][3], "返信済");
  assert.equal(env.cells[6][8], 8000);
  assert.equal(env.cells[7][5], "2026-10-30");
  assert.equal(env.ctx.diaryReconcileBoard_(env.sheet, [lead(ID1), lead(ID2)]), 0);
  assert.equal(env.writes.length, 1);
});

test("reconcile refuses schema drift before any writes", () => {
  const env = fixture();
  env.cells[4][20] = "別の列";
  assert.throws(() => env.ctx.diaryReconcileBoard_(env.sheet, [lead(ID1)]), /列構成/);
  assert.equal(env.writes.length, 0);
});

test("reconcile prevents formula evaluation from pre-neutralized intake text", () => {
  const env = fixture();
  assert.equal(env.ctx.diaryReconcileBoard_(env.sheet, [lead(ID1, "'=IMPORTXML()")]), 1);
  assert.equal(env.writes[0].values[2], "'=IMPORTXML()");
  assert.equal(env.writes[0].values[23], "'=HYPERLINK(1)");
});

test("duplicate reception IDs on the operational board stop before writing", () => {
  const env = fixture();
  env.cells[8][20] = ID2; // Same Netlify ID already exists on row 7.
  assert.throws(() => env.ctx.diaryReconcileBoard_(env.sheet, [lead(ID1)]), /重複/);
  assert.equal(env.writes.length, 0);
});

test("template-only calculated cells do not occupy manual draft rows", () => {
  const env = fixture();
  env.cells[8][11] = '=IF($C9="","",0)';
  assert.equal(env.ctx.diaryReconcileBoard_(env.sheet, [lead(ID1)]), 1);
  assert.equal(env.writes[0].row, 9);
});
