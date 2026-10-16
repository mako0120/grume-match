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

Price tier proposal, *not an agreed contract or market guarantee*:
- Up to 10-page Instagram carousel: ¥18,000 incl. tax reference.
- 11–16 pages: ¥22,000–25,000 incl. tax.
- 17–20 pages: ¥25,000–30,000 incl. tax.

Creative shoot, editing, copy and publication are assumed. Food provision, travel, extra footage, secondary use rights and revision cycles negotiated separately. This is a differentiated price proposal based on work volume, not metrics per post (only rolling-30-day audience data currently available).

Production rollout remains gated on dedicated DB, verified payment/legal disclosures, real test submission and viewer URL accessibility.
