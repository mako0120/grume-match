import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync("scripts/diary-integration-readiness.gs", "utf8");
const ID = "1WyCH56d_FMOwoE8uJmo4uY0CKmUBLf6A4VYFQvuq0ek";
const SITE = "a1b2c3d4-1111-4444-8888-abcdef123456";

const intake = ["Netlify受付ID", "受付日時", "店舗・企業名", "担当者",
  "メールアドレス", "希望PR", "区分", "相談内容", "紹介メニュー",
  "来店希望", "受付元", "最終同期時刻", "確認ステータス", "運用メモ"];
const audit = ["変更日時", "Netlify受付ID", "変更フィールド",
  "変更前バージョン", "変更後バージョン", "記録状態"];

function fixture() {
  const props = {};
  const originalHeaders = Array(26).fill("");
  originalHeaders[2] = "店舗・企業";
  originalHeaders[3] = "進捗ステータス";
  originalHeaders[20] = "Netlify受付ID";
  const headers = {
    "01_案件ボード": originalHeaders,
    "07_自動受付": intake.slice(),
    "08_変更履歴": audit.slice(),
  };
  const calls = { api: 0, install: 0, stop: 0, dataWrite: 0 };
  const triggers = [];
  const spreadsheet = {
    getId: () => ID,
    getSheetByName: name => headers[name] && ({
      getRange: (row, col, height, width) => ({
        getDisplayValues: () => [headers[name].slice(col - 1, col - 1 + width)],
      }),
    }),
  };
  const context = vm.createContext({
    Date, JSON, String, Object, Array, Number,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] || null,
    }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: id => { assert.equal(id, ID); return spreadsheet; },
    },
    ScriptApp: { getProjectTriggers: () => triggers },
    DIARY_SYNC: { apiOrigin: "https://api.netlify.com", formName: "diary-pr-inquiry" },
    diaryRequest_: () => {
      calls.api++;
      return [{ id: "abcdef12345678", name: "diary-pr-inquiry" }];
    },
    setupDiaryAutoSync: () => {
      calls.install++;
      triggers.push({ getHandlerFunction: () => "syncDiaryNetlifyForms" });
      props.DIARY_LAST_SUCCESS = new Date().toISOString();
    },
    stopDiaryAutoSync: () => { calls.stop++; triggers.length = 0; },
  });
  vm.runInContext(SOURCE, context);
  const configure = () => Object.assign(props, {
    SPREADSHEET_ID: ID, NETLIFY_API_TOKEN: "local-test-token-no-real-secret",
    NETLIFY_SITE_ID: SITE, DIARY_SHEETS_HMAC_SECRET: "local-test-only-secret-123456789012345",
    DIARY_BOARD_AUTOCREATE_ENABLED: "true",
  });
  return { context, configure, props, triggers, headers, calls };
}

test("read-only diagnostic reports missing configuration without PII or exceptions", () => {
  const f = fixture();
  const result = f.context.checkDiaryIntegrationReadiness();
  assert.equal(result.running, false);
  assert.equal(result.configured, false);
  assert.equal(result.checks.length, 8);
  assert.deepEqual(Object.keys(result), [
    "version", "configured", "running", "checks", "triggerCount",
    "minutesSinceSuccess", "lastError", "originalDataUntouched",
  ]);
  assert.equal(f.calls.dataWrite, 0);
  assert.equal(f.calls.api, 0);
  assert.doesNotMatch(JSON.stringify(result), /local-test-token|local-test-only-secret|example\\.test|23610083|1WyCH/);
});

test("preflight checks match existing Google Sheet headers and configs", () => {
  const f = fixture();
  f.configure();
  const report = f.context.checkDiaryIntegrationReadiness();
  assert.equal(report.configured, true);
  assert.equal(report.running, false);
  assert.equal(report.checks.find(x => x.id === "five_minute_trigger").ok, false);
  assert.equal(report.checks.find(x => x.id === "sheet_schema").ok, true);
  assert.equal(report.checks.find(x => x.id === "audit_schema").ok, true);
});

test("activation defaults to denied, does not contact provider or touch Sheet", () => {
  const f = fixture();
  f.configure();
  assert.throws(() => f.context.activateDiaryIntegration(), /integration_not_approved/);
  assert.equal(f.calls.api, 0);
  assert.equal(f.calls.install, 0);
  assert.equal(f.calls.dataWrite, 0);
});

test("owner-approved install tests unique form, installs one timer, returns only status", () => {
  const f = fixture();
  f.configure();
  f.props.DIARY_INTEGRATION_APPROVED = "true";
  const result = f.context.activateDiaryIntegration();
  assert.equal(result.running, true);
  assert.equal(result.triggerCount, 1);
  assert.equal(f.calls.api, 1);
  assert.equal(f.calls.install, 1);
  assert.doesNotMatch(JSON.stringify(result), /token|123456789012345/);
  const report = f.context.checkDiaryIntegrationReadiness();
  assert.equal(report.running, true);
  const stopped = f.context.stopDiaryIntegration();
  assert.equal(stopped.running, false);
  assert.equal(stopped.originalDataPreserved, true);
  assert.equal(f.triggers.length, 0);
});

test("wrong schema, disabled board register, or missing HMAC blocks setup", () => {
  for (const mutate of [
    f => { f.headers["07_自動受付"][0] = "上書きされた見出し"; },
    f => { f.props.DIARY_BOARD_AUTOCREATE_ENABLED = "false"; },
    f => { f.props.DIARY_SHEETS_HMAC_SECRET = ""; },
    f => { f.headers["08_変更履歴"][5] = "別の見出し"; },
  ]) {
    const f = fixture();
    f.configure();
    f.props.DIARY_INTEGRATION_APPROVED = "true";
    mutate(f);
    assert.throws(() => f.context.activateDiaryIntegration(), /integration_preflight_failed/);
    assert.equal(f.calls.api, 0);
    assert.equal(f.calls.install, 0);
  }
});

test("expired trigger success does not count as a healthy live integration", () => {
  const f = fixture();
  f.configure();
  f.triggers.push({ getHandlerFunction: () => "syncDiaryNetlifyForms" });
  f.props.DIARY_LAST_SUCCESS = new Date(Date.now() - 45 * 60000).toISOString();
  const result = f.context.checkDiaryIntegrationReadiness();
  assert.equal(result.running, false);
  assert.equal(result.checks.find(x => x.id === "recent_sync_success").ok, false);
});
