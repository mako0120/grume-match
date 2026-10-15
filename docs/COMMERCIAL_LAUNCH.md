# Commercial Launch Gate

This file defines the minimum bar for moving GOURMET DIARY PR OS from private alpha to a paid external launch.

## 1. Transaction integrity

- [x] Cash reward is required for live PR campaigns.
- [x] Food provision is stored separately from cash reward.
- [x] Campaign terms are locked after the first application.
- [x] Booking concurrency and Creator schedule conflicts are guarded in DB RPCs.
- [x] Future booking cancellation releases slot capacity.
- [x] No-show is recorded separately from cancellation.
- [x] Deliverables cannot be submitted before the scheduled visit starts.
- [x] Approved deliverables cannot be silently rewritten.
- [x] Payout state distinguishes approved / on-hold / scheduled / paid / failed / cancelled.
- [x] Manual payout requires a private Creator payout destination before scheduling or marking paid.
- [x] Open disputes hold unsettled payouts until Admin resolution.
- [x] No-show exceptions leave the Inbox after explicit Admin review.
- [x] Cancelled payouts are excluded from Creator earned totals.
- [x] Audit logs cover key transaction changes.
- [ ] One real paid PR transaction passes docs/PILOT_CHECKLIST.md.

## 2. Compliance

- [x] Paid/comped social posts show a PR disclosure reminder.
- [x] PR Guidelines require advertising disclosure.
- [x] Paid/incentivized Google Maps reviews are not a supported deliverable.
- [x] Versioned Terms / Privacy / PR Guidelines acceptance is stored.
- [ ] Operator legal name, address, contact method, and billing entity are finalized.
- [ ] Japanese commercial-law disclosures are reviewed for the actual charging model.
- [ ] Tax/accounting treatment for Creator payouts and platform revenue is reviewed.
- [ ] Final Terms / Privacy text is reviewed before general public launch.

Official references:
- Consumer Affairs Agency stealth marketing Q&A:
  https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing
- Google Maps prohibited/restricted content:
  https://support.google.com/contributionpolicy/answer/7400114

## 3. Security and tenancy

- [x] Private alpha blocks anonymous marketplace reads.
- [x] RLS scopes Creator / Restaurant transaction data.
- [x] Suspended participants are hidden from counterparties.
- [x] Server-only Supabase secret is separated from browser keys.
- [x] Baseline security response headers are enabled.
- [x] Auth session is refreshed at the request boundary.
- [x] Health endpoint checks the PR OS schema, not only environment variables.
- [ ] Apply every migration to the dedicated PR OS Supabase project.
- [ ] Run cross-tenant negative tests against the deployed database.
- [ ] Rotate secrets before public launch if any were used during development.

## 4. Operations

- [x] Restaurant Action Queue focuses on work that needs attention.
- [x] Admin Inbox Zero surfaces payout and delivery exceptions.
- [x] Creator Wallet separates approved, scheduled and paid states.
- [x] Reminders are deduplicated.
- [x] Superseded PR CI runs are cancelled to reduce GitHub Actions usage.
- [ ] Define support response target and escalation path.
- [ ] Define cancellation/no-show exception process for disputed cases.
- [ ] Define payout reconciliation procedure and evidence retained for each transfer.
- [ ] Test backup/recovery procedure.

## 5. Deployment

- [ ] Dedicated Supabase project confirmed for GOURMET DIARY PR OS.
- [ ] Migrations applied in order.
- [ ] Auth Site URL and redirect URLs configured.
- [ ] Dedicated Vercel project connected to mako0120/grume-match.
- [ ] Production environment variables configured.
- [ ] /api/health returns HTTP 200 and database=ok.
- [ ] Email confirmation flow tested on production URL.
- [ ] Cron secret and hourly maintenance job verified.
- [ ] Mobile Creator and Restaurant flows tested on production.

## 6. Payments

Private alpha may use manual bank transfer after Admin approval.

Before automated marketplace payouts:
- [ ] Confirm merchant-of-record / platform role with legal/accounting review.
- [ ] Decide who charges the Restaurant and when funds become payable.
- [ ] Complete Stripe Connect design and account onboarding flow.
- [ ] Handle refunds, disputes, payout failures, and reconciliation.
- [ ] Never show a payment as paid until the external transfer is confirmed.

## Launch decision

Do not describe the product as generally available until:
1. Production infrastructure is dedicated and healthy.
2. One real paid PR completes end-to-end without Instagram DM.
3. Cross-tenant isolation is verified.
4. Payment state matches actual money movement.
5. Required operator/legal information is published.
