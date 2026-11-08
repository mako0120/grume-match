#!/usr/bin/env node
/**
 * Offline production configuration gate. No network requests, secrets,
 * customer information, or implicit deployment changes.
 *
 *   npm run check:diary-launch
 *   node scripts/diary-launch-readiness.mjs --report
 *
 * A green CI build does NOT imply operational release approval. Manual
 * identity, real-submission, permissions and restore evidence is mandatory.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const has = v => typeof v === "string" && v.trim().length > 0;
const validEmail = v => has(v) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const validDate = v => has(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + "T00:00:00Z"));

export function assessDiaryLaunch(env = {}, currentDate = new Date()) {
  const required = [
    ["production_environment", env.CONTEXT === "production", "Netlifyのproductionコンテキストが必要です"],
    ["diary_site_mode", env.DIARY_SITE_MODE === "true", "PRの公開サイトモードを有効化してください"],
    ["intake", env.DIARY_NETLIFY_FORMS_ENABLED === "true", "Netlify Formsの実受付と通知確認が必要です"],
    ["operator_name", has(env.NEXT_PUBLIC_OPERATOR_NAME), "正式な運営者名称の設定が必要です"],
    ["support_contact", validEmail(env.NEXT_PUBLIC_SUPPORT_EMAIL), "有効な問い合わせ窓口が必要です"],
    ["verified_followers", /^\d+$/.test(env.DIARY_VERIFIED_FOLLOWERS || "") &&
      Number.isSafeInteger(Number(env.DIARY_VERIFIED_FOLLOWERS)),
      "実測したフォロワー数と基準日を登録してください"],
    ["followers_as_of", validDate(env.DIARY_FOLLOWERS_VERIFIED_AT) &&
      Date.parse(env.DIARY_FOLLOWERS_VERIFIED_AT + "T00:00:00Z") <= currentDate.getTime() &&
      currentDate.getTime() - Date.parse(env.DIARY_FOLLOWERS_VERIFIED_AT + "T00:00:00Z") <= 31 * 86400000,
      "フォロワー数の検証日を更新してください"],
  ].map(([id, ok, reason]) => ({ id, ok: Boolean(ok), reason }));

  const mandatoryLiveEvidence = [
    "既存URLでPC/スマホ表示とリンクを実ブラウザ確認",
    "Netlify Formsのテスト送信がNetlify原本と通知先へ届き、二重受信しない",
    "管理者認証/403・401/CSRF/失効を実環境で検証",
    "Google Sheetsへの受付と書込み・競合拒否・障害復元を実環境で確認",
    "運営者・所在地・連絡先・販売条件・適格請求書の必要性を実態に合わせ法務確認",
    "公開するInstagram実績値の一次資料を照合し、画像・広告表示の権利を確認",
  ];
  const formsConfigReady = required.every(r => r.ok);
  return {
    codeConfigurationReady: formsConfigReady,
    publicInquiryApproved: false,
    paidMarketplaceApproved: false,
    checks: required,
    manualApprovalRequired: mandatoryLiveEvidence,
    notes: [
      "このコマンドはNetlify・Google Sheets・本番フォームに接続しません",
      "環境変数が揃っても実運用テスト/法務確認なしに公開承認になりません",
      "Apps Script/Netlify Identity/MFAは接続ツールから自動確認できません",
      "管理者APIと自動保存は本番認証試験までOFFを維持してください",
    ],
  };
}

const self = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (self) {
  const report = assessDiaryLaunch(process.env);
  for (const check of report.checks) {
    process.stdout.write((check.ok ? "PASS " : "BLOCK ") + check.id +
      (check.ok ? "" : " — " + check.reason) + "\n");
  }
  process.stdout.write("MANUAL-GATES pending: " + report.manualApprovalRequired.length + "\n");
  process.stdout.write("PUBLIC_RELEASE_APPROVED=false (requires independent live evidence)\n");
  if (process.argv.includes("--strict") && !report.codeConfigurationReady) process.exitCode = 1;
}
