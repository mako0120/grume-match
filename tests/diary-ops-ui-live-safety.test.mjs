import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("app/diary/ops/components/diary-ops-console.tsx", "utf8");

test("authenticated live mode refuses a local CSV import in the handler itself", () => {
  assert.match(ui, /async function importCsv\(file: File \| undefined\)[\s\S]*?if \(accessToken\) \{ setAlert\(/);
  assert.match(ui, /\{!accessToken && <button type="button" className="ops-button ops-primary" onClick=\{\(\) => picker\.current\?\.click\(\)\}/);
});

test("disconnected live state cannot export potentially false accounting records", () => {
  assert.match(ui, /function exportCsv\(\) \{\s*if \(\(accessToken && !stateConnected\) \|\| !items\.length\) return;/);
  assert.match(ui, /accessToken\s*\? <button className="ops-button ops-primary" disabled>Sheets接続確認待ち<\/button>/);
  assert.match(ui, /Sheets未接続：編集・出力を停止/);
});

test("unsaved edits require confirmation on close, navigation and sign-out", () => {
  assert.match(ui, /function closeDetail\(\): boolean/);
  assert.match(ui, /if \(!window\.confirm\("変更内容が保存されていません/);
  assert.match(ui, /function setScreenTo\(nextScreen: Screen\) \{\s*if \(selectedId && !closeDetail\(\)\) return;/);
  assert.match(ui, /if \(selectedId && !closeDetail\(\)\) return; clearLiveData\(\)/);
});

test("sidebar states accurately distinguish local and authenticated mode", () => {
  assert.match(ui, /管理者専用・Sheets接続中/);
  assert.match(ui, /管理者専用・保存停止中/);
  assert.match(ui, /ローカル処理モード/);
});
