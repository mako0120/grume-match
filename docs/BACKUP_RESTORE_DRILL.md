# Backup / Restore Drill

This runbook is required before general public launch. It is intentionally separate from routine backups: a backup is not considered usable until one restore drill has succeeded.

## Scope

The drill must cover:
- database schema and migration history,
- RLS policies and security-definer RPCs,
- Auth configuration notes,
- representative Creator / Restaurant / Admin transaction data,
- payment reconciliation metadata,
- dispute and audit records.

Do not copy real bank account numbers or unnecessary personal data into a shared test environment.

## Before the drill

1. Confirm the dedicated production Supabase project and its current backup/restore capability.
2. Record the production project ref, latest applied migration, drill date, and person running the drill.
3. Use a non-production target for the restore.
4. Keep PUBLIC_LAUNCH_ENABLED=false during the exercise.

## Restore procedure

1. Create or select an isolated non-production Supabase target.
2. Restore from the selected production backup using the Supabase-supported restore path for the active plan.
3. Verify that all repository migrations are represented in the restored schema.
4. Run the checks in `supabase/diagnostics/post_restore_checks.sql`.
5. Sign in with dedicated test accounts for Creator, Restaurant and Admin.
6. Verify cross-tenant isolation:
   - Creator A cannot read Creator B private transaction data.
   - Restaurant A cannot read Restaurant B applications, bookings or payments.
   - Restaurant cannot read Creator payout destination data.
   - Creator cannot mutate Restaurant-only states.
   - non-Admin cannot execute Admin payout/dispute functions.
7. Run one representative restored transaction: campaign, application, booking, deliverable, payment.
8. Confirm `/api/health` reports `database=ok` when the app is pointed at the restored environment.
9. Destroy or lock the restore target after evidence is captured.

## Pass criteria

The drill passes only when:
- every diagnostic violation count is zero unless explicitly explained,
- all required tables/RPCs/policies exist,
- cross-tenant negative tests pass,
- representative transaction relationships are intact,
- no production secrets were copied into documentation or GitHub.

## Evidence to record

| Date | Source backup | Restore target | Result | Notes |
| --- | --- | --- | --- | --- |
| Not run | — | — | PENDING | Dedicated production project not created yet |

## Failure handling

If restore or isolation checks fail:
1. keep general launch disabled,
2. preserve the failing environment for diagnosis,
3. fix migrations or restore procedure,
4. repeat the drill from a fresh restore,
5. do not mark the backup/recovery gate complete until the rerun passes.