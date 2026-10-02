# Local / Supabase / Vercel Setup

## 1. Local app

Requirements:
- Node.js 24
- npm 11

```bash
npm install
cp .env.example .env.local
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Database checks (needs a local PostgreSQL 16 superuser connection):

```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=... npm run test:db
```

`supabase/tests/run.sh` recreates a throwaway database (`pr_os_test`), applies a minimal Supabase stub (`auth.uid()`, `anon`/`authenticated` roles, Storage tables) and **every migration**, then runs the SQL scenarios in `supabase/tests/*.test.sql`. Scenarios impersonate real users, so RLS and RPC authorization are exercised, not mocked. CI runs the same job against a `postgres:16` service. Never point it at a real Supabase project.

## 2. Supabase project

Create one Supabase project for the pilot.

Required public values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Required server-only value (preferred):

```env
SUPABASE_SECRET_KEY=
```

Legacy fallback:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Optional public origin for SIGNAL tracking links (falls back to the request host):

```env
NEXT_PUBLIC_SITE_URL=https://<production-domain>
```

Use the modern Supabase secret key for new deployments when available.
Never expose either server secret to the browser or commit it to Git.

Apply migrations in timestamp order from `supabase/migrations/`.

With Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

Development seed:

```bash
npx supabase db reset
```

Migration `202610030001_ugc_studio.sql` creates the private Storage bucket `ugc-assets` (50MB per file, image/video MIME allow-list) and its RLS policies. Do not make the bucket public: Restaurant access to UGC files ends when the usage license expires.

The seed contains demonstration restaurant/campaign data only. Do not put real Creator or restaurant personal information in `seed.sql`.

## 3. Supabase Auth

For the pilot:
- Enable email/password auth.
- Configure the deployed Site URL.
- Add local redirect URL when developing locally.
- Keep email confirmation enabled for external pilot users.
- Use the SSR confirmation endpoint already implemented at `/auth/confirm`.

For the **Confirm signup** email template, use a token-hash URL:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

This allows the server route to verify the OTP, set the auth cookie, and continue to onboarding.

After the first operator account signs up, promote only that account to admin from a trusted SQL session:

```sql
update public.users
set
  role = 'admin',
  onboarding_completed_at = now()
where email = '<OPERATOR_EMAIL>';
```

Do not expose an in-app "make me admin" endpoint.

## 4. Cron reminders

Set a long random value:

```env
CRON_SECRET=
```

`vercel.json` invokes:

```
GET /api/cron/reminders
```

The route requires:

```
Authorization: Bearer <CRON_SECRET>
```

It currently:
- creates in-app reminders for a PR visit roughly 24 hours before
- creates in-app reminders for a required post deadline within 24 hours
- notifies the Restaurant 7 days before a content usage license expires
- deletes SIGNAL events older than 13 months (retention)

Notifications use a dedupe key so an hourly cron does not create repeated copies of the same reminder.

## 5. Vercel

Import the GitHub repository and configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback)
- `CRON_SECRET`

Never configure a Supabase server secret with a `NEXT_PUBLIC_` prefix.

Before enabling real restaurant onboarding, verify:
- production Supabase URL
- Auth Site URL / redirect URLs
- RLS migrations
- admin account
- cron authorization
- HTTPS production domain

## 6. Current routes

Creator:
- `/creator/campaigns`
- `/creator/flash`
- `/creator/applications`
- `/creator/bookings`
- `/creator/wallet`
- `/creator/profile`

Restaurant:
- `/restaurant`
- `/restaurant/campaigns/new`
- `/restaurant/flash/new`
- `/restaurant/reschedules`
- `/restaurant/studio` — UGC library and usage-license expiry
- `/restaurant/signal` — PR code entry and ROI by Creator

Public:
- `/r/<code>` — Creator tracking link landing page (no login)

Operator:
- `/admin`
- `/admin/payments`

Shared:
- `/login`
- `/signup`
- `/onboarding`
- `/notifications`

## 7. Money handling in SOLO MVP

The app does **not** move money automatically.

Current flow:

```
Creator submit
→ Restaurant approve
→ Payment approved
→ Operator transfers money outside the app
→ Admin marks scheduled / paid
→ Creator Wallet updates
```

Do not represent `approved` as already paid.

Stripe Connect belongs to a later phase after business/legal/tax handling is confirmed.

## 8. Content policy boundary for the product

The standard paid deliverables are:
- Instagram
- TikTok
- YouTube Shorts
- UGC

Do not make incentivized Google/Tabelog reviews a required paid deliverable.

## 9. Pilot scope

Start in Osaka.

Recommended first controlled pilot:
- 1 operator account
- 1 Creator account (グルメ日誌)
- 1 test restaurant account
- 1 paid campaign
- 1 booking
- 1 deliverable
- 1 manual payout

Only after the full transaction succeeds should external Creators/restaurants be invited.
