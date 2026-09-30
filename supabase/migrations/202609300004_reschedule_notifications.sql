-- Reschedule workflow, in-app notifications, and payment due metadata.

create type public.reschedule_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  requested_slot_id uuid not null references public.campaign_slots(id) on delete restrict,
  status public.reschedule_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);

create unique index booking_reschedule_one_pending_idx
  on public.booking_reschedule_requests(booking_id)
  where status = 'pending';

create index booking_reschedule_status_idx
  on public.booking_reschedule_requests(status, requested_at);

alter table public.booking_reschedule_requests enable row level security;

create policy "booking parties read reschedule requests"
on public.booking_reschedule_requests for select
using (
  exists (
    select 1
    from public.bookings b
    join public.creator_profiles cp on cp.id = b.creator_id
    join public.campaigns c on c.id = b.campaign_id
    where b.id = booking_id
      and (
        cp.user_id = auth.uid()
        or public.is_restaurant_member(c.restaurant_id)
        or public.is_admin()
      )
  )
);

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications(user_id, type, title, body)
  values (p_user_id, p_type, p_title, p_body)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text) from public;

create or replace function public.request_booking_reschedule(
  p_booking_id uuid,
  p_requested_slot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_current_slot public.campaign_slots%rowtype;
  v_requested_slot public.campaign_slots%rowtype;
  v_campaign public.campaigns%rowtype;
  v_creator_user_id uuid;
  v_request_id uuid;
  v_actor_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id;

  if v_creator_user_id = auth.uid() then
    v_actor_role := 'creator';
  elsif public.is_restaurant_member(v_campaign.restaurant_id) then
    v_actor_role := 'restaurant';
  elsif public.is_admin() then
    v_actor_role := 'admin';
  else
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'reschedule_requested') then
    raise exception 'booking_not_reschedulable' using errcode = 'P0001';
  end if;

  select * into v_current_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id;

  select * into v_requested_slot
  from public.campaign_slots
  where id = p_requested_slot_id
  for share;

  if not found or v_requested_slot.campaign_id <> v_booking.campaign_id then
    raise exception 'invalid_requested_slot' using errcode = 'P0001';
  end if;

  if v_requested_slot.id = v_current_slot.id then
    raise exception 'same_slot' using errcode = 'P0001';
  end if;

  if v_requested_slot.status <> 'open'
     or v_requested_slot.reserved_count >= v_requested_slot.capacity
     or v_requested_slot.starts_at <= now() then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  insert into public.booking_reschedule_requests(
    booking_id,
    requested_by,
    requested_slot_id,
    status
  )
  values(
    p_booking_id,
    auth.uid(),
    p_requested_slot_id,
    'pending'
  )
  returning id into v_request_id;

  update public.bookings
  set status = 'reschedule_requested'
  where id = p_booking_id;

  perform public.create_notification(
    case when v_actor_role = 'creator'
      then (
        select rm.user_id
        from public.restaurant_memberships rm
        where rm.restaurant_id = v_campaign.restaurant_id
        order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
        limit 1
      )
      else v_creator_user_id
    end,
    'reschedule_requested',
    '日時変更リクエスト',
    'PR来店日時の変更リクエストが届きました。'
  );

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id, after_json
  )
  values(
    auth.uid(),
    v_actor_role,
    'booking.reschedule_requested',
    'booking_reschedule_request',
    v_request_id,
    jsonb_build_object(
      'booking_id', p_booking_id,
      'from_slot_id', v_current_slot.id,
      'to_slot_id', v_requested_slot.id
    )
  );

  return v_request_id;

exception
  when unique_violation then
    raise exception 'reschedule_already_pending' using errcode = '23505';
end;
$$;

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

revoke all on function public.request_booking_reschedule(uuid, uuid) from public;
grant execute on function public.request_booking_reschedule(uuid, uuid) to authenticated;

revoke all on function public.review_booking_reschedule(uuid, boolean, text) from public;
grant execute on function public.review_booking_reschedule(uuid, boolean, text) to authenticated;
