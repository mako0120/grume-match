/**
 * グルメ日誌｜既存Google Driveでの原本保護バックアップ（手動のみ）。
 *
 * 0) previewDiaryBackup() is READ-ONLY.
 * 1) Owner explicitly creates a private, unshared folder at My Drive root.
 * 2) Script Properties: SPREADSHEET_ID, DIARY_BACKUP_FOLDER_ID and
 *    DIARY_BACKUP_ENABLED=true. Never put these in sheet cells / GitHub.
 * 3) Owner runs createDiaryBackup() manually. NO automatic trigger is installed.
 * 4) verifyDiaryBackup(id) and planDiaryRestore(id) READ ONLY.
 *
 * The original sheet is NEVER modified by any function in this module.
 * No restore-to-original, cleanup of historical backups or auto-scheduling.
 */
const DIARY_BACKUP = Object.freeze({
  maxTabs: 30, maxCells: 150000, maxCellLength: 50000,
});

function diaryBackupSha_(raw) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8)
    .map(n => ('0' + (n & 255).toString(16)).slice(-2)).join('');
}

function diaryBackupId_(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,120}$/.test(id)) {
    throw Error('backup_invalid_id');
  }
  return id;
}

function diaryBackupNormalize_(value, formula) {
  if (formula) return ['formula', formula]; // ignore volatile evaluated formula output
  if (value instanceof Date) return ['date', value.getTime()];
  if (typeof value === 'number') return ['number', value];
  if (typeof value === 'boolean') return ['boolean', value];
  const text = String(value == null ? '' : value);
  if (text.length > DIARY_BACKUP.maxCellLength) throw Error('backup_data_too_large');
  return ['text', text];
}

// Return ONLY tab names, dimensions and digests. No business/customer values.
function diaryBackupSnapshot_(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  if (!sheets.length || sheets.length > DIARY_BACKUP.maxTabs) throw Error('backup_size_limit');
  let cells = 0;
  const result = sheets.map(sheet => {
    const name = sheet.getName();
    const rows = sheet.getLastRow(), columns = sheet.getLastColumn();
    if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) ||
      rows < 0 || columns < 0) throw Error('backup_invalid_dimensions');
    cells += rows * columns;
    if (cells > DIARY_BACKUP.maxCells) throw Error('backup_size_limit');
    let signature = [];
    if (rows && columns) {
      const range = sheet.getRange(1, 1, rows, columns);
      const values = range.getValues();
      const formulas = range.getFormulas();
      signature = values.map((line, i) =>
        line.map((value, j) => diaryBackupNormalize_(value, formulas[i][j])));
    }
    return { name, rows, columns, sha256: diaryBackupSha_(JSON.stringify(signature)) };
  });
  if (!result.some(tab => tab.name === '01_案件ボード') ||
      !result.some(tab => tab.name === '07_自動受付')) throw Error('backup_missing_tabs');
  result.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return { sheets: result, sha256: diaryBackupSha_(JSON.stringify(result)), cells };
}

function diaryBackupProps_() {
  const props = PropertiesService.getScriptProperties();
  const id = diaryBackupId_(props.getProperty('SPREADSHEET_ID'));
  return { props, id };
}

// This function makes no Drive copies and requires no backup destination.
function previewDiaryBackup() {
  const { id } = diaryBackupProps_();
  return diaryBackupSnapshot_(SpreadsheetApp.openById(id));
}

function diaryBackupPrivateFolder_(id, file) {
  const folderId = diaryBackupId_(id);
  const folder = DriveApp.getFolderById(folderId);
  const email = Session.getEffectiveUser().getEmail();
  const owner = file.getOwner();
  const folderOwner = folder.getOwner();
  if (!email || !owner || !folderOwner ||
      owner.getEmail() !== email || folderOwner.getEmail() !== email ||
      folder.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      folder.getEditors().length || folder.getViewers().length) {
    throw Error('backup_private_folder_required');
  }
  // Do not create copies inside inherited/shared folders or shared drives.
  const parent = folder.getParents();
  if (!parent.hasNext() || parent.next().getId() !== DriveApp.getRootFolder().getId() ||
      parent.hasNext()) throw Error('backup_root_folder_required');
  return folder;
}

function diaryBackupValidateCopy_(file, folder) {
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      file.getEditors().length || file.getViewers().length ||
      file.getOwner().getEmail() !== Session.getEffectiveUser().getEmail()) {
    throw Error('backup_copy_not_private');
  }
  const parents = file.getParents();
  if (!parents.hasNext() || parents.next().getId() !== folder.getId() ||
      parents.hasNext()) throw Error('backup_wrong_folder');
}

/** Explicit ONE-OFF action, OFF by default. Never writes to the original Sheet. */
function createDiaryBackup() {
  const { props, id } = diaryBackupProps_();
  if (props.getProperty('DIARY_BACKUP_ENABLED') !== 'true') {
    throw Error('backup_disabled');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw Error('backup_busy');
  let copy = null;
  try {
    const sourceFile = DriveApp.getFileById(id);
    const folder = diaryBackupPrivateFolder_(props.getProperty('DIARY_BACKUP_FOLDER_ID'), sourceFile);
    const expected = diaryBackupSnapshot_(SpreadsheetApp.openById(id));
    const stamp = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMdd_HHmmss');
    copy = sourceFile.makeCopy('グルメ日誌_BACKUP_' + stamp, folder);
    diaryBackupValidateCopy_(copy, folder);
    const actual = diaryBackupSnapshot_(SpreadsheetApp.openById(copy.getId()));
    const sourceAfter = diaryBackupSnapshot_(SpreadsheetApp.openById(id));
    if (actual.sha256 !== expected.sha256 || sourceAfter.sha256 !== expected.sha256) {
      throw Error('backup_verification_failed');
    }
    const manifest = { id: copy.getId(), at: new Date().toISOString(),
      sha256: actual.sha256, sheetCount: actual.sheets.length, cells: actual.cells };
    // The metadata has no PII and stays in Script Properties, not GitHub.
    props.setProperty('DIARY_LAST_BACKUP_MANIFEST', JSON.stringify(manifest));
    return manifest;
  } catch (error) {
    // A failed/partially verified duplicate must never be trusted as a backup.
    // It is a new copy, NOT the original. Attempt to send it to owner's Trash.
    if (copy) { try { copy.setTrashed(true); } catch (_) {} }
    throw Error('backup_not_created_or_verified');
  } finally {
    lock.releaseLock();
  }
}

/** Read-only: validate a previously verified copy without modifying either file. */
function verifyDiaryBackup(backupId) {
  const { props, id } = diaryBackupProps_();
  const record = JSON.parse(props.getProperty('DIARY_LAST_BACKUP_MANIFEST') || 'null');
  if (!record || record.id !== diaryBackupId_(backupId) ||
      !/^[a-f0-9]{64}$/.test(String(record.sha256 || ''))) {
    throw Error('backup_not_registered');
  }
  const originalFile = DriveApp.getFileById(id);
  const folder = diaryBackupPrivateFolder_(props.getProperty('DIARY_BACKUP_FOLDER_ID'), originalFile);
  const backup = DriveApp.getFileById(backupId);
  diaryBackupValidateCopy_(backup, folder);
  if (backup.isTrashed()) throw Error('backup_trashed');
  const snapshot = diaryBackupSnapshot_(SpreadsheetApp.openById(backupId));
  if (snapshot.sha256 !== record.sha256) throw Error('backup_integrity_failed');
  return { verified: true, id: backupId, at: record.at, sha256: snapshot.sha256,
    sheetCount: snapshot.sheets.length, cells: snapshot.cells };
}

/**
 * Read-only restoration PLAN, not a restore. Differences are tab names ONLY.
 * A changed live sheet is expected after newer submissions.
 */
function planDiaryRestore(backupId) {
  const verified = verifyDiaryBackup(backupId);
  const backup = diaryBackupSnapshot_(SpreadsheetApp.openById(backupId));
  const current = previewDiaryBackup();
  const currentTabs = new Map(current.sheets.map(tab => [tab.name, tab.sha256]));
  const savedTabs = new Map(backup.sheets.map(tab => [tab.name, tab.sha256]));
  const changedTabs = [...new Set([...currentTabs.keys(), ...savedTabs.keys()])]
    .filter(name => currentTabs.get(name) !== savedTabs.get(name));
  return { verified: verified.verified, backupId, currentMatchesBackup: !changedTabs.length,
    changedTabs, originalUntouched: true, restorationPerformed: false };
}
