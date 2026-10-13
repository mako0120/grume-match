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
  v_creator_user_id uuid;
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
  where id = p_booking_id;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
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

  insert into public.booking_disputes(
    booking_id,
    application_id,
    opened_by,
    reason,
    application_status_before
  )
  values(
    v_booking.id,
    v_application.id,
    auth.uid(),
    trim(p_reason),
    v_application.status
  )
  returning id into v_dispute_id;

  update public.applications
  set status = 'dispute'
  where id = v_application.id;

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
      'reason', trim(p_reason)
    )
  );

  return v_dispute_id;

exception
  when unique_violation then
    raise exception 'dispute_already_open' using errcode = '23505';
end;
$$;

revoke all on function public.open_booking_dispute(uuid, text) from public;
grant execute on function public.open_booking_dispute(uuid, text) to authenticated;
