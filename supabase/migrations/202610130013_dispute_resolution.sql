-- Freeze unsettled payouts during disputes and give Admin an audited resolution path.

alter table public.booking_disputes
  add column if not exists payment_status_before public.payment_status,
  add column if not exists resolution_outcome text;

create or replace function public.open_booking_dispute(
  p_booking_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_application public.applications%rowtype;
  v_payment public.payments%rowtype;
  v_creator_user_id uuid;
  v_restaurant_user_id uuid;
  v_dispute_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'dispute_reason_required' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'booking_not_disputable' using errcode = 'P0001';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if not (
    v_creator_user_id = auth.uid()
    or public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_application
  from public.applications
  where id = v_booking.application_id
  for update;

  if v_application.status = 'dispute' then
    raise exception 'dispute_already_open' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments
  where booking_id = v_booking.id
  for update;

  insert into public.booking_disputes(
    booking_id,
    application_id,
    opened_by,
    reason,
    application_status_before,
    payment_status_before
  )
  values(
    v_booking.id,
    v_application.id,
    auth.uid(),
    trim(p_reason),
    v_application.status,
    case when v_payment.id is null then null else v_payment.status end
  )
  returning id into v_dispute_id;

  update public.applications
  set status = 'dispute'
  where id = v_application.id;

  if v_payment.id is not null
     and v_payment.status not in ('paid', 'cancelled') then
    update public.payments
    set status = 'on_hold'
    where id = v_payment.id;
  end if;

  select rm.user_id into v_restaurant_user_id
  from public.restaurant_memberships rm
  join public.users u on u.id = rm.user_id
  where rm.restaurant_id = v_campaign.restaurant_id
    and u.status = 'active'
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  if v_creator_user_id = auth.uid() then
    if v_restaurant_user_id is not null then
      perform public.create_notification(
        v_restaurant_user_id,
        'booking_dispute_opened',
        '案件の確認依頼が届きました',
        'Creatorから運営確認の依頼が届いています。'
      );
    end if;
  elsif v_creator_user_id is not null then
    perform public.create_notification(
      v_creator_user_id,
      'booking_dispute_opened',
      '案件の確認依頼が届きました',
      '店舗から運営確認の依頼が届いています。'
    );
  end if;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_json
  )
  values(
    auth.uid(),
    case
      when public.is_admin() then 'admin'::public.user_role
      when v_creator_user_id = auth.uid() then 'creator'::public.user_role
      else 'restaurant'::public.user_role
    end,
    'booking.dispute_opened',
    'booking_dispute',
    v_dispute_id,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'reason', trim(p_reason),
      'payment_status_before',
      case when v_payment.id is null then null else v_payment.status::text end
    )
  );

  return v_dispute_id;

exception
  when unique_violation then
    raise exception 'dispute_already_open' using errcode = '23505';
end;
$$;

create or replace function public.resolve_booking_dispute(
  p_dispute_id uuid,
  p_outcome text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispute public.booking_disputes%rowtype;
  v_payment public.payments%rowtype;
  v_restored_payment_status public.payment_status;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_outcome not in ('resume', 'cancel_unpaid') then
    raise exception 'invalid_dispute_outcome' using errcode = 'P0001';
  end if;

  select * into v_dispute
  from public.booking_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'dispute_not_found' using errcode = 'P0002';
  end if;

  if v_dispute.status <> 'open' then
    raise exception 'dispute_already_resolved' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments
  where booking_id = v_dispute.booking_id
  for update;

  if p_outcome = 'cancel_unpaid'
     and v_payment.id is not null
     and v_payment.status = 'paid' then
    raise exception 'paid_payment_cannot_be_cancelled' using errcode = 'P0001';
  end if;

  if p_outcome = 'resume' then
    update public.applications
    set status = v_dispute.application_status_before
    where id = v_dispute.application_id;

    if v_payment.id is not null and v_payment.status = 'on_hold' then
      v_restored_payment_status := coalesce(
        v_dispute.payment_status_before,
        'pending'::public.payment_status
      );

      if v_restored_payment_status = 'on_hold' then
        v_restored_payment_status := 'pending';
      end if;

      update public.payments
      set status = v_restored_payment_status
      where id = v_payment.id;
    end if;
  else
    update public.applications
    set status = 'cancelled'
    where id = v_dispute.application_id;

    if v_payment.id is not null and v_payment.status <> 'paid' then
      update public.payments
      set status = 'cancelled'
      where id = v_payment.id;
    end if;
  end if;

  update public.booking_disputes
  set
    status = 'resolved',
    resolution_outcome = p_outcome,
    resolution_note = nullif(trim(coalesce(p_note, '')), ''),
    resolved_at = now()
  where id = p_dispute_id;

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
    'booking.dispute_resolved',
    'booking_dispute',
    p_dispute_id,
    jsonb_build_object('status', 'open'),
    jsonb_build_object(
      'status', 'resolved',
      'outcome', p_outcome,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );
end;
$$;

revoke all on function public.open_booking_dispute(uuid, text) from public;
grant execute on function public.open_booking_dispute(uuid, text) to authenticated;

revoke all on function public.resolve_booking_dispute(uuid, text, text) from public;
grant execute on function public.resolve_booking_dispute(uuid, text, text) to authenticated;
