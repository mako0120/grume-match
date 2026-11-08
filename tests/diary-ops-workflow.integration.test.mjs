import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { liveLeadResponse } from "../netlify/functions/diary-ops-feed.mjs";
import { stateResponse } from "../netlify/functions/diary-ops-state.mjs";

// Synthetic end-to-end contract test. Executes actual Netlify handlers and
// both actual Apps Script source files against in-memory Sheets/Netlify mocks.
// No real submissions, external requests, payments or production secrets.
const SCRIPT = [
  readFileSync("scripts/diary-netlify-sheets-sync.gs", "utf8"),
  readFileSync("scripts/diary-ops-state-webapp.gs", "utf8"),
].join("\n");
const SITE = "a1b2c3d4-1111-4444-8888-abcdef123456";
const SHEET = "1gourmetExamplePrivateCopyId123456789";
const FORM = "abc12345abc12345";
const LEAD = "abcdef0123456789abcdef0123456789";
const SECRET = "local-only-test-secret-do-not-publish-1234567890";
const OWNER_TOKEN = "identity_jwt_fake_".repeat(9);
const ENV = {
  CONTEXT: "production",
  DIARY_OPS_AUTO_SYNC_ENABLED: "true",
  DIARY_OPS_STATE_ENABLED: "true",
  DIARY_OPS_OWNER_EMAIL: "owner@example.test",
  DIARY_NETLIFY_SITE_ID: SITE,
  DIARY_NETLIFY_API_TOKEN: "synthetic-test-token-not-secret-123456",
  DIARY_SHEETS_HMAC_SECRET: SECRET,
  DIARY_SHEETS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycb_0123456789012345678901234/exec",
  URL: "https://sample-diary.netlify.app",
};
const submissions = [{
  id: LEAD, created_at: "2026-10-22T09:00:00Z",
  data: {
    restaurant_name: "大阪テスト食堂",
    contact_name: "デモ担当",
    email: "demo@example.test",
    service: "instagram_feed",
    inquiry_kind: "consultation",
    message: "テスト申込み",
    visit_preference: "2026年11月",
  },
}];

function fixture() {
  const props = {
    NETLIFY_API_TOKEN: ENV.DIARY_NETLIFY_API_TOKEN,
    NETLIFY_SITE_ID: SITE,
    SPREADSHEET_ID: SHEET,
    DIARY_BOARD_AUTOCREATE_ENABLED: "true",
    DIARY_SHEETS_HMAC_SECRET: SECRET,
  };
  const boardData = Array.from({ length: 800 }, () => Array(26).fill(""));
  boardData[4][2] = "店舗・企業";
  boardData[4][3] = "進捗ステータス";
  boardData[4][20] = "Netlify受付ID";
  const intakeData = [[
    "Netlify受付ID", "受付日時", "店舗・企業名", "担当者", "メールアドレス",
    "希望PR", "区分", "相談内容", "紹介メニュー", "来店希望",
    "受付元", "最終同期時刻", "確認ステータス", "運用メモ",
  ]];
  const journal = [];
  const seenNonces = new Set();
  const apiCalls = [];

  const grid = (rows, width, maxRows = () => rows.length) => ({
    getMaxRows: maxRows,
    getLastRow() {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].some(cell => String(cell ?? "") !== "")) return i + 1;
      }
      return 0;
    },
    getRange(row, column, height = 1, columns = 1) {
      return {
        getDisplayValues: () => rows.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(column - 1, column - 1 + columns).map(x => String(x ?? ""))),
        getValues: () => rows.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(column - 1, column - 1 + columns)),
        getFormulas: () => rows.slice(row - 1, row - 1 + height)
          .map(fields => fields.slice(column - 1, column - 1 + columns)
            .map(x => typeof x === "string" && x.startsWith("=") ? x : "")),
        setValue: value => { rows[row - 1][column - 1] = value; },
        setValues(values) {
          for (let i = 0; i < values.length; i++) {
            while (rows.length <= row - 1 + i) rows.push(Array(width).fill(""));
            rows[row - 1 + i].splice(column - 1, columns, ...values[i]);
          }
        },
      };
    },
    insertRowsAfter(_, n) {
      for (let i = 0; i < n; i++) rows.push(Array(width).fill(""));
    },
  });
  const board = grid(boardData, 26);
  const intake = grid(intakeData, 14, () => 1000);
  const audit = {
    getLastRow: () => journal.length + 1,
    getRange: (row, col, count, columns) => ({
      getValues: () => journal.slice(row - 2, row - 2 + count)
        .map(entry => entry.slice(col - 1, col - 1 + columns)),
    }),
    appendRow: values => journal.push(values),
  };
  const spreadsheet = {
    getSheetByName(name) {
      if (name === "01_案件ボード") return board;
      if (name === "07_自動受付") return intake;
      if (name === "08_変更履歴") return audit;
      return null;
    },
  };
  board.getParent = () => spreadsheet;
  const fakeFetch = (url, options) => {
    apiCalls.push(String(url));
    assert.equal(options.headers.Authorization, "Bearer " + ENV.DIARY_NETLIFY_API_TOKEN);
    if (String(url).endsWith("/sites/" + SITE + "/forms")) {
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify([{ id: FORM, name: "diary-pr-inquiry" }]) };
    }
    if (String(url).includes("/forms/" + FORM + "/submissions")) {
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(submissions) };
    }
    throw Error("Unexpected URL");
  };
  const context = vm.createContext({
    Date, Math, Number, Object, Array, String, JSON,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: name => props[name] ?? null,
      setProperty: (name, value) => { props[name] = value; },
    }) },
    SpreadsheetApp: { openById: id => {
      assert.equal(id, SHEET);
      return spreadsheet;
    }, flush: () => {} },
    UrlFetchApp: { fetch: fakeFetch },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: key => seenNonces.has(key) ? "1" : null,
      put: key => { seenNonces.add(key); },
    }) },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      DigestAlgorithm: { SHA_256: "SHA-256" },
      computeDigest: (_, value) => [...createHash("sha256").update(value).digest()],
      computeHmacSha256Signature: (value, key) => [...createHmac("sha256", key).update(value).digest()],
      formatDate: value => value.toISOString().slice(0, 10),
    },
    ContentService: { MimeType: { JSON: "application/json" },
      createTextOutput: str => ({ contents: str, setMimeType() { return this; } }) },
    console: { log: () => {} },
  });
  vm.runInContext(SCRIPT, context);
  const calls = [];
  async function bridge(url, options) {
    calls.push({ url: String(url), method: options.method });
    if (String(url).endsWith("/.netlify/identity/user")) {
      return Response.json({ email: "owner@example.test", app_metadata: { roles: ["admin"] } });
    }
    if (String(url) === ENV.DIARY_SHEETS_WEBAPP_URL) {
      const text = context.doPost({ postData: { contents: options.body } }).contents;
      return Response.json(JSON.parse(text));
    }
    if (String(url).endsWith("/sites/" + SITE + "/forms")) {
      return Response.json([{ id: FORM, name: "diary-pr-inquiry" }]);
    }
    if (String(url).includes("/forms/" + FORM + "/submissions")) {
      return Response.json(submissions);
    }
    throw Error("Unexpected bridge destination");
  }
  const req = (method = "GET", body, token = OWNER_TOKEN) =>
    new Request(ENV.URL + "/.netlify/functions/diary-ops-state", {
      method, headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { context, boardData, intakeData, journal, props, apiCalls, calls, bridge, req };
}

test("inquiry -> Netlify feed -> Sheets intake -> case -> save -> reload, no duplication", async () => {
  const f = fixture();
  const formRequest = new Request(ENV.URL + "/.netlify/functions/diary-ops-feed", {
    headers: { Authorization: "Bearer " + OWNER_TOKEN },
  });
  const feed = await liveLeadResponse(formRequest, ENV, f.bridge);
  assert.equal(feed.status, 200);
  const first = await feed.json();
  assert.equal(first.leads.length, 1);
  assert.equal(first.leads[0].id, LEAD);

  f.context.syncDiaryNetlifyForms();
  assert.equal(f.intakeData.length, 2);
  assert.equal(f.intakeData[1][0], LEAD);
  assert.equal(f.boardData[5][20], LEAD);
  assert.equal(f.boardData[5][3], "未対応");
  const get = await stateResponse(f.req(), ENV, f.bridge);
  assert.equal(get.status, 200);
  const before = (await get.json()).items[0];
  assert.equal(before.status, "未対応");
  assert.equal(before.id, LEAD);

  const patch = {
    status: "返信済", nextAction: "日程を確認", agreedFee: 8000,
    visitDate: "2026-11-10", postDate: "2026-11-12",
  };
  const save = await stateResponse(f.req("POST", {
    id: LEAD, expectedVersion: before.version, patch,
  }), ENV, f.bridge);
  assert.equal(save.status, 200);
  assert.equal((await save.json()).item.status, "返信済");
  assert.equal(f.boardData[5][8], 8000);
  assert.equal(f.boardData[5][3], "返信済");
  assert.equal(f.journal.length, 2);
  assert.deepEqual(f.journal.map(x => x[5]), ["BEGIN", "COMMITTED"]);

  const reread = await stateResponse(f.req(), ENV, f.bridge);
  const after = (await reread.json()).items[0];
  assert.equal(after.agreedFee, 8000);
  assert.equal(after.postDate, "2026-11-12");
  assert.notEqual(after.version, before.version);

  f.context.syncDiaryNetlifyForms();
  assert.equal(f.intakeData.length, 2);
  assert.equal(f.boardData[5][3], "返信済");
  assert.equal(f.props.DIARY_LAST_COUNT, "0");
  assert.equal(f.props.DIARY_LAST_BOARD_COUNT, "0");
});

test("stale revision and absent owner authentication never change the ledger", async () => {
  const f = fixture();
  f.context.syncDiaryNetlifyForms();
  const before = (await (await stateResponse(f.req(), ENV, f.bridge)).json()).items[0];
  const badRequest = { id: LEAD, expectedVersion: "0".repeat(64), patch: { status: "成約" } };
  const conflict = await stateResponse(f.req("POST", badRequest), ENV, f.bridge);
  assert.equal(conflict.status, 409);
  const denied = await stateResponse(f.req("POST", {
    id: LEAD, expectedVersion: before.version, patch: { status: "成約" },
  }, ""), ENV, f.bridge);
  assert.equal(denied.status, 401);
  assert.equal(f.boardData[5][3], "未対応");
  assert.equal(f.journal.length, 0);
  assert.equal(f.calls.filter(x => x.url === ENV.DIARY_SHEETS_WEBAPP_URL).length, 2);
});
