import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { signSheetRequest } from "../netlify/functions/diary-ops-state.mjs";

const source = readFileSync("scripts/diary-ops-state-webapp.gs", "utf8");
const SITE = "1ExampleSpreadsheetID012345678901234";
const ID = "abcdef0123456789abcdef01";
const SECRET = "integration-test-not-a-real-secret-123456789";

function fixture({ auditEnabled = true } = {}) {
  const cells = Array.from({ length: 10 }, () => Array(26).fill(""));
  cells[4][3] = "進捗ステータス";
  cells[4][20] = "Netlify受付ID";
  cells[5][0] = ID;
  cells[5][2] = "非実在店舗";
  cells[5][3] = "未対応";
  cells[5][8] = 8000;
  cells[5][11] = '=IF($C6="","",MAX(0,$I6-N($M6)))';
  cells[5][20] = ID;
  const audits = [];
  const nonceCache = new Map();
  const sheet = {
    getLastRow: () => 6,
    getRange(row, column, height, width) {
      return {
        getDisplayValues: () => cells.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(column - 1, column - 1 + width).map(String)),
        getValues: () => cells.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(column - 1, column - 1 + width)),
        getFormulas: () => cells.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(column - 1, column - 1 + width)
            .map(field => typeof field === "string" && field.startsWith("=") ? field : "")),
        setValues: values => {
          for (let i = 0; i < height; i++) cells[row - 1 + i].splice(column - 1, width, ...values[i]);
        },
      };
    },
    getParent: () => ({ getSheetByName: name =>
      name === "08_変更履歴" && auditEnabled ? { appendRow: value => audits.push(value) } : null }),
  };
  const props = { SPREADSHEET_ID: SITE, DIARY_SHEETS_HMAC_SECRET: SECRET };
  const context = vm.createContext({
    Date, Math, JSON, Number, String, Object, Array,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] ?? null,
    }) },
    SpreadsheetApp: { openById: id => {
      if (id !== SITE) throw Error("Unexpected spreadsheet");
      return { getSheetByName: name => name === "01_案件ボード" ? sheet : null };
    } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: key => nonceCache.get(key),
      put: (key, value) => nonceCache.set(key, value),
    }) },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_algorithm, value) => [...createHash("sha256").update(value).digest()],
      computeHmacSha256Signature: (value, key) => [...createHmac("sha256", key).update(value).digest()],
      formatDate: date => date.toISOString().slice(0, 10),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: str => ({ contents: str, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(source, context);
  const send = envelope => JSON.parse(context.doPost({
    postData: { contents: JSON.stringify(envelope) },
  }).contents);
  return { context, cells, audits, props, send };
}

test("signed owner read excludes unrelated and private customer fields", () => {
  const x = fixture();
  const answer = x.send(signSheetRequest("list", {}, SECRET));
  assert.equal(answer.ok, true);
  assert.equal(answer.items.length, 1);
  assert.equal(answer.items[0].id, ID);
  assert.equal(answer.items[0].status, "未対応");
  assert.equal(answer.items[0].agreedFee, 8000);
  assert.equal("email" in answer.items[0], false);
});

test("signature tampering, stale timestamps and exact nonce replay fail closed", () => {
  const x = fixture();
  const first = signSheetRequest("list", {}, SECRET);
  assert.equal(x.send({ ...first, payload: { extra: 1 } }).ok, false);
  assert.equal(x.send({ ...first, timestamp: Date.now() - 900000 }).ok, false);
  assert.equal(x.send(first).ok, true);
  assert.equal(x.send(first).ok, false);
});

test("owner update preserves formula, audits keys only and refuses stale revisions", () => {
  const x = fixture();
  const before = x.send(signSheetRequest("list", {}, SECRET)).items[0];
  const update = { id: ID, expectedVersion: before.version, patch: {
    status: "制作中", agreedFee: 15000, nextAction: "投稿準備",
  } };
  const changed = x.send(signSheetRequest("update", update, SECRET));
  assert.equal(changed.ok, true);
  assert.equal(changed.item.status, "制作中");
  assert.equal(x.cells[5][8], 15000);
  assert.match(x.cells[5][11], /^=IF/);
  assert.equal(x.audits.length, 1);
  assert.equal(JSON.stringify(x.audits).includes("投稿準備"), false);
  const old = x.send(signSheetRequest("update", update, SECRET));
  assert.equal(old.ok, false);
  assert.equal(old.error, "conflict");
  assert.equal(x.audits.length, 1);
  x.cells[5][3] = "返信済"; // a concurrent manual Sheets edit
  const stale = x.send(signSheetRequest("update", {
    id: ID, expectedVersion: changed.item.version, patch: { note: "追記" },
  }, SECRET));
  assert.equal(stale.error, "conflict");
});

test("no audit sheet means no writes, and formulas in text are neutralized", () => {
  const x = fixture({ auditEnabled: false });
  const current = x.send(signSheetRequest("list", {}, SECRET)).items[0];
  const noAudit = x.send(signSheetRequest("update", {
    id: ID, expectedVersion: current.version, patch: { status: "成約" },
  }, SECRET));
  assert.equal(noAudit.ok, false);
  assert.equal(x.cells[5][3], "未対応");
  const withAudit = fixture();
  const current2 = withAudit.send(signSheetRequest("list", {}, SECRET)).items[0];
  const result = withAudit.send(signSheetRequest("update", {
    id: ID, expectedVersion: current2.version, patch: { note: "=HYPERLINK(1)" },
  }, SECRET));
  assert.equal(result.ok, true);
  assert.equal(withAudit.cells[5][19], "'=HYPERLINK(1)");
});
