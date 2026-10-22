/**
 * グルメ日誌 | Google Apps Script 単一ファイル導入版
 * GENERATED FILE — do not hand-edit. Source: the three .gs files.
 *
 * Paste once into the Apps Script project bound to the EXISTING university-
 * owned Google Sheet. Add secrets only in Script Properties, never here.
 * See docs/DIARY_ACTIVATION_ONE_PAGE.md.
 */

/**
 * グルメ日誌：Netlify Forms -> Google Sheets 定期取込
 *
 * Install in Apps Script linked to the CURRENT owner-approved Google Sheet.
 * Do not share the bound script or expose its token to other users.
 *
 * Script Properties (NOT script source, sheet cells, GitHub or chat):
 *   NETLIFY_API_TOKEN  - Netlify personal access token; protect as a secret
 *   NETLIFY_SITE_ID    - Netlify site API ID (UUID)
 *   SPREADSHEET_ID     - Google Sheet ID (existing owner-approved Sheet)
 *
 * Activate only by manually running setupDiaryAutoSync once in Apps Script.
 * Default poll interval 5 minutes. No external write APIs are contacted.
 */
const DIARY_SYNC = Object.freeze({
  formName: 'diary-pr-inquiry',
  tabName: '07_自動受付',
  apiOrigin: 'https://api.netlify.com',
  limitPages: 20,
  pageSize: 100,
  triggerMinutes: 5,
});

function diaryProperties_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('NETLIFY_API_TOKEN');
  const siteId = p.getProperty('NETLIFY_SITE_ID');
  const spreadsheetId = p.getProperty('SPREADSHEET_ID');
  if (!token || token.length < 16 ||
      !/^[0-9a-f-]{30,40}$/i.test(siteId || '') ||
      !/^[\w-]{20,120}$/.test(spreadsheetId || '')) {
    throw new Error('Script PropertiesにNETLIFY_API_TOKEN, NETLIFY_SITE_ID, SPREADSHEET_IDを設定してください');
  }
  return { token, siteId, spreadsheetId };
}

function diaryRequest_(url, token) {
  // Apps Script V8 has no URL constructor. Allow exactly the two read-only endpoints.
  if (!/^https:\/\/api\.netlify\.com\/api\/v1\/(?:sites\/[0-9a-f-]{30,40}\/forms|forms\/[a-z0-9-]{8,128}\/submissions\?page=[0-9]+&per_page=100)$/i.test(url)) {
    throw new Error('許可されていないNetlify API URLです');
  }
  const resp = UrlFetchApp.fetch(url, {
    method: 'get', muteHttpExceptions: true, followRedirects: false,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  if (resp.getResponseCode() !== 200) {
    // Do not include response body, credentials or personal data in logs.
    throw new Error('Netlify APIへの接続失敗 (HTTP ' + resp.getResponseCode() + ')');
  }
  const value = JSON.parse(resp.getContentText('UTF-8'));
  if (!Array.isArray(value)) throw new Error('Netlify API応答が不正です');
  return value;
}

function diaryLiteral_(raw, maxLen) {
  const text = typeof raw === 'string' ? raw.trim().slice(0, maxLen) : '';
  // Google Sheets treats leading = as a formula. Neutralize other CSV-injection
  // leaders too, including whitespace before the character.
  return /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function diaryToRow_(entry, now) {
  const d = entry.data && typeof entry.data === 'object' ? entry.data : {};
  const id = typeof entry.id === 'string' ? entry.id : '';
  if (!/^[a-z0-9-]{8,128}$/i.test(id)) return null;
  return [
    id,
    diaryLiteral_(entry.created_at, 50),
    diaryLiteral_(d.restaurant_name, 120),
    diaryLiteral_(d.contact_name, 100),
    diaryLiteral_(d.email, 254),
    diaryLiteral_(d.service, 70),
    diaryLiteral_(d.inquiry_kind, 40),
    diaryLiteral_(d.message, 2000),
    diaryLiteral_(d.featured_menu, 500),
    diaryLiteral_(d.visit_preference, 600),
    'Netlify Forms',
    now,
    '未確認',
    '',
  ];
}

/**
 * Optional one-way new-lead reconciliation into the operational case board.
 * OFF by default: Script Property DIARY_BOARD_AUTOCREATE_ENABLED must be "true".
 * Never overwrite pre-existing operational fields. A failed intermediate run
 * is repaired on the next poll because ALL fetched IDs are reconciled.
 */
function diaryReconcileBoard_(ss, sourceRows) {
  const board = ss.getSheetByName('01_案件ボード');
  if (!board) throw new Error('案件ボードが見つからないため同期を停止しました');
  const headings = board.getRange(5, 1, 1, 26).getDisplayValues()[0];
  if (headings[2] !== '店舗・企業' ||
      headings[3] !== '進捗ステータス' ||
      headings[20] !== 'Netlify受付ID') {
    throw new Error('案件ボード列構成が変わったため同期を停止しました');
  }

  // A is our stable case key, U is the Netlify submission key. Also check U
  // for cases entered manually before this automatic reconciliation existed.
  const last = Math.max(board.getLastRow(), 5);
  const count = Math.max(0, last - 5);
  const ids = new Set();
  const keyRows = new Map();
  if (count) {
    const keys = board.getRange(6, 1, count, 1).getDisplayValues();
    const sources = board.getRange(6, 21, count, 1).getDisplayValues();
    const register = (value, row) => {
      const id = String(value || '').trim();
      if (!id) return;
      if (keyRows.has(id) && keyRows.get(id) !== row) {
        throw new Error('案件ボードに受付IDの重複があります。自動登録を停止しました');
      }
      keyRows.set(id, row);
      ids.add(id);
    };
    keys.forEach((r, i) => {
      register(r[0], i + 6);
      register(sources[i][0], i + 6);
    });
  }

  // All 26 columns are checked: a partially edited manual record may have
  // only a due date, fee, email or note. A formula-only template cell is NOT
  // considered a manual record. We must never overwrite a populated row.
  const maxRows = board.getMaxRows();
  const existingRows = maxRows > 5 ?
    board.getRange(6, 1, maxRows - 5, 26) : null;
  const values = existingRows ? existingRows.getDisplayValues() : [];
  const formulas = existingRows ? existingRows.getFormulas() : [];
  const occupied = i => (values[i] || []).some((cell, j) =>
    String(cell ?? '').trim() !== '' && !(formulas[i] && formulas[i][j]));
  let nextRow = 6;
  while (nextRow - 6 < values.length && occupied(nextRow - 6)) nextRow++;

  // Plan and validate every row before writing to the original sheet.
  const planned = [];
  for (const received of sourceRows) {
    const id = received[0];
    if (ids.has(id)) continue;
    const newCase = Array(26).fill('');
    newCase[0] = id;
    newCase[1] = received[1];         // 受付日
    newCase[2] = received[2];         // 店舗
    newCase[3] = '未対応';
    newCase[4] = '受付内容を確認して返信';
    newCase[7] = received[5];         // 希望PR
    newCase[11] = '=IF(OR($C' + nextRow + '="",$I' + nextRow +
      '="",$D' + nextRow + '="終了"),"",MAX(0,$I' + nextRow + '-N($M' + nextRow + ')))';
    newCase[16] = received[3];        // 担当者
    newCase[17] = received[4];        // email
    newCase[19] = '自動受付から追加・未確認';
    newCase[20] = id;                 // Netlify受付ID
    newCase[21] = 'Netlify Forms';
    newCase[23] = received[7];        // 相談
    // Formula-only template rows are available, but existing formulas in
    // every column (including a customized L) must survive the insertion.
    const template = formulas[nextRow - 6] || [];
    template.forEach((formula, col) => {
      if (!formula) return;
      if (newCase[col] !== '' && col !== 11) {
        throw new Error('案件ボードの自動登録先に数式があります。手動確認まで停止しました');
      }
      newCase[col] = formula;
    });
    planned.push({ row: nextRow, values: newCase });
    ids.add(id);
    nextRow++;
    while (nextRow - 6 < values.length && occupied(nextRow - 6)) nextRow++;
  }
  if (planned.length) {
    const required = planned[planned.length - 1].row;
    if (required > board.getMaxRows()) {
      board.insertRowsAfter(board.getMaxRows(), required - board.getMaxRows());
    }
    // One complete row operation, never partial cell commits.
    planned.forEach(entry => board.getRange(entry.row, 1, 1, 26).setValues([entry.values]));
  }
  return planned.length;
}

/**
 * Optional error email (no customer data, no tokens, at most once per six
 * hours). Requires DIARY_ALERT_EMAIL and owner authorization for MailApp.
 */
function diaryNotifyFailure_() {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty('DIARY_ALERT_EMAIL');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  const now = Date.now();
  const last = Number(props.getProperty('DIARY_LAST_ALERT_AT') || 0);
  if (Number.isFinite(last) && now - last < 6 * 60 * 60 * 1000) return;
  try {
    MailApp.sendEmail(email, 'グルメ日誌：PR案件自動同期の確認が必要です',
      '新規PR案件のGoogle Sheets同期でエラーが発生しました。' +
      'Apps Scriptの「実行数」で詳細を確認してください。' +
      '受付原本は引き続きNetlify Formsにあります。');
    props.setProperty('DIARY_LAST_ALERT_AT', String(now));
  } catch {
    // Do not conceal the original sync error if email permissions are absent.
  }
}

function syncDiaryNetlifyForms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const { token, siteId, spreadsheetId } = diaryProperties_();
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(DIARY_SYNC.tabName);
    if (!sheet) throw new Error('07_自動受付 シートがありません');

    const existing = new Set();
    if (sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      ids.forEach(([id]) => { if (id) existing.add(String(id)); });
    }
    const root = DIARY_SYNC.apiOrigin + '/api/v1';
    const forms = diaryRequest_(root + '/sites/' + encodeURIComponent(siteId) + '/forms', token);
    const found = forms.filter(f => f && f.name === DIARY_SYNC.formName);
    if (found.length !== 1 || !/^[a-z0-9-]{8,128}$/i.test(String(found[0].id))) {
      throw new Error('対象フォームが一意に特定できません。処理を中止しました');
    }
    const formId = found[0].id;
    const prefix = root + '/forms/' + encodeURIComponent(formId) + '/submissions';
    const current = new Date();
    const newRows = [];
    const boardCandidates = new Map();
    let completed = false;

    for (let page = 1; page <= DIARY_SYNC.limitPages; page++) {
      // Default state is verified/ham submissions; do NOT request spam.
      const data = diaryRequest_(prefix + '?page=' + page + '&per_page=' + DIARY_SYNC.pageSize, token);
      for (const entry of data) {
        const row = diaryToRow_(entry, current);
        if (row) {
          boardCandidates.set(row[0], row);
          if (!existing.has(row[0])) {
            existing.add(row[0]);
            newRows.push(row);
          }
        }
      }
      if (data.length < DIARY_SYNC.pageSize) { completed = true; break; }
    }
    if (!completed) throw new Error('安全上限を超えたため中断。既存行は変更されていません');
    // Most recent first in the API; append older first to preserve history.
    newRows.reverse();
    if (newRows.length) {
      const start = sheet.getLastRow() + 1;
      if (start + newRows.length - 1 > sheet.getMaxRows()) {
        sheet.insertRowsAfter(sheet.getMaxRows(), start + newRows.length - 1 - sheet.getMaxRows());
      }
      sheet.getRange(start, 1, newRows.length, 14).setValues(newRows);
    }
    const boardEnabled = PropertiesService.getScriptProperties()
      .getProperty('DIARY_BOARD_AUTOCREATE_ENABLED') === 'true';
    const boardCount = boardEnabled ?
      diaryReconcileBoard_(ss, Array.from(boardCandidates.values()).reverse()) : 0;
    PropertiesService.getScriptProperties().setProperty('DIARY_LAST_BOARD_COUNT', String(boardCount));
    PropertiesService.getScriptProperties().setProperty('DIARY_LAST_SUCCESS', new Date().toISOString());
    PropertiesService.getScriptProperties().setProperty('DIARY_LAST_COUNT', String(newRows.length));
    console.log('Diary Netlify sync OK; new submissions:', newRows.length);
  } catch (error) {
    diaryNotifyFailure_();
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function setupDiaryAutoSync() {
  diaryProperties_();
  // A failed connectivity check MUST NOT delete the existing working trigger.
  // This is idempotent: re-running setup never creates overlapping pollers.
  syncDiaryNetlifyForms();
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncDiaryNetlifyForms');
  if (!triggers.length) {
    ScriptApp.newTrigger('syncDiaryNetlifyForms')
      .timeBased().everyMinutes(DIARY_SYNC.triggerMinutes).create();
  } else {
    triggers.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
  }
  console.log('Diary auto-sync active (one trigger, every 5 minutes when newly installed).');
}

function stopDiaryAutoSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncDiaryNetlifyForms')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Diary auto-sync stopped. Data is preserved.');
}


/**
 * Optional private operational state bridge for グルメ日誌.
 * Copy this file into the SAME Apps Script project as
 * diary-netlify-sheets-sync.gs, on the existing owner-approved Sheet.
 *
 * Deployment must be explicitly approved. A Web App executed as the owner
 * has an anonymously reachable URL, but this handler will NOT read or write
 * anything without a fresh, signed HMAC request from a Netlify Function.
 *
 * Script Property DIARY_SHEETS_HMAC_SECRET: 32+ random chars, matching Netlify.
 * Run setupDiaryOpsAuditSheet by hand, then deploy as Web app (execute as me).
 */
const DIARY_OPS_COLUMNS_ = Object.freeze({
  status: 4, nextAction: 5, dueDate: 6, agreedFee: 9,
  visitDate: 10, postDate: 11, paidAmount: 13,
  postUrl: 19, note: 20,
});
const DIARY_OPS_STATES_ = [
  '未対応', '返信済', '見積・条件調整', '成約', '来店済',
  '制作中', '投稿済', '請求済', '入金済', '完了', '終了',
];
const DIARY_OPS_AUDIT_ = '08_変更履歴';

function diaryOpsHex_(bytes) {
  return bytes.map(x => ('0' + (x & 255).toString(16)).slice(-2)).join('');
}
function diaryOpsDigest_(value) {
  return diaryOpsHex_(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8));
}
function diaryOpsNumber_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || '').replace(/[¥,\s]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
function diaryOpsDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(value || '').slice(0, 10).replace(/\//g, '-');
}
function diaryOpsLiteral_(value, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error('invalid');
  }
  return /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value;
}
function diaryOpsSnapshot_(row) {
  return {
    status: String(row[3] || '未対応'),
    nextAction: String(row[4] || ''),
    dueDate: diaryOpsDate_(row[5]),
    agreedFee: diaryOpsNumber_(row[8]),
    visitDate: diaryOpsDate_(row[9]),
    postDate: diaryOpsDate_(row[10]),
    paidAmount: diaryOpsNumber_(row[12]),
    postUrl: String(row[18] || ''),
    note: String(row[19] || ''),
  };
}
function diaryOpsItem_(row) {
  const state = diaryOpsSnapshot_(row);
  const id = String(row[20] || '').trim();
  return Object.assign({ id, version: diaryOpsDigest_(JSON.stringify(state)) }, state);
}
function diaryOpsVerify_(envelope, properties) {
  const secret = properties.getProperty('DIARY_SHEETS_HMAC_SECRET');
  if (!secret || secret.length < 32) return false;
  if (!envelope || typeof envelope !== 'object' ||
      !['list', 'update'].includes(envelope.action) ||
      !Number.isSafeInteger(envelope.timestamp) ||
      Math.abs(Date.now() - envelope.timestamp) > 300000 ||
      !/^[a-f0-9]{32}$/.test(String(envelope.nonce || '')) ||
      !/^[a-f0-9]{64}$/.test(String(envelope.signature || '')) ||
      !envelope.payload || typeof envelope.payload !== 'object') return false;
  const canonical = envelope.action + '\n' + envelope.timestamp + '\n' +
    envelope.nonce + '\n' + JSON.stringify(envelope.payload);
  const signature = diaryOpsHex_(Utilities.computeHmacSha256Signature(
    canonical, secret, Utilities.Charset.UTF_8));
  // Constant-time-ish fixed-length compare avoids short-circuiting on bytes.
  let difference = 0;
  for (let i = 0; i < 64; i++) {
    difference |= signature.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  }
  return difference === 0;
}
function diaryOpsSafePatch_(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('invalid');
  const keys = Object.keys(patch);
  if (!keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(DIARY_OPS_COLUMNS_, key))) {
    throw Error('invalid');
  }
  const out = {};
  keys.forEach(key => {
    const value = patch[key];
    if (key === 'status') {
      if (!DIARY_OPS_STATES_.includes(value)) throw Error('invalid');
      out[key] = value;
    } else if (key === 'agreedFee' || key === 'paidAmount') {
      if (!Number.isSafeInteger(value) || value < 0 || value > 1000000000) throw Error('invalid');
      out[key] = value;
    } else if (['dueDate', 'visitDate', 'postDate'].includes(key)) {
      if (typeof value !== 'string' || (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw Error('invalid');
      out[key] = value;
    } else if (key === 'postUrl') {
      if (typeof value !== 'string' || value.length > 300 ||
          (value && !/^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?(?:\?.*)?$/.test(value))) {
        throw Error('invalid');
      }
      out[key] = diaryOpsLiteral_(value, 300);
    } else {
      out[key] = diaryOpsLiteral_(value, key === 'note' ? 2000 : 500);
    }
  });
  return out;
}
function diaryOpsOpen_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id || !/^[A-Za-z0-9_-]{20,120}$/.test(id)) throw Error('unavailable');
  const sheet = SpreadsheetApp.openById(id).getSheetByName('01_案件ボード');
  if (!sheet) throw Error('unavailable');
  const header = sheet.getRange(5, 1, 1, 26).getDisplayValues()[0];
  if (header[3] !== '進捗ステータス' || header[20] !== 'Netlify受付ID') throw Error('unavailable');
  return sheet;
}
function diaryOpsRows_(sheet) {
  const actualRows = Math.max(0, sheet.getLastRow() - 5);
  // Never display stale/incomplete financial totals as if they were complete.
  // Operators must archive or migrate before extending beyond this bound.
  if (actualRows > 1000) throw Error('unavailable');
  return actualRows ? sheet.getRange(6, 1, actualRows, 26).getValues() : [];
}
/**
 * Detect interrupted edits before allowing another write or returning a
 * supposedly consistent operational snapshot. BEGIN entries MUST have a
 * matching COMMITTED entry for the same case/field set/base revision.
 * A pending journal needs human reconciliation; this function never guesses.
 */
function diaryOpsRequireCleanJournal_(audit, targetId) {
  if (!audit) throw Error('unavailable');
  const entries = Math.max(0, audit.getLastRow() - 1);
  if (entries > 5000) throw Error('unavailable');
  if (!entries) return;
  // B:F holds receipt ID, changed fields, before and after revisions, status.
  const events = audit.getRange(2, 2, entries, 5).getValues();
  const pending = new Map();
  events.forEach(row => {
    const id = String(row[0] || '');
    if (targetId && id !== targetId) return;
    const status = String(row[4] || '');
    const key = JSON.stringify([id, String(row[1] || ''), String(row[2] || '')]);
    if (status === 'BEGIN') pending.set(key, (pending.get(key) || 0) + 1);
    else if (status === 'COMMITTED') pending.set(key, (pending.get(key) || 0) - 1);
    else if (id) throw Error('conflict');
  });
  if ([...pending.values()].some(value => value !== 0)) throw Error('conflict');
}

function diaryOpsList_() {
  const sheet = diaryOpsOpen_();
  diaryOpsRequireCleanJournal_(sheet.getParent().getSheetByName(DIARY_OPS_AUDIT_));
  const records = diaryOpsRows_(sheet);
  const ids = new Set();
  const items = [];
  records.forEach(row => {
    const id = String(row[20] || '');
    if (!/^[A-Za-z0-9-]{8,128}$/.test(id)) return;
    if (ids.has(id)) throw Error('conflict');
    ids.add(id);
    items.push(diaryOpsItem_(row));
  });
  return { ok: true, items };
}
function diaryOpsUpdate_(payload) {
  if (!payload || typeof payload !== 'object' ||
    !/^[A-Za-z0-9-]{8,128}$/.test(String(payload.id || '')) ||
    !/^[a-f0-9]{64}$/.test(String(payload.expectedVersion || ''))) throw Error('invalid');
  const patch = diaryOpsSafePatch_(payload.patch);
  const sheet = diaryOpsOpen_();
  const audit = sheet.getParent().getSheetByName(DIARY_OPS_AUDIT_);
  if (!audit) throw Error('unavailable'); // An unlogged write is forbidden.
  diaryOpsRequireCleanJournal_(audit, payload.id);
  const rows = diaryOpsRows_(sheet);
  const matches = [];
  rows.forEach((row, i) => { if (String(row[20] || '') === payload.id) matches.push(i); });
  if (!matches.length) throw Error('not_found');
  if (matches.length !== 1) throw Error('conflict');

  const currentRow = rows[matches[0]];
  const before = diaryOpsItem_(currentRow);
  if (before.version !== payload.expectedVersion) throw Error('conflict');
  const newRow = currentRow.slice();
  Object.entries(patch).forEach(([field, value]) => {
    newRow[DIARY_OPS_COLUMNS_[field] - 1] = value;
  });
  const physicalRow = matches[0] + 6;
  const formulas = sheet.getRange(physicalRow, 1, 1, 26).getFormulas()[0];
  // Never overwrite a calculated cell or touch unrelated fields (including
  // untrusted contact data, manual comments, and the outstanding-balance formula).
  if (Object.keys(patch).some(field => formulas[DIARY_OPS_COLUMNS_[field] - 1])) {
    throw Error('conflict');
  }
  const after = diaryOpsItem_(newRow);
  if (after.version === before.version) return { ok: true, item: before };
  const changeFields = Object.keys(patch);
  const record = [new Date(), payload.id, changeFields.join(','),
    before.version, after.version];
  // Append a BEGIN record BEFORE edits. If any later call fails, this
  // remains visible for reconciliation rather than silently losing the audit.
  audit.appendRow(record.concat(['BEGIN']));
  changeFields.forEach(field => {
    const column = DIARY_OPS_COLUMNS_[field];
    sheet.getRange(physicalRow, column).setValue(patch[field]);
  });
  // Google Sheets can normalize literal prefixes, date formats, and numbers.
  // Report the value actually stored, never an optimistic client-side guess.
  SpreadsheetApp.flush();
  const persisted = diaryOpsItem_(sheet.getRange(physicalRow, 1, 1, 26).getValues()[0]);
  if (persisted.version === before.version) throw Error('unavailable');
  // A missing COMMITTED record must be investigated; never return success.
  audit.appendRow([new Date(), payload.id, changeFields.join(','),
    before.version, persisted.version, 'COMMITTED']);
  return { ok: true, item: persisted };
}
function setupDiaryOpsAuditSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw Error('unavailable');
  const ss = SpreadsheetApp.openById(id);
  let audit = ss.getSheetByName(DIARY_OPS_AUDIT_);
  if (!audit) audit = ss.insertSheet(DIARY_OPS_AUDIT_);
  if (!audit.getLastRow()) {
    audit.appendRow(['変更日時', 'Netlify受付ID', '変更フィールド', '変更前バージョン', '変更後バージョン', '記録状態']);
  }
}
/**
 * Public-facing Apps Script web app endpoint. No customer data is exposed
 * unless the request carries a valid, one-time HMAC from Netlify.
 * We cannot set HTTP status codes in ContentService; callers check {ok}.
 */
function doPost(e) {
  const fail = code => ContentService.createTextOutput(JSON.stringify({ ok: false, error: code }))
    .setMimeType(ContentService.MimeType.JSON);
  if (!e || !e.postData || typeof e.postData.contents !== 'string' ||
      e.postData.contents.length > 12000) return fail('invalid');
  let envelope;
  try { envelope = JSON.parse(e.postData.contents); } catch { return fail('invalid'); }
  // Verify before acquiring the lock so unauthenticated requests cannot
  // monopolize the shared sync/write mutex.
  if (!diaryOpsVerify_(envelope, PropertiesService.getScriptProperties())) return fail('invalid');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return fail('rate_limited');
  try {
    const cache = CacheService.getScriptCache();
    const key = 'DIARY_OPS_' + envelope.nonce;
    if (cache.get(key)) return fail('invalid');
    cache.put(key, '1', 600);
    const result = envelope.action === 'list' ? diaryOpsList_() : diaryOpsUpdate_(envelope.payload);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const allowed = ['invalid', 'not_found', 'conflict', 'unavailable'];
    return fail(error && allowed.includes(error.message) ? error.message : 'unavailable');
  } finally {
    lock.releaseLock();
  }
}


/**
 * グルメ日誌 | Apps Script 統合診断 (2026-10-22)
 *
 * Install in the SAME container-bound project as:
 *   diary-netlify-sheets-sync.gs
 *   diary-ops-state-webapp.gs
 *
 * This file never transmits or displays customer records or secret values.
 * checkDiaryIntegrationReadiness() is READ-ONLY.
 *
 * After owner authorizes live writes, activateDiaryIntegration() installs
 * exactly one 5-minute trigger and performs the first real synchronization.
 * Its safety gate must be set explicitly in Script Properties.
 */
const DIARY_INTEGRATION_HEADERS_ = Object.freeze({
  intake: ['Netlify受付ID', '受付日時', '店舗・企業名', '担当者',
    'メールアドレス', '希望PR', '区分', '相談内容', '紹介メニュー',
    '来店希望', '受付元', '最終同期時刻', '確認ステータス', '運用メモ'],
  audit: ['変更日時', 'Netlify受付ID', '変更フィールド',
    '変更前バージョン', '変更後バージョン', '記録状態'],
});

function diaryIntegrationValidId_(v) {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{20,120}$/.test(v);
}

function diaryIntegrationCheck_(ok, id, message) {
  return { id, ok: Boolean(ok), message };
}

function diaryIntegrationReadiness_() {
  const p = PropertiesService.getScriptProperties();
  const checks = [];
  const get = name => p.getProperty(name);
  const sheetId = get('SPREADSHEET_ID');
  let sheetReady = false;
  let auditReady = false;
  let boundSheetMatches = false;
  let inspectError = false;

  if (diaryIntegrationValidId_(sheetId)) {
    try {
      const ss = SpreadsheetApp.openById(sheetId);
      const bound = SpreadsheetApp.getActiveSpreadsheet();
      boundSheetMatches = Boolean(bound && bound.getId() === sheetId);
      const intake = ss.getSheetByName('07_自動受付');
      const board = ss.getSheetByName('01_案件ボード');
      const audit = ss.getSheetByName('08_変更履歴');
      const same = (sheet, expected, row) => {
        if (!sheet) return false;
        const actual = sheet.getRange(row, 1, 1, expected.length).getDisplayValues()[0];
        return expected.every((label, i) => String(actual[i]) === label);
      };
      const caseHeaders = board && board.getRange(5, 1, 1, 26).getDisplayValues()[0];
      sheetReady = Boolean(same(intake, DIARY_INTEGRATION_HEADERS_.intake, 1) &&
        caseHeaders && caseHeaders[2] === '店舗・企業' &&
        caseHeaders[3] === '進捗ステータス' &&
        caseHeaders[20] === 'Netlify受付ID');
      auditReady = same(audit, DIARY_INTEGRATION_HEADERS_.audit, 1);
    } catch (_) { inspectError = true; }
  }

  checks.push(diaryIntegrationCheck_(diaryIntegrationValidId_(sheetId) &&
    sheetReady && boundSheetMatches && !inspectError,
    'sheet_schema', '紐付けた既存管理表と受付/案件列が一致'));
  checks.push(diaryIntegrationCheck_(auditReady,
    'audit_schema', '変更履歴6列の見出しが一致'));
  checks.push(diaryIntegrationCheck_(typeof get('NETLIFY_API_TOKEN') === 'string' &&
    get('NETLIFY_API_TOKEN').length >= 16,
    'netlify_token', 'Netlify APIトークンがScript Propertiesに存在'));
  checks.push(diaryIntegrationCheck_(/^[0-9a-f-]{30,40}$/i.test(get('NETLIFY_SITE_ID') || ''),
    'netlify_site_id', 'Netlify Site API IDが設定済み'));
  checks.push(diaryIntegrationCheck_(typeof get('DIARY_SHEETS_HMAC_SECRET') === 'string' &&
    get('DIARY_SHEETS_HMAC_SECRET').length >= 32,
    'hmac_secret', '署名用の強い秘密値が設定済み'));
  checks.push(diaryIntegrationCheck_(get('DIARY_BOARD_AUTOCREATE_ENABLED') === 'true',
    'board_auto_create', '案件ボードへの自動登録が許可されている'));

  let triggers = null;
  try {
    triggers = ScriptApp.getProjectTriggers()
      .filter(trigger => trigger.getHandlerFunction() === 'syncDiaryNetlifyForms').length;
  } catch (_) { triggers = null; }
  checks.push(diaryIntegrationCheck_(triggers === 1,
    'five_minute_trigger', '重複のない定期同期トリガーが1つ存在'));

  const stamp = get('DIARY_LAST_SUCCESS') || '';
  const timestamp = Date.parse(stamp);
  const ageMinutes = Number.isFinite(timestamp) ? (Date.now() - timestamp) / 60000 : null;
  // No stale success may be reported as currently healthy.
  const recent = ageMinutes !== null && ageMinutes >= 0 && ageMinutes <= 20;
  checks.push(diaryIntegrationCheck_(recent,
    'recent_sync_success', '過去20分以内の同期成功記録が存在'));

  return {
    // No identifiers, emails, secrets, lead names, or financial figures.
    version: 'v1',
    configured: checks.slice(0, 6).every(item => item.ok),
    running: checks.every(item => item.ok),
    checks,
    triggerCount: triggers,
    minutesSinceSuccess: ageMinutes === null ? null : Math.round(ageMinutes),
    lastError: null, // Error text is never included to avoid leaking PII.
    originalDataUntouched: true,
  };
}

/** Read-only status check; safe even before provisioning. */
function checkDiaryIntegrationReadiness() {
  return diaryIntegrationReadiness_();
}

/**
 * Optional preflight for Netlify credentials. Reads the FORMS METADATA only;
 * does not fetch a single submission or write any spreadsheet cell.
 */
function verifyDiaryNetlifyConnection() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('NETLIFY_API_TOKEN');
  const siteId = p.getProperty('NETLIFY_SITE_ID');
  if (!token || token.length < 16 || !/^[0-9a-f-]{30,40}$/i.test(siteId || '')) {
    throw Error('integration_not_configured');
  }
  const forms = diaryRequest_(
    DIARY_SYNC.apiOrigin + '/api/v1/sites/' + encodeURIComponent(siteId) + '/forms',
    token);
  const matching = forms.filter(f => f && f.name === DIARY_SYNC.formName &&
    /^[a-z0-9-]{8,128}$/i.test(String(f.id || '')));
  if (matching.length !== 1) throw Error('integration_form_missing_or_ambiguous');
  return { apiReachable: true, formFound: true, readOnly: true };
}

/**
 * Run manually only after the owner has tested the backup and approved
 * writing to the existing production Sheet. Fails BEFORE any write if the
 * audit/schema/secrets/board-autocreate gates are not all satisfied.
 * Netlify Identity and the signed Web app are separate admin steps.
 */
function activateDiaryIntegration() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('DIARY_INTEGRATION_APPROVED') !== 'true') {
    throw Error('integration_not_approved');
  }
  const status = diaryIntegrationReadiness_();
  const required = ['sheet_schema', 'audit_schema', 'netlify_token',
    'netlify_site_id', 'hmac_secret', 'board_auto_create'];
  if (required.some(id => !status.checks.find(c => c.id === id).ok)) {
    throw Error('integration_preflight_failed');
  }
  // Verify the form is unique and accessible before changing any data.
  verifyDiaryNetlifyConnection();
  setupDiaryAutoSync();
  const result = diaryIntegrationReadiness_();
  if (!result.running) throw Error('integration_postcheck_failed');
  return { running: true, triggerCount: result.triggerCount, secretsDisclosed: false };
}

/** Emergency stop: disable automatic updates without deleting any user data. */
function stopDiaryIntegration() {
  stopDiaryAutoSync();
  return { running: false, originalDataPreserved: true };
}
