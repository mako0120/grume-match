-- Prevent Admin payout progression while a booking dispute is open.

create or replace function public.admin_update_payment_status(
  p_payment_id uuid,
  p_status public.payment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_active_booking_count integer;
  v_unpaid_booking_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status not in ('scheduled', 'paid', 'failed') then
    raise exception 'invalid_payment_target_status' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.booking_disputes bd
    where bd.booking_id = v_payment.booking_id
      and bd.status = 'open'
  ) then
    raise exception 'payment_blocked_by_open_dispute' using errcode = 'P0001';
  end if;

  if v_payment.status = p_status then
    return;
  end if;

  if not (
    (v_payment.status = 'approved' and p_status in ('scheduled', 'paid', 'failed'))
    or
    (v_payment.status = 'scheduled' and p_status in ('paid', 'failed'))
    or
    (v_payment.status = 'failed' and p_status = 'scheduled')
  ) then
    raise exception 'invalid_payment_transition' using errcode = 'P0001';
  end if;

  update public.payments
  set
    status = p_status,
    paid_at = case when p_status = 'paid' then now() else null end
  where id = p_payment_id;

  select * into v_booking
  from public.bookings
  where id = v_payment.booking_id;

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id
  for update;

  if p_status = 'paid' then
    update public.applications
    set status = 'paid'
    where id = v_booking.application_id
      and status = 'approved';

    select count(*) into v_active_booking_count
    from public.bookings b
    where b.campaign_id = v_campaign.id
      and b.status not in ('cancelled', 'no_show');

    select count(*) into v_unpaid_booking_count
    from public.bookings b
    left join public.payments p on p.booking_id = b.id
    where b.campaign_id = v_campaign.id
      and b.status not in ('cancelled', 'no_show')
      and (p.id is null or p.status <> 'paid');

    if v_active_booking_count >= v_campaign.creator_slots
       and v_unpaid_booking_count = 0 then
      update public.campaigns
      set status = 'completed'
      where id = v_campaign.id
        and status in ('filled', 'in_progress');
    end if;
  end if;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  )
  values(
    auth.uid(),
    'admin',
    'payment.status_changed',
    'payment',
    p_payment_id,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.admin_update_payment_status(uuid, public.payment_status)
from public;

grant execute on function public.admin_update_payment_status(uuid, public.payment_status)
to authenticated;
