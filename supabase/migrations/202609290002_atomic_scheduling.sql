-- Atomic application + booking workflows for Tap Schedule.

create unique index if not exists application_exact_slot_unique
  on public.application_availabilities(application_id, campaign_slot_id)
  where kind = 'exact_slot';

create unique index if not exists application_flexible_unique
  on public.application_availabilities(application_id, date_local, flexible_after_local)
  where kind = 'flexible_after';

create or replace function public.apply_to_campaign(
  p_campaign_id uuid,
  p_party_size integer,
  p_exact_slot_ids uuid[] default '{}'::uuid[],
  p_flexible_choices jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_application_id uuid;
  v_campaign public.campaigns%rowtype;
  v_invalid_exact_count integer;
  v_choice record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select cp.id
    into v_creator_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.user_id = auth.uid()
    and u.status = 'active';

  if v_creator_id is null then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  select *
    into v_campaign
  from public.campaigns
  where id = p_campaign_id
  for share;

  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  if v_campaign.status not in ('published', 'recruiting') then
    raise exception 'campaign_not_accepting_applications' using errcode = 'P0001';
  end if;

  if v_campaign.application_deadline < now() then
    raise exception 'application_deadline_passed' using errcode = 'P0001';
  end if;

  if p_party_size < 1 or p_party_size > v_campaign.max_companions + 1 then
    raise exception 'invalid_party_size' using errcode = 'P0001';
  end if;

  if coalesce(cardinality(p_exact_slot_ids), 0) = 0
     and jsonb_array_length(coalesce(p_flexible_choices, '[]'::jsonb)) = 0 then
    raise exception 'availability_required' using errcode = 'P0001';
  end if;

  if coalesce(cardinality(p_exact_slot_ids), 0) > 0 then
    select count(*)
      into v_invalid_exact_count
    from unnest(p_exact_slot_ids) requested(id)
    left join public.campaign_slots cs
      on cs.id = requested.id
     and cs.campaign_id = p_campaign_id
     and cs.status = 'open'
     and cs.reserved_count < cs.capacity
     and cs.starts_at > now()
    where cs.id is null;

    if v_invalid_exact_count > 0 then
      raise exception 'invalid_or_closed_slot' using errcode = 'P0001';
    end if;
  end if;

  for v_choice in
    select *
    from jsonb_to_recordset(coalesce(p_flexible_choices, '[]'::jsonb))
      as x(date_local date, after_local time)
  loop
    if v_choice.date_local < v_campaign.visit_period_start
       or v_choice.date_local > v_campaign.visit_period_end then
      raise exception 'flexible_date_outside_visit_period' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.campaign_slots cs
      where cs.campaign_id = p_campaign_id
        and cs.status = 'open'
        and cs.reserved_count < cs.capacity
        and (cs.starts_at at time zone 'Asia/Tokyo')::date = v_choice.date_local
        and (cs.starts_at at time zone 'Asia/Tokyo')::time >= v_choice.after_local
        and cs.starts_at > now()
    ) then
      raise exception 'no_open_slot_for_flexible_choice' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.applications (
    campaign_id,
    creator_id,
    party_size,
    status
  )
  values (
    p_campaign_id,
    v_creator_id,
    p_party_size,
    'applied'
  )
  returning id into v_application_id;

  if coalesce(cardinality(p_exact_slot_ids), 0) > 0 then
    insert into public.application_availabilities (
      application_id,
      kind,
      campaign_slot_id
    )
    select
      v_application_id,
      'exact_slot',
      slot_id
    from unnest(p_exact_slot_ids) as slot_id;
  end if;

  insert into public.application_availabilities (
    application_id,
    kind,
    date_local,
    flexible_after_local
  )
  select
    v_application_id,
    'flexible_after',
    x.date_local,
    x.after_local
  from jsonb_to_recordset(coalesce(p_flexible_choices, '[]'::jsonb))
    as x(date_local date, after_local time);

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
    'creator',
    'application.created',
    'application',
    v_application_id,
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'party_size', p_party_size,
      'exact_count', coalesce(cardinality(p_exact_slot_ids), 0),
      'flexible_count', jsonb_array_length(coalesce(p_flexible_choices, '[]'::jsonb))
    )
  );

  return v_application_id;

exception
  when unique_violation then
    raise exception 'already_applied' using errcode = '23505';
end;
$$;

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

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

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
      and b.status in ('held', 'confirmed')
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

  select count(*)
    into v_booking_count
  from public.bookings
  where campaign_id = v_campaign.id
    and status in ('held', 'confirmed', 'visited');

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

revoke all on function public.apply_to_campaign(uuid, integer, uuid[], jsonb) from public;
grant execute on function public.apply_to_campaign(uuid, integer, uuid[], jsonb) to authenticated;

revoke all on function public.confirm_booking(uuid, uuid) from public;
grant execute on function public.confirm_booking(uuid, uuid) to authenticated;

create policy "restaurant can read campaign payments"
on public.payments for select
using (
  exists (
    select 1
    from public.bookings b
    join public.campaigns c on c.id = b.campaign_id
    where b.id = booking_id
      and public.is_restaurant_member(c.restaurant_id)
  )
  or public.is_admin()
);
