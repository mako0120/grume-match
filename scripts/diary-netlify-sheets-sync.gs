/**
 * グルメ日誌：Netlify Forms -> Google Sheets 定期取込
 *
 * Install in Apps Script linked to a COPY of the Google Sheet owned by
 * the dedicated Gmail account. Do not share this bound script with others.
 *
 * Script Properties (NOT script source, sheet cells, GitHub or chat):
 *   NETLIFY_API_TOKEN  - Netlify personal access token; protect as a secret
 *   NETLIFY_SITE_ID    - Netlify site API ID (UUID)
 *   SPREADSHEET_ID     - Google Sheet ID (dedicated Gmail-owned copy)
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
  if (count) {
    const keys = board.getRange(6, 1, count, 1).getDisplayValues();
    const sourceIds = board.getRange(6, 21, count, 1).getDisplayValues();
    const seenSources = new Set();
    keys.forEach((r, i) => {
      if (r[0]) ids.add(String(r[0]));
      const sourceId = String(sourceIds[i][0] || '').trim();
      if (sourceId) {
        if (seenSources.has(sourceId)) {
          throw new Error('案件ボードに受付IDの重複があります。自動登録を停止しました');
        }
        seenSources.add(sourceId);
        ids.add(sourceId);
      }
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

  let added = 0;
  for (const received of sourceRows) {
    const id = received[0];
    if (ids.has(id)) continue;
    if (nextRow > board.getMaxRows()) board.insertRowsAfter(board.getMaxRows(), 1);
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
    // One row operation preserves the financial formula in L, and a retry
    // deduplicates by column A even if another sheet write later fails.
    board.getRange(nextRow, 1, 1, 26).setValues([newCase]);
    ids.add(id);
    added++;
    nextRow++;
    while (nextRow - 6 < values.length && occupied(nextRow - 6)) nextRow++;
  }
  return added;
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
  // Never install overlapping pollers; this also supports safe reconfiguration.
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncDiaryNetlifyForms')
    .forEach(t => ScriptApp.deleteTrigger(t));
  syncDiaryNetlifyForms();
  ScriptApp.newTrigger('syncDiaryNetlifyForms')
    .timeBased().everyMinutes(DIARY_SYNC.triggerMinutes).create();
  console.log('Diary auto-sync installed (every 5 minutes).');
}

function stopDiaryAutoSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncDiaryNetlifyForms')
    .forEach(t => ScriptApp.deleteTrigger(t));
  console.log('Diary auto-sync stopped. Data is preserved.');
}
