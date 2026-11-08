---
name: gourmet-auto-sync
description: Netlify FormsのPR依頼をWeb管理画面と非公開Google Sheetsに安全かつ低コストで同期する
---

# gourmet-auto-sync

## Source of truth
Netlify Formsのdiary-pr-inquiryが受付の原本。管理DB/Google Sheetsの受付IDをキーに重複排除。契約状況・来店・投稿・入金は別の運用正本で記録する。
## 必須ルール
- 既存の公開フォーム、__forms.html、Gmail通知を変更しない。フォーム送信と管理同期は別システムとして疎結合。
- 一般公開APIから顧客データを読むことは禁止。Netlify Identityの招待制＋ロールをサーバーで検証。NetlifyトークンをJSバンドルに混入させない。
- Google Sheetsは専用Gmail所有の複製で運用し、Apps Scriptのプロパティにsecretを保管。トークンや担当者メールをログやスクリプトコードに埋め込まない。
- 同期はApps Scriptの5分間隔を第一候補に、無料枠と障害リスクを計算して選択。1分ポーリングは費用/呼び出し回数を評価するまで自動で有効化しない。
- API 401/403/timeout/page-limit/duplicate/out-of-order に対応し、失敗を0件の成功として表示しない。同期時刻・差分件数を確認する。
- 自動成約、自動請求、実入金未確認の自動「入金済」、有償口コミ・ステマの要求は拒否。
## リファレンス
docs/DIARY_AUTO_SYNC_ACTIVATION.md, scripts/diary-netlify-sheets-sync.gs, tests/diary-sheets-sync.test.mjs
## 完了基準
Netlify検証済み新規1件→Sheetsの自動受付に1件だけ→Webの管理者限定表示、更新失敗時の安全動作まで検証する。
