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
