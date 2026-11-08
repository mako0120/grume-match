# Netlifyへ公開する前に（グルメ日誌｜大阪）

このGitHubリポジトリには別製品のPRマッチングOSも含まれています。

**グルメ日誌専用Webサイトを公開する場合、NetlifyのProduction branchには必ず `feat/gurume-diary-direct-pr` を設定してください。 `main` は別製品です。**

- Netlify Freeを選び、GitHubリポジトリ `mako0120/grume-match` を接続します。
- build command: `npm run build`、publish directory: `.next`、Node.js 22（`netlify.toml`に設定済み）。
- 初回は **DIARY_INQUIRIES_ENABLED=false / DIARY_STRIPE_ENABLED=false** で公開します。未接続時は相談フォームの代わりにInstagramのDMリンクを表示します。
- Netlifyの実URLが発行されたら、`NEXT_PUBLIC_SITE_URL` にその https:// URL を設定して再デプロイします。
- 企業からの受付を稼働させるには、新しいSupabaseプロジェクト、Cloudflare Turnstile、Resend通知が必要です。設定前に `DIARY_INQUIRIES_ENABLED=true` にしないでください。
- Stripeの後払い請求は本番請求書・税務情報を確認してから別途有効化します。
- 既存のBASE・eBayプロジェクトのVercel / Supabase / Stripe商品・サブスクには手を加えないでください。
- 詳細手順：`docs/NETLIFY_DIARY_DEPLOY.md`。

商用の無料ホスティングには使用枠があります。Netlify Freeは月間クレジット上限に達すると一時停止します。
