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

Inquiry (new) → human compliance review (approved/rejected) → Contacted → Proposed → Booked or Closed.\nThe DB CHECK prohibits proposed/booked unless compliance_status=approved. Rejection closes the inquiry. Operator review is required even when text pre-screen passes.
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

## Zero tolerance: no incentivized review-site deliverables

Business rule: **グルメ日誌 never accepts requests to post Tabelog/Google Maps or other review-site reviews as a condition of payment, free meals, or other consideration.** Never bundle review posts with Instagram PR services, regardless of amount or advertising label. Never accept specified star ratings, concealed ads, fabricated testimonials or non-visited claims.

Official references:
- Tabelog review guideline 12 (no paid, free-invitation or PR review; even reviewing after personally paying at an already-promoted shop is discouraged): https://tabelog.com/help/review_guide/
- Google Maps fake engagement and rating manipulation policy (no directly or in-kind paid/incentivized reviews): https://support.google.com/contributionpolicy/answer/7400114
- Japan Consumer Affairs Agency Stealth Marketing Q&A (paid PR must be clearly recognized as ad when business-directed): https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing

1. The public intake page discloses forbidden work before submission. Policy confirmation is mandatory and timestamped.
2. Server rejects review/rating/undisclosed-ad wording even if an API client bypasses the checkbox UI; tests cover the explicit cases. Heuristic detection is **not exhaustive** and may conservatively flag legitimate wording.
3. Every submitted inquiry starts with compliance_status=pending. A human reads full terms and approves/rejects; do not auto-approve.
4. Supabase enforces that no inquiry can become proposed/booked without compliance_status=approved and reviewed_at.
5. Any prohibited requirements found during negotiation are refused or the deal is stopped, never shifted to marketplace automatically.
6. Mark permitted sponsored Instagram posts clearly with PR/タイアップ disclosures. Preserve editorial integrity; the operator may write truthful first-hand opinions.
