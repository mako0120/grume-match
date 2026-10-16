# グルメ日誌｜大阪 — first-party PR site

## Purpose

- Canonical first-party entry point: /diary
- Direct inquiry: /diary/request
- After submission: /diary/thanks
- Operator inbox: /admin/diary-inquiries
- API: POST /api/diary/inquiries
- Separate from the MARKET/OFFER multi-creator marketplace and its billing state. Do not copy leads into campaigns automatically.

## Source of truth for metrics

Screenshot supplied by operator on October 16, 2026: preceding 30 days
- Content views: 176,473 (display: 17.6万回)
- Content viewers: 76,876
- Net follower increase: +1,335
- Followers: approximately 5,000, operator supplied.
These are **dated historical results**, not live metrics, attributed conversions, or guaranteed reach.
Never automatically refresh them without verified first-party Insights data.

## Required rollout

1. Keep all code on the feature branch until PR checks, accessibility review and manual approval.
2. Apply migration 202610160002 after all prior migrations to the **dedicated** production Supabase, not the existing unrelated project.
3. Set **private server variables** DIARY_INQUIRIES_ENABLED=true and DIARY_TURNSTILE_SECRET_KEY=<secret>. Set NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY=<public site key>. Use production domain(s) allowed in Cloudflare Turnstile settings.
4. Keep DIARY_INQUIRIES_ENABLED=false during development. Disabled form displays a link to Instagram DM, while POST returns 503.
5. Configure NEXT_PUBLIC_SITE_URL to the production origin; challenge response hostname is verified against this setting.
6. Login with verified active admin user; test /admin/diary-inquiries (do not bypass /admin layout or server action role check).
7. Test genuine public inquiry (including Turnstile), list visibility for admin only, update status, no leaked contact data via anon/authenticated Supabase clients, reject invalid origin/payload/challenge.
8. Confirm actual inbound mail/response procedure, privacy policy, operator contact, retention and disclosure requirements before driving traffic.
9. Turnstile helps prevent automated spam but does not replace hosting/WAF abuse throttling and operational monitoring.

## Sales workflow

Inquiry (new) → Contacted → Proposed → Booked or Closed.
No contract or payment is created from submitting the inquiry.
Quotes are tailored; do not state guaranteed bookings, engagements or follower reach.
For sponsored content explicitly disclose advertising relationships (PR/タイアップ).

## Security and privacy

- The table holds personally identifiable contact data. No client-side direct DB access.
- RLS enabled, no anon/authenticated policies; service role only in server handlers.
- Server action independently enforces admin role.
- Explicit privacy consent timestamp is stored.
- Never paste production secrets into repository, browser env, PR comments or logs.
- Implement a retention/deletion procedure with actual operator review before full commercial release.
