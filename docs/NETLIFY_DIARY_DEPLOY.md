# グルメ日誌｜大阪: Netlify deployment (2026-10-17)

Deployment target: **Netlify Free**, using a **dedicated Netlify site** linked to the existing public GitHub repository `mako0120/grume-match`. Do not link or change any BASE/eBay app. The diary website code currently lives on the feature branch **`feat/gurume-diary-direct-pr`**, while the repository default branch is the separate PR marketplace (`main`). **Choose the feature branch as Netlify's production branch. Never deploy `main` expecting the diary homepage.** Keep upstream PR #22 as a draft until the marketplace owner reviews it.

Netlify supports Next.js 16 App Router, Server Actions and API route handlers automatically with OpenNext. See https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/.


## 2026-10-18: 最短で本番相談を受け付ける方法（Netlify Forms）

**Supabase契約がなくても、Netlify標準Formsで無料相談・PR申込みを受信できます。** Netlify側でフォーム検出を有効にし、`diary-pr-inquiry` 登録を確認してから、`DIARY_NETLIFY_FORMS_ENABLED=true` を設定して再デプロイします。未設定の間はInstagram DM案内に切り替わります。NetlifyのFormsダッシュボードで相談を閲覧・返信し、必要ならメール通知を設定します。サイト独自の `/admin/diary-inquiries` やStripe課金とは別の簡易受付です。

必ず `docs/DIARY_NETLIFY_FORMS_RUNBOOK.md` の**試験送信の保存・メール通知の実確認**まで行い、Netlify管理画面で相談データが記録されるまで本番稼働とは宣言しないでください。フォーム送信は契約を自動成立させません。

既存のSupabase承認フロー・Stripe後払いを有効にしたい場合には、別途権限・契約・DB・Turnstile・本人確認・請求検証が必要です。

## Operator Netlify setup (Netlify authorization is required)

1. Sign in to https://app.netlify.com and use Free plan (commercial sites are allowed within resource quota; projects pause when the monthly 300 credit limit is exhausted).
2. Navigate **Add new project → Import an existing project → GitHub**. Grant Netlify GitHub access to `mako0120/grume-match` only (minimize repo access). Select production branch **`feat/gurume-diary-direct-pr`** (not `main`).
3. Project name: `gurume-diary-osaka` or an available similar name. Build settings follow root `netlify.toml`: `npm run build`, publish `.next`, Node 22; **do not add** `/* /index.html 200` or manually pin `@netlify/plugin-nextjs`.
4. In project **Environment variables** set secrets securely. **Do not paste secrets into GitHub or chat.** See below.
5. On first deploy confirm `/` redirects to `/diary`. Check `/diary`, `/diary/services`, `/diary/request` and all legal pages, then click **Publish** if the new team is private-by-default. Share the **actual** Netlify URL for further verification. Never guess the site URL.
6. Don't enable intake yet: first create a **separate Supabase project** using owner-approved organization/fees, apply migrations (entire app foundation first, then `202610160002`, `202610160003`, `202610170001`), create and secure operator auth role, and test private RLS plus API.
7. Set Cloudflare Turnstile keys with **exact Netlify hostname** allowed; set up Resend verified sender domain/address and `DIARY_OPERATOR_NOTIFY_EMAIL`; verify an end-to-end inquiry, proposal, confirmation and notification to an operator-controlled test mailbox.
8. Only then set `DIARY_INQUIRIES_ENABLED=true` and redeploy. Stripe live billing is a **separate gate**, left `DIARY_STRIPE_ENABLED=false` until invoice-tax and sandbox end-to-end tests. Existing shared Stripe account ID is `acct_1ULfr6B2xz6AKQNb` ("base ebay sync"). Never change its BASE/eBay price/product/subscriptions.
9. Audit Japanese seller/tax representation, privacy, cancellation/refund terms, owner-verified Instagram handle, price and social-media figures. Only then set `DIARY_PUBLIC_INDEX_ENABLED=true` and redeploy to enable search indexing.

## Environment variables (Netlify Site configuration → Environment variables)

Required for basic site build and publication:
- `DIARY_SITE_MODE=true` (set by production netlify.toml, directs homepage to /diary).
- `NEXT_PUBLIC_SITE_URL=https://YOUR-ACTUAL-NETLIFY-HOSTNAME.netlify.app`.
- `NEXT_PUBLIC_OPERATOR_NAME` legally accurate seller; `NEXT_PUBLIC_SUPPORT_EMAIL` supported contact address.
- `PUBLIC_LAUNCH_ENABLED=false` (separate multi-creator PR OS is not released).
- `DIARY_INQUIRIES_ENABLED=false`, `DIARY_STRIPE_ENABLED=false`, `DIARY_PUBLIC_INDEX_ENABLED=false` until manual launch checks.

Required for functioning inquiries, admin and booking:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: **new isolated Supabase project only**; server key encrypted and server-only.
- `NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY`, `DIARY_TURNSTILE_SECRET_KEY`: Cloudflare Turnstile, domain-bound.
- `NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY` public, secret key private.
- `RESEND_API_KEY`, `EMAIL_FROM`, `DIARY_OPERATOR_NOTIFY_EMAIL`: company date proposals and owner confirmation notifications.
- `CRON_SECRET`: 32+ random bytes secret string, used by Netlify Scheduled Function and authenticated `/api/cron/email`.

Required only for Stripe postpaid billing after separate testing:
- `DIARY_STRIPE_SECRET_KEY` (server-side key authorized for shared **base ebay sync** Stripe account).
- `DIARY_STRIPE_ACCOUNT_ID=acct_1ULfr6B2xz6AKQNb`, `DIARY_STRIPE_WEBHOOK_SECRET`.
- Configure webhook destination `https://YOUR-ACTUAL-HOST/api/diary/stripe/webhook` for events `invoice.paid`, `invoice.voided`, `invoice.marked_uncollectible`. Test signature verification with fixtures and sandbox event replay before enabling billing.
- `DIARY_STRIPE_ENABLED=true` only after signed approval for live invoicing and a 100% post-publication, 7-day term confirmed.

Other foundational platform release gates (`LEGAL_REVIEW_COMPLETED`, `ACCOUNTING_REVIEW_COMPLETED`, `PAYOUT_SECURITY_REVIEW_COMPLETED`, `RLS_E2E_VERIFIED`, `PILOT_E2E_COMPLETED`) must not be bypassed or forged.

## Scheduled function

`netlify/functions/diary-reconcile.mjs` runs `5 * * * *` UTC (once an hour) **only on production published deployment** and calls `GET /api/cron/email` with `Bearer CRON_SECRET`. The route is already used for operator email and diary Stripe invoice reconciliations. Inspect the Netlify function logs after enabling secrets. The function has a 27-second outbound HTTP timeout to fit the platform's 30-second scheduled function limit. Do **not** separately install a Vercel cron in Netlify.

## Safety notes

- This deployment is **not public / ready** until a real URL has been confirmed and the data/email/billing functional flows have been manually tested.
- Do not commit secrets, reuse the deactivated existing Supabase project, or copy BASE/eBay Vercel secrets into Netlify.
- Production content must not claim verified follower counts or fabricated performance figures. Confirm owner identity and Instagram link before external distribution.
- If Netlify Free plan reaches its monthly 300-credit limit, the site can pause; review usage regularly.

## Required privacy redeploy (2026-10-17)

Only already-published Instagram posts may appear in the business-facing website; private design-editor examples, IDs, shared-document links and template previews must be absent from both `/diary` and `/diary/services`. After deploying the privacy update, verify page HTML and client bundles expose no old viewer URLs. As of 2026-10-18, the owner switched Netlify Git source to `mako0120/grume-match` branch `feat/gurume-diary-direct-pr` and shared published UI text matching the updated branch. New commits must still be verified by deployed HEAD SHA and live submission check; do not assume every subsequent commit has deployed. The old duplicate repository is read-only in the ChatGPT GitHub connector. Independently revoke any previously exposed design-editor viewer links; link removal from new app code cannot revoke access to old URLs or Git history. Do not touch BASE/eBay deployments.
