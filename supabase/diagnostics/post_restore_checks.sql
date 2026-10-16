-- Post-restore diagnostics for GOURMET DIARY PR OS.
-- Run against an isolated restored environment.

select 'core_tables' as check_name,
       count(*) as found,
       8 as expected
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'campaigns',
    'applications',
    'bookings',
    'deliverables',
    'payments',
    'booking_disputes',
    'creator_payout_profiles',
    'user_policy_acceptances'
  );

select 'rls_enabled' as check_name,
       count(*) as protected_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'campaigns',
    'applications',
    'bookings',
    'deliverables',
    'payments',
    'booking_disputes',
    'creator_payout_profiles',
    'user_policy_acceptances'
  )
  and c.relrowsecurity = true;

select 'overbooked_slots' as check_name, count(*) as violations
from public.campaign_slots
where reserved_count > capacity;

select 'paid_without_transfer_reference' as check_name, count(*) as violations
from public.payments
where status = 'paid'
  and nullif(trim(coalesce(transfer_reference, '')), '') is null;

select 'scheduled_or_paid_without_payout_profile' as check_name, count(*) as violations
from public.payments p
where p.status in ('scheduled', 'paid')
  and not exists (
    select 1
    from public.creator_payout_profiles cpp
    where cpp.creator_id = p.creator_id
  );

select 'open_dispute_with_moving_payout' as check_name, count(*) as violations
from public.booking_disputes bd
join public.payments p on p.booking_id = bd.booking_id
where bd.status = 'open'
  and p.status not in ('on_hold', 'paid', 'cancelled');

select 'approved_deliverable_without_url' as check_name, count(*) as violations
from public.deliverables
where verification_status = 'approved'
  and nullif(trim(coalesce(submitted_url, '')), '') is null;