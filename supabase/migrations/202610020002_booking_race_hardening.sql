-- Booking concurrency hardening.
-- Serializes schedule mutations per Creator and prevents campaign-level overbooking.

create or replace function public.confirm_booking(
  p_application_id uuid,
  p_campaign_slot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_campaign public.campaigns%rowtype;
  v_slot public.campaign_slots%rowtype;
  v_booking_id uuid;
  v_matching_availability boolean;
  v_creator_conflict boolean;
  v_booking_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if v_application.status not in ('applied', 'shortlisted', 'accepted') then
    raise exception 'application_not_schedulable' using errcode = 'P0001';
  end if;

  select *
    into v_campaign
  from public.campaigns
  where id = v_application.campaign_id
  for update;

  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_campaign.status not in ('published', 'recruiting') then
    raise exception 'campaign_capacity_reached' using errcode = 'P0001';
  end if;

  select count(*)
    into v_booking_count
  from public.bookings b
  where b.campaign_id = v_campaign.id
    and b.status in ('held', 'confirmed', 'visited', 'reschedule_requested');

  if v_booking_count >= v_campaign.creator_slots then
    update public.campaigns
    set status = 'filled'
    where id = v_campaign.id
      and status in ('published', 'recruiting');

    raise exception 'campaign_capacity_reached' using errcode = 'P0001';
  end if;

  -- Prevent two concurrent transactions from confirming overlapping bookings
  -- for the same Creator across different campaigns.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_application.creator_id::text, 0)
  );

  select *
    into v_slot
  from public.campaign_slots
  where id = p_campaign_slot_id
  for update;

  if not found or v_slot.campaign_id <> v_campaign.id then
    raise exception 'slot_not_found_for_campaign' using errcode = 'P0002';
  end if;

  if v_slot.status <> 'open'
     or v_slot.reserved_count >= v_slot.capacity
     or v_slot.starts_at <= now() then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.application_availabilities aa
    where aa.application_id = v_application.id
      and (
        (aa.kind = 'exact_slot' and aa.campaign_slot_id = v_slot.id)
        or
        (
          aa.kind = 'flexible_after'
          and aa.date_local = (v_slot.starts_at at time zone 'Asia/Tokyo')::date
          and aa.flexible_after_local <= (v_slot.starts_at at time zone 'Asia/Tokyo')::time
        )
      )
  )
  into v_matching_availability;

  if not v_matching_availability then
    raise exception 'slot_not_selected_by_creator' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.bookings b
    join public.campaign_slots existing_slot
      on existing_slot.id = b.campaign_slot_id
    where b.creator_id = v_application.creator_id
      and b.status in ('held', 'confirmed', 'reschedule_requested')
      and tstzrange(existing_slot.starts_at, existing_slot.ends_at, '[)')
          && tstzrange(v_slot.starts_at, v_slot.ends_at, '[)')
  )
  into v_creator_conflict;

  if v_creator_conflict then
    raise exception 'creator_schedule_conflict' using errcode = 'P0001';
  end if;

  update public.campaign_slots
  set
    reserved_count = reserved_count + 1,
    status = case
      when reserved_count + 1 >= capacity then 'full'::public.slot_status
      else status
    end
  where id = v_slot.id;

  insert into public.bookings (
    application_id,
    campaign_id,
    creator_id,
    campaign_slot_id,
    party_size,
    status
  )
  values (
    v_application.id,
    v_campaign.id,
    v_application.creator_id,
    v_slot.id,
    v_application.party_size,
    'confirmed'
  )
  returning id into v_booking_id;

  update public.applications
  set status = 'scheduled'
  where id = v_application.id;

  insert into public.deliverables (
    booking_id,
    platform,
    due_at,
    verification_status
  )
  select
    v_booking_id,
    cp.platform,
    v_slot.ends_at + interval '7 days',
    'pending'
  from public.campaign_platforms cp
  cross join lateral generate_series(1, cp.quantity)
  where cp.campaign_id = v_campaign.id
    and cp.required = true;

  insert into public.payments (
    booking_id,
    creator_id,
    amount,
    currency,
    status
  )
  values (
    v_booking_id,
    v_application.creator_id,
    v_campaign.cash_reward,
    'JPY',
    'pending'
  );

  v_booking_count := v_booking_count + 1;

  if v_booking_count >= v_campaign.creator_slots then
    update public.campaigns
    set status = 'filled'
    where id = v_campaign.id
      and status in ('published', 'recruiting');
  elsif v_campaign.status = 'published' then
    update public.campaigns
    set status = 'recruiting'
    where id = v_campaign.id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_json
  )
  values (
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'booking.confirmed',
    'booking',
    v_booking_id,
    jsonb_build_object(
      'application_id', v_application.id,
      'campaign_id', v_campaign.id,
      'slot_id', v_slot.id,
      'starts_at', v_slot.starts_at
    )
  );

  return v_booking_id;
end;
$$;

revoke all on function public.confirm_booking(uuid, uuid) from public;
grant execute on function public.confirm_booking(uuid, uuid) to authenticated;

create or replace function public.review_booking_reschedule(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.booking_reschedule_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_old_slot public.campaign_slots%rowtype;
  v_new_slot public.campaign_slots%rowtype;
  v_creator_user_id uuid;
  v_actor_role public.user_role;
  v_creator_conflict boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_request
  from public.booking_reschedule_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'reschedule_request_not_pending' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_request.booking_id
  for update;

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if public.is_restaurant_member(v_campaign.restaurant_id) then
    v_actor_role := 'restaurant';
  elsif v_creator_user_id = auth.uid() then
    v_actor_role := 'creator';
  elsif public.is_admin() then
    v_actor_role := 'admin';
  else
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_request.requested_by = auth.uid() and not public.is_admin() then
    raise exception 'requester_cannot_self_approve' using errcode = '42501';
  end if;

  -- Serialize all schedule mutations for this Creator.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.creator_id::text, 0)
  );

  select * into v_old_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id
  for update;

  select * into v_new_slot
  from public.campaign_slots
  where id = v_request.requested_slot_id
  for update;

  if p_approve then
    if v_new_slot.status <> 'open'
       or v_new_slot.reserved_count >= v_new_slot.capacity
       or v_new_slot.starts_at <= now() then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;

    select exists (
      select 1
      from public.bookings b
      join public.campaign_slots existing_slot
        on existing_slot.id = b.campaign_slot_id
      where b.creator_id = v_booking.creator_id
        and b.id <> v_booking.id
        and b.status in ('held', 'confirmed', 'reschedule_requested')
        and tstzrange(existing_slot.starts_at, existing_slot.ends_at, '[)')
          && tstzrange(v_new_slot.starts_at, v_new_slot.ends_at, '[)')
    )
    into v_creator_conflict;

    if v_creator_conflict then
      raise exception 'creator_schedule_conflict' using errcode = 'P0001';
    end if;

    update public.campaign_slots
    set
      reserved_count = greatest(0, reserved_count - 1),
      status = case
        when reserved_count - 1 < capacity then 'open'::public.slot_status
        else status
      end
    where id = v_old_slot.id;

    update public.campaign_slots
    set
      reserved_count = reserved_count + 1,
      status = case
        when reserved_count + 1 >= capacity then 'full'::public.slot_status
        else status
      end
    where id = v_new_slot.id;

    update public.bookings
    set
      campaign_slot_id = v_new_slot.id,
      status = 'confirmed'
    where id = v_booking.id;

    update public.booking_reschedule_requests
    set
      status = 'approved',
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note, '')), '')
    where id = v_request.id;

    perform public.create_notification(
      v_request.requested_by,
      'reschedule_approved',
      '日時変更が承認されました',
      '新しい来店日時が確定しました。'
    );
  else
    update public.bookings
    set status = 'confirmed'
    where id = v_booking.id;

    update public.booking_reschedule_requests
    set
      status = 'rejected',
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note, '')), '')
    where id = v_request.id;

    perform public.create_notification(
      v_request.requested_by,
      'reschedule_rejected',
      '日時変更が承認されませんでした',
      '現在の来店日時のままです。'
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id, after_json
  )
  values(
    auth.uid(),
    v_actor_role,
    case when p_approve then 'booking.reschedule_approved' else 'booking.reschedule_rejected' end,
    'booking_reschedule_request',
    v_request.id,
    jsonb_build_object(
      'booking_id', v_booking.id,
      'approved', p_approve,
      'new_slot_id', case when p_approve then v_new_slot.id else null end
    )
  );

  return v_booking.id;
end;
$$;

revoke all on function public.review_booking_reschedule(uuid, boolean, text) from public;
grant execute on function public.review_booking_reschedule(uuid, boolean, text) to authenticated;
