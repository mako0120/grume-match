# Operator Runbook — Private Alpha

This runbook is for the solo Operator of GOURMET DIARY PR OS.
Normal transactions should complete without manual intervention. The Operator handles only verification, exceptions, payout execution, and support.

## 1. Daily operating order

Open /admin and work from top to bottom.

1. Participant verification.
2. Open disputes.
3. No-show exceptions.
4. Overdue deliverables.
5. Approved / scheduled / failed payouts.
6. Account closure requests.

Do not manually intervene in healthy campaigns, applications, bookings, or approved transactions.

## 2. Support target

Private Alpha target, not a public SLA:

- Payment, account access, suspected unauthorized access: respond the same business day.
- Visit within 24 hours: respond the same business day when practical.
- Other product questions: respond within 1 business day.
- Product ideas and non-blocking feedback: batch for product review.

If the Operator cannot resolve a money or access issue confidently, freeze the affected transaction and do not improvise a payout state.

## 3. Participant verification

Before a participant can transact:

Creator:
- Confirm the submitted public social profile belongs to the applicant.
- Check that the handle/profile URL is reachable and consistent with the display name.
- Do not infer private identity information from public posts.

Restaurant:
- Confirm that the restaurant exists and that the submitted business/contact information is plausible.
- For the private pilot, confirm the contact through an existing trusted business channel when available.

Use /admin/verification. The verification event is written to the audit log and the participant receives an in-app notification.

## 4. Cancellation and no-show

Future cancellation:
- Creator or Restaurant uses the in-app cancellation action.
- The slot is released through the transaction RPC.
- Unsettled payout becomes non-payable.

After visit start:
- Do not use normal cancellation.
- Restaurant confirms visit or, after the no-show threshold, records no-show.
- No-show appears in /admin/no-shows.
- Operator reviews it once and records a note when useful.

Disagreement:
- Either party opens the in-app operator review action.
- Open dispute freezes mutable transaction state and unsettled payout.
- Operator resolves from /admin/disputes.
- Resume returns the transaction to its recorded pre-dispute state.
- Stop unpaid compensation only when the payment has not been made.
- Never attempt to reverse a payment already recorded as paid from this workflow.

## 5. Deliverable review

Restaurant may:
- Approve the submitted URL.
- Request a correction with a concrete note.

Restaurant should not:
- Require a positive opinion.
- Rewrite the Creator's genuine opinion.
- Require incentivized Google Maps reviews.

Once payout approval locks the deliverable, do not modify it outside the audited flow.

## 6. Manual payout reconciliation

Private Alpha payout flow:

1. Creator registers payout destination.
2. Restaurant approves required deliverables.
3. Payment becomes approved.
4. Operator verifies there is no open dispute.
5. Operator may mark scheduled.
6. Operator performs the actual bank transfer outside the app.
7. Only after transfer succeeds, enter a bank transfer reference / receipt identifier and mark paid.
8. Paid transfer evidence is immutable in the normal workflow.

Never mark paid before money has actually been sent.

For failed transfers:
- Mark failed.
- Confirm payout destination with the Creator.
- Return to scheduled only after the cause is resolved.

Keep transfer evidence minimal. Do not paste unnecessary account-holder personal information into free-text notes.

## 7. Account closure

A user may request account suspension/removal review from Account settings.

- Do not delete transactional records inline.
- The system blocks suspension while unresolved applications, bookings, disputes, or payouts remain.
- Resolve commercial obligations first.
- After obligations are complete, suspend the application account.
- Data deletion/anonymization beyond suspension requires the retention/legal policy to be finalized before general launch.

## 8. Security incident

If unauthorized access, secret exposure, or cross-tenant data access is suspected:

1. Stop public rollout.
2. Set PUBLIC_LAUNCH_ENABLED=false.
3. Rotate affected secrets.
4. Suspend affected accounts if needed.
5. Preserve audit evidence.
6. Identify affected records/users.
7. Fix and verify the root cause before reopening.

Never paste Supabase server secrets, bank account data, or authentication tokens into GitHub issues.

## 9. Backup and recovery

Before general launch:
- Confirm the actual Supabase plan's backup/restore capability.
- Run one restore drill to a non-production environment.
- Verify core tables, RLS policies, migrations, and at least one representative transaction after restore.
- Record the drill date and result.

Do not mark backup/recovery complete based only on documentation; it must be tested against the deployed project.

## 10. Launch rule

Keep PUBLIC_LAUNCH_ENABLED=false until:
- production infrastructure is dedicated and healthy,
- legal/accounting/security approval gates are complete,
- cross-tenant negative tests pass against the real database,
- one real paid PR completes end-to-end,
- payout state matches actual money movement.
