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
