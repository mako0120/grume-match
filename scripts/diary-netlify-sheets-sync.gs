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
  const urlObject = new URL(url);
  if (urlObject.origin !== DIARY_SYNC.apiOrigin ||
      !urlObject.pathname.startsWith('/api/v1/')) {
    throw new Error('Netlify以外への通信は禁止');
  }
  const resp = UrlFetchApp.fetch(urlObject.toString(), {
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
    let completed = false;

    for (let page = 1; page <= DIARY_SYNC.limitPages; page++) {
      // Default state is verified/ham submissions; do NOT request spam.
      const data = diaryRequest_(prefix + '?page=' + page + '&per_page=' + DIARY_SYNC.pageSize, token);
      for (const entry of data) {
        const row = diaryToRow_(entry, current);
        if (row && !existing.has(row[0])) {
          existing.add(row[0]);
          newRows.push(row);
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
    PropertiesService.getScriptProperties().setProperty('DIARY_LAST_SUCCESS', new Date().toISOString());
    PropertiesService.getScriptProperties().setProperty('DIARY_LAST_COUNT', String(newRows.length));
    console.log('Diary Netlify sync OK; new submissions:', newRows.length);
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
