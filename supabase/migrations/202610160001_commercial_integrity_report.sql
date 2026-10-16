-- Commercial invariant diagnostics for Admin launch readiness.
-- Read-only: this function never repairs records automatically.

create or replace function public.commercial_integrity_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'paid_without_transfer_reference', (
      select count(*)
      from public.payments p
      where p.status = 'paid'
        and nullif(trim(coalesce(p.transfer_reference, '')), '') is null
    ),
    'scheduled_or_paid_without_payout_profile', (
      select count(*)
      from public.payments p
      where p.status in ('scheduled', 'paid')
        and not exists (
          select 1
          from public.creator_payout_profiles cpp
          where cpp.creator_id = p.creator_id
        )
    ),
    'open_dispute_with_moving_payout', (
      select count(*)
      from public.booking_disputes bd
      join public.payments p on p.booking_id = bd.booking_id
      where bd.status = 'open'
        and p.status not in ('on_hold', 'paid', 'cancelled')
    ),
    'cancelled_booking_with_unsettled_payout', (
      select count(*)
      from public.bookings b
      join public.payments p on p.booking_id = b.id
      where b.status in ('cancelled', 'no_show')
        and p.status not in ('cancelled', 'paid')
    ),
    'overbooked_slots', (
      select count(*)
      from public.campaign_slots cs
      where cs.reserved_count > cs.capacity
    ),
    'live_zero_cash_campaigns', (
      select count(*)
      from public.campaigns c
      where c.status in ('published', 'recruiting', 'closed', 'filled', 'in_progress')
        and c.cash_reward <= 0
    ),
    'direct_campaign_target_mismatch', (
      select count(*)
      from public.campaigns c
      where c.visibility = 'direct'
        and (
          select count(*)
          from public.campaign_target_creators ctc
          where ctc.campaign_id = c.id
        ) <> 1
    ),
    'approved_deliverable_without_url', (
      select count(*)
      from public.deliverables d
      where d.verification_status = 'approved'
        and nullif(trim(coalesce(d.submitted_url, '')), '') is null
    ),
    'payable_booking_with_unapproved_deliverable', (
      select count(distinct p.id)
      from public.payments p
      join public.bookings b on b.id = p.booking_id
      where p.status in ('approved', 'scheduled', 'paid')
        and exists (
          select 1
          from public.deliverables d
          where d.booking_id = b.id
            and d.verification_status <> 'approved'
        )
    ),
    'stale_dispute_application', (
      select count(*)
      from public.applications a
      where a.status = 'dispute'
        and not exists (
          select 1
          from public.bookings b
          join public.booking_disputes bd on bd.booking_id = b.id
          where b.application_id = a.id
            and bd.status = 'open'
        )
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.commercial_integrity_report() from public;
grant execute on function public.commercial_integrity_report() to authenticated;
