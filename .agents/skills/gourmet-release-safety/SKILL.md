---
name: gourmet-release-safety
description: GitHub Actions無料枠とNetlifyクレジットを節約し、フォームを壊さずに段階公開する
---

# gourmet-release-safety

## 前提
GitHub mako0120/grume-match。Netlify本番ブランチ feat/gurume-diary-direct-pr。PR #23は開発中。
## リリース手順
- コミットをなるべくまとめ、まずテストとコードレビューを実施する。CI再実行連発を避ける。
- npm audit --omit=dev --audit-level=high、typecheck、lint、test、build。run/stepの skippedはsuccessではない。
- PRの変更に、顧客情報・秘密鍵・不要なプラグイン・料金変更・外部サービスへの許可なし送信がないことを確認。
- 公開フォーム送信→Netlify記録→Gmail通知は本番動作済み。改修後も回帰確認する。
- 本番にマージ/公開、Stripe課金、トークン発行、Netlify Identity有効化、Google Sheets共有変更はユーザー承認が必要。
- 先にNetlifyのfree planの費用と上限を調べる。2026年のcredit-based plansではproduction deploy、compute、requestsが別メーター。古い仕様に依存しない。
- ロールバックコミット、機能フラグOFF、安全なログを準備する。
## 報告
実装済み・テスト成功・本番未公開・必要なオーナー操作を明確に分ける。
