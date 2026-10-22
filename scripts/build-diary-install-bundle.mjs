#!/usr/bin/env node
/**
 * Regenerate the single-paste Apps Script bundle.
 * Usage: node scripts/build-diary-install-bundle.mjs
 * Generated code contains no secrets or customer information.
 */
import { readFileSync, writeFileSync } from "node:fs";

export const DIARY_GS_SOURCES = [
  "scripts/diary-netlify-sheets-sync.gs",
  "scripts/diary-ops-state-webapp.gs",
  "scripts/diary-integration-readiness.gs",
];
export const DIARY_BUNDLE_HEADER = "/**\n * グルメ日誌 | Google Apps Script 単一ファイル導入版\n * GENERATED FILE — do not hand-edit. Source: the three .gs files.\n *\n * Paste once into the Apps Script project bound to the EXISTING university-\n * owned Google Sheet. Add secrets only in Script Properties, never here.\n * See docs/DIARY_ACTIVATION_ONE_PAGE.md.\n */";
export const DIARY_BUNDLE_PATH = "scripts/diary-ops-install-bundle.gs";
export function generateDiaryBundle() {
  return DIARY_BUNDLE_HEADER + "\n\n" +
    DIARY_GS_SOURCES.map(path => readFileSync(path, "utf8")).join("\n\n");
}
if (process.argv[1]?.endsWith("build-diary-install-bundle.mjs")) {
  writeFileSync(DIARY_BUNDLE_PATH, generateDiaryBundle(), "utf8");
}
