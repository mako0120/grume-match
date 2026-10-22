# グルメ日誌｜大阪 / grume-match の開発ルール

## Project
- GitHub: mako0120/grume-match
- 本番ブランチ: feat/gurume-diary-direct-pr（Netlify）
- 開発PR: #23 feat/diary-ops-dashboard-v1（ドラフト）
- 稼働中の受付: /diary/request → Netlify Forms diary-pr-inquiry → Netlify保存 → グルメ専用Gmail通知
- Web新画面 /diary/ops、Google Sheets「07_自動受付」、Apps Script同期は開発/設定途中。本番稼働と混同しない。

## 不変条件
- 受信した氏名、メール、相談内容はPII。外部送信、トークン埋め込み、公開DB、ログ記録、一般公開共有をしない。
- Supabase旧系統の/admin/diary-inquiriesとNetlify Formsの受付を混同しない。
- デフォルトはfail closed。認証・設定・権限が揃うまで機能OFF。
- PR表記と口コミ規約を守り、成約/請求/入金は人間確認。Stripe課金は事前承認。
- GitHub ActionsとNetlifyの無料枠を優先。最小のCI回数で品質検証。
- ユーザー承認なく本番マージ、公開、課金、データアクセス権の拡大はしない。

## 自動選択する開発スキル
- .agents/skills/gourmet-security-review/SKILL.md （漏洩・認証・秘密鍵）
- .agents/skills/gourmet-auto-sync/SKILL.md （Netlify↔Web↔Sheets）
- .agents/skills/gourmet-ui-quality/SKILL.md （PC/スマホUX）
- .agents/skills/gourmet-release-safety/SKILL.md （CI/本番公開）
- .agents/skills/gourmet-research-gate/SKILL.md （公式情報で採否判断）

Claude Code用にも同名スキルを .claude/skills/ に配置している。どちらのAIも、現在のタスクに該当するスキルを読んでから編集すること。
