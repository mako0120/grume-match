import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("scripts/diary-ops-backup.gs", "utf8");
const ORIGINAL = "1exampleExistingSpreadsheet01234567890";
const FOLDER = "private_backup_folder_1234567890";
const COPY = "1verifiedSpreadsheetBackup00000001";
const OWNER = "demo-owner@example.test";

function fixture() {
  const props = { SPREADSHEET_ID: ORIGINAL, DIARY_BACKUP_FOLDER_ID: FOLDER };
  const data = new Map();
  data.set(ORIGINAL, {
    "01_案件ボード": [
      ["店舗・企業", "進捗", "税込", "計算"],
      ["テスト店舗", "返信済", 8000, "=SUM(C2)"],
    ],
    "07_自動受付": [
      ["受付ID", "店舗", "申込者"],
      ["abc0123456789", "テスト店舗", "sample@example.test"],
    ],
    "08_変更履歴": [["日時", "ID", "状態"]],
  });
  let currentSharing = "PRIVATE";
  let folderSharing = "PRIVATE";
  let folderEditors = [];
  let copiedFile = null;
  let copyCount = 0;
  const owner = { getEmail: () => OWNER };
  const root = { getId: () => "root-folder" };
  const iterator = value => {
    let count = 0;
    return { hasNext: () => count === 0, next: () => { count++; return value; } };
  };
  const folder = {
    getId: () => FOLDER, getOwner: () => owner,
    getSharingAccess: () => folderSharing,
    getEditors: () => folderEditors, getViewers: () => [],
    getParents: () => iterator(root),
  };
  const original = {
    getId: () => ORIGINAL, getOwner: () => owner,
    makeCopy(name, destination) {
      assert.equal(destination, folder);
      assert.match(name, /BACKUP/);
      copyCount++;
      const saved = new Map();
      for (const [key, rows] of Object.entries(data.get(ORIGINAL))) {
        saved.set(key, rows.map(row => [...row]));
      }
      data.set(COPY, Object.fromEntries(saved));
      copiedFile = {
        trashed: false, getId: () => COPY, getOwner: () => owner,
        getSharingAccess: () => currentSharing,
        getEditors: () => [], getViewers: () => [],
        getParents: () => iterator(folder),
        isTrashed() { return this.trashed; },
        setTrashed(value) { this.trashed = value; },
      };
      return copiedFile;
    },
  };
  const context = vm.createContext({
    Date, JSON, Object, String, Number, Array, Map, Set,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props[key] ?? null,
      setProperty: (key, value) => { props[key] = value; },
    }) },
    SpreadsheetApp: { openById(id) {
      const tabs = data.get(id);
      if (!tabs) throw Error("Unknown spreadsheet");
      return {
        getSheets: () => Object.entries(tabs).map(([name, cells]) => ({
          getName: () => name,
          getLastRow: () => cells.length,
          getLastColumn: () => cells.length ? Math.max(...cells.map(row => row.length)) : 0,
          getRange(row, col, height, width) {
            return {
              getValues: () => cells.slice(row - 1, row + height - 1)
                .map(line => Array.from({ length: width }, (_, j) => line[col + j - 1] ?? "")),
              getFormulas: () => cells.slice(row - 1, row + height - 1)
                .map(line => Array.from({ length: width }, (_, j) => {
                  const value = line[col + j - 1];
                  return typeof value === "string" && value.startsWith("=") ? value : "";
                })),
            };
          },
        })),
      };
    } },
    DriveApp: {
      Access: { PRIVATE: "PRIVATE" },
      getRootFolder: () => root,
      getFolderById: id => { assert.equal(id, FOLDER); return folder; },
      getFileById: id => {
        if (id === ORIGINAL) return original;
        if (id === COPY && copiedFile) return copiedFile;
        throw Error("Unexpected file");
      },
    },
    Session: { getEffectiveUser: () => owner },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" }, Charset: { UTF_8: "UTF_8" },
      computeDigest: (_algo, str) => [...createHash("sha256").update(str).digest()],
      formatDate: () => "20261022_163000",
    },
  });
  vm.runInContext(source, context);
  return {
    context, props, data, get copyCount() { return copyCount; },
    get copiedFile() { return copiedFile; },
    setSharing: value => { folderSharing = value; },
    setCopySharing: value => { currentSharing = value; },
    setEditors: editors => { folderEditors = editors; },
  };
}

test("read-only preflight reports fingerprints, not customer PII", () => {
  const f = fixture();
  const snap = f.context.previewDiaryBackup();
  assert.equal(snap.sheets.length, 3);
  assert.match(snap.sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(snap), /sample@example|テスト店舗/);
  assert.equal(f.copyCount, 0);
});

test("backup defaults OFF and never creates copies without explicit approval", () => {
  const f = fixture();
  assert.throws(() => f.context.createDiaryBackup(), /backup_disabled/);
  assert.equal(f.copyCount, 0);
});

test("manual snapshot can be verified and a read-only restore comparison made", () => {
  const f = fixture();
  f.props.DIARY_BACKUP_ENABLED = "true";
  const meta = f.context.createDiaryBackup();
  assert.equal(meta.id, COPY);
  assert.equal(meta.sheetCount, 3);
  assert.equal(f.copyCount, 1);
  assert.equal(f.context.verifyDiaryBackup(COPY).verified, true);
  const untouched = f.context.planDiaryRestore(COPY);
  assert.equal(untouched.restorationPerformed, false);
  assert.equal(untouched.currentMatchesBackup, true);

  // Newly arrived lead changes the live sheet; backup remains verifiable.
  f.data.get(ORIGINAL)["07_自動受付"].push(["new-lead", "新規相談", "new@example.test"]);
  assert.equal(f.context.verifyDiaryBackup(COPY).verified, true);
  const diff = f.context.planDiaryRestore(COPY);
  assert.equal(diff.currentMatchesBackup, false);
  assert.deepEqual([...diff.changedTabs], ["07_自動受付"]);
  assert.equal(f.data.get(ORIGINAL)["07_自動受付"].length, 3);
});

test("shared backup folder is rejected before any private data are copied", () => {
  const f = fixture();
  f.props.DIARY_BACKUP_ENABLED = "true";
  f.setSharing("ANYONE");
  assert.throws(() => f.context.createDiaryBackup(), /backup_not_created_or_verified/);
  assert.equal(f.copyCount, 0);
  f.setSharing("PRIVATE");
  f.setEditors([{ getEmail: () => "other@example.test" }]);
  assert.throws(() => f.context.createDiaryBackup(), /backup_not_created_or_verified/);
  assert.equal(f.copyCount, 0);
});

test("copy inherited external sharing is rejected and the new copy trashed", () => {
  const f = fixture();
  f.props.DIARY_BACKUP_ENABLED = "true";
  f.setCopySharing("ANYONE");
  assert.throws(() => f.context.createDiaryBackup(), /backup_not_created_or_verified/);
  assert.equal(f.copyCount, 1);
  assert.equal(f.copiedFile.trashed, true);
  assert.equal(f.props.DIARY_LAST_BACKUP_MANIFEST, undefined);
  assert.equal(f.data.get(ORIGINAL)["01_案件ボード"].length, 2);
});

test("tampering with a saved copy invalidates its fingerprint; original untouched", () => {
  const f = fixture();
  f.props.DIARY_BACKUP_ENABLED = "true";
  f.context.createDiaryBackup();
  f.data.get(COPY)["01_案件ボード"][1][2] = 999999;
  assert.throws(() => f.context.verifyDiaryBackup(COPY), /backup_integrity_failed/);
  assert.equal(f.data.get(ORIGINAL)["01_案件ボード"][1][2], 8000);
});

test("arbitrary backup IDs and missing mandatory tabs fail closed", () => {
  const f = fixture();
  assert.throws(() => f.context.verifyDiaryBackup(ORIGINAL), /backup_not_registered/);
  f.data.get(ORIGINAL)["01_案件ボード"] = [];
  assert.equal(f.context.previewDiaryBackup().sheets.length, 3);
  delete f.data.get(ORIGINAL)["01_案件ボード"];
  assert.throws(() => f.context.previewDiaryBackup(), /backup_missing_tabs/);
});
