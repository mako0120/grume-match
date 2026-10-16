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


## 2026-10-16: Operator's three actual post examples and service explanation

Operator supplied three permalink examples:
- https://www.instagram.com/p/DeBsEOaD1C6/
- https://www.instagram.com/p/Deglh2WD0XG/
- https://www.instagram.com/p/Dd8icENj2aw/

IMPORTANT: The external Instagram page content was **not accessible to the assistant** during development. Never invent the shops, menu names, media type (carousel vs single photo), captions, PR status, reach or impressions for these IDs. The product displays these as "最近の投稿例" (not proven paid-campaign case studies). Use Instagram's embedded public post only after visitors explicitly click to load external content. Always show a direct permalink fallback because embedded Instagram can be unavailable or login-restricted.

Site pages:
- `/diary`: public, branded first-party landing with recent post gallery and service link
- `/diary/services`: four clearly scoped services (feed, reel, stories, photo/video material), outputs, limitations, individual quotations and the same three real example posts
- `/diary/request?service=<supported service>`: pre-select the requested service on the inquiry form and allow users to review examples before sending.
- All PRs are delivered by the operator account itself, not routed to third-party creators or the wider matching network. Do not leak marketplace content, creator comparisons or automatic placement in this flow.

Scope:
- Creative deliverables such as number of photos or clips, video duration, corrections, delivery date, rights to reuse images, caption check, reporting, compensation, travel and transport are decided **by mutual agreement before contract**.
- Avoid promising bookings, guaranteed reach, engagement, public rankings or fake recommendations. Dated insights only.
- Always disclose PR/sponsor/compensation relations per platform rules. No paid review-site deliverables.
- Instagram embed is third-party content: an iframe is created only when explicitly requested (privacy-conscious click-to-load), and may fail because of platform availability. A clickable direct original is always present.


## 2026-10-16: Verified operator Canva work / PR pricing reference

The user provided three Canva shortlinks. Resolved and read using the connected Canva service (not scraped).
- `https://canva.link/npriuj056xwfe89` -> design `DAHX3RmQv9A`: **北浜 焼とりporc｜グルメ日誌 大阪**, 20 pages, 1080x1350. Read-only view URL from Canva API: `https://www.canva.com/d/ZEZQi8CDw9j20b1`.
- `https://canva.link/s64qvg0rdx301z1` -> design `DAHWjXqkIUg`: **銀蔵 小野原本店｜銀蔵特選海鮮定食**, 16 pages, 1080x1350. Read-only view URL: `https://www.canva.com/d/1FAjRigIi5A1R15`.
- `https://canva.link/69kj5suzejtnk50` -> design `DAHVJGkwLVk`: **煮炊き焼き鳥 御尽｜Bコース**, 10 pages, 1080x1350. Read-only view URL: `https://www.canva.com/d/w2WQ2iTGl7CCtqz`.

The content includes cover hooks, restaurant access, dish highlights, first-hand impressions and many original layouts. Do **not** copy the user's original edit-token share URLs into public pages. These are actual designed works, not automatically verified **paid sponsored** work or verified Instagram engagement. The site displays typographic illustration cards (NOT exact thumbnails) plus verified view-only links. Check public viewer access for each link before external publication.

## Current owner-approved fee and forward-looking milestones (2026-10-16)

**Owner decision overrides the earlier proposed 18,000–30,000 yen page-count tiers.** Those tiers were removed from the live PR site.

Current direct **Instagram feed 1 post: ¥8,000 inclusive of tax**, at the owner-reported approximately 5,000 followers. This base scope is an on-site visit, photo capture, editing, written caption and correctly labeled Instagram feed post. Exact number of slides, shooting time, travel expenses, meals, revision cycles and secondary material rights must be agreed BEFORE contracts; 10/16/20-page Canva works are examples, not unlimited deliverables promised at ¥8,000.

A **proposed** automatic price mapping when the operator confirms the actual number of followers is now implemented in `lib/diary/pricing.ts`:
- 0–7,499: ¥8,000
- 7,500–9,999: ¥10,000
- 10,000–14,999: ¥12,000
- 15,000–19,999: ¥16,000
- 20,000 and above: ¥20,000 (then manual revision)

Operator action: check Instagram follower count in first-party Insights and update `DIARY_VERIFIED_FOLLOWERS` plus `DIARY_FOLLOWERS_VERIFIED_AT` in deployment environment; redeploy to refresh the public price. There is **no automatic Instagram follower API integration** and no continuous background monitoring. Do not advertise an unverified live follower value or an exact future price-increase date. Current fallback 5,000 / 2026-10-16 is the dated user-supplied approximate figure; replace with verified numbers before public launch.

**Pricing mechanics:** future prices change only for newly submitted inquiries after verified count changes. The server computes and stores the published reference fee, follower count, snapshot date, and pricing-policy version in `public.diary_pr_inquiries`. The client cannot override the reference price. A customer inquiry does NOT constitute a contract or lock a binding quote; the operator must agree the final deliverables and fee in writing. Already agreed contracts MUST NOT be repriced unilaterally.

**Marketing compliance:** avoid unverifiable `業界最安値`, `日本一安い`, made-up deadlines, invented discount comparisons and guaranteed price rises by calendar date. Use first-party claims such as `グルメ日誌本人に直接依頼できる、現在1投稿8,000円`. Pricing must be transparent, covering whether meal/transport/material reusage are additional. Consumer Affairs Agency official comparison / price display guidance: https://www.caa.go.jp/policies/policy/representation/fair_labeling/representation_regulation/comparative_advertising


Production rollout remains gated on dedicated DB, verified payment/legal disclosures, real test submission and viewer URL accessibility.


## 2026-10-16: Consultation, application, enterprise visit confirmation, and payment due

Owner requested two separately labeled entry points:
1. `/diary/request?intent=consultation`: free, no obligation. Company selects interest and may share expected dishes, purpose and available dates.
2. `/diary/request?service=instagram_feed&intent=application` or `instagram_feed_video`: company selects plan and must describe desired coverage; submits brand, menus, goals, visit preferences, contact, compliance consent. **This does not itself create an agreement or payment**.

Workflow:
- Private operator reads the request in `/admin/diary-inquiries`, rejects forbidden paid/review-site PR, and approves compliant application.
- Operator chooses their proposed visit time in Asia/Tokyo, duration, itemized deliverables, and final VAT-inclusive fee. This must not fall below the current recorded price floor (¥8,000 for photo, ¥15,000+ for photo/video).
- Verified Resend server email sends a 7-day expiry **single-use 256-bit confirmation token** to the restaurant email. Only its SHA-256 hash is stored in the DB.
- Company reviews exact quote, terms, visit date and expected deliverables, affirmatively agrees and submits the confirmation. A conditional atomic DB update confirms exactly one booking, and a PostgreSQL exclusion constraint stops overlapping active bookings.
- After confirmed status, notification to **DIARY_OPERATOR_NOTIFY_EMAIL** is sent via Resend; on failure the status remains failed and the existing mail cron retries up to 5 times, with a 10-minute stale-processing recovery window and idempotency key. Do not claim notifications are operational before real delivery test.
- Operator records the actual published Instagram URL. The server records publication timestamp and due date 7 * 24 hours later. Operator marks the invoice paid ONLY after confirming funds.
- There is NO automatic card collection, bank transfer reconciliation or contractual cancellation automation. Business-to-creator billing remains manual and must comply with consumer/commercial disclosure laws.

**Payment decision:** The owner explicitly described payment within one week after completion. The current application implements **100% post-publication within 7 days** rather than the separately recommended 50% deposit / 50% post-publication. If the owner later explicitly elects a deposit requirement, both party-facing terms and the workflow need to change together. Dates/price changes must be agreed by both parties; do not falsely claim an initial inquiry itself locks a commercial contract.

**Security:** no tenant clients access the private inquiry database. Admin actions independently enforce role. One-time public token endpoints do not disclose contact emails, use HTTPS only, and should have no analytics or third-party embeds. Ensure production site adds Referrer-Policy no-referrer for `/diary/confirm/*`, does not cache tokens, and removes them from logs. Operators should manually review cancellation terms, payment instructions, invoice/tax compliance before public launch.

**Production configuration**: dedicated Supabase migrations `202610160002` then `202610160003`, Vercel deployment, valid `NEXT_PUBLIC_SITE_URL`, `DIARY_INQUIRIES_ENABLED=true` after E2E, `RESEND_API_KEY`, `EMAIL_FROM`, `DIARY_OPERATOR_NOTIFY_EMAIL`, `CRON_SECRET`. SMTP/domain and provider deliverability are not verified yet. The previous unrelated Supabase/Vercel projects MUST NOT be modified.
