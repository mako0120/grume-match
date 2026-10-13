-- Commercial booking lifecycle: visit confirmation, cancellation, no-show,
-- deliverable timing guard, and campaign completion.

alter table public.bookings
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists no_show_at timestamptz;

create or replace function public.mark_booking_visited(
  p_booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_slot public.campaign_slots%rowtype;
  v_creator_user_id uuid;
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

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id
  for update;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status = 'visited' then
    return;
  end if;

  if v_booking.status not in ('confirmed', 'reschedule_requested') then
    raise exception 'booking_not_visitable' using errcode = 'P0001';
  end if;

  select * into v_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id;

  if not found then
    raise exception 'booking_slot_not_found' using errcode = 'P0002';
  end if;

  if v_slot.starts_at > now() then
    raise exception 'visit_not_started' using errcode = 'P0001';
  end if;

  update public.booking_reschedule_requests
  set
    status = 'cancelled',
    reviewed_at = now(),
    review_note = '来店済みのため日時変更を終了'
  where booking_id = v_booking.id
    and status = 'pending';

  update public.bookings
  set
    status = 'visited',
    visited_at = coalesce(visited_at, now())
  where id = v_booking.id;

  update public.applications
  set status = 'visited'
  where id = v_booking.application_id
    and status in ('scheduled', 'reschedule_requested');

  update public.campaigns
  set status = 'in_progress'
  where id = v_campaign.id
    and status in ('published', 'recruiting', 'closed', 'filled');

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id is not null then
    perform public.create_notification(
      v_creator_user_id,
      'visit_confirmed',
      '来店が確認されました',
      'PR来店が確認されました。投稿後にURLを提出してください。'
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id,
    before_json, after_json
  )
  values(
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'booking.visited',
    'booking',
    v_booking.id,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'visited', 'visited_at', now())
  );
end;
$$;

revoke all on function public.mark_booking_visited(uuid) from public;
grant execute on function public.mark_booking_visited(uuid) to authenticated;


create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_slot public.campaign_slots%rowtype;
  v_creator_user_id uuid;
  v_restaurant_user_id uuid;
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

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id
  for update;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

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
    raise exception 'booking_not_cancellable' using errcode = 'P0001';
  end if;

  select * into v_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id
  for update;

  if not found then
    raise exception 'booking_slot_not_found' using errcode = 'P0002';
  end if;

  if v_slot.starts_at <= now() then
    raise exception 'visit_already_started' using errcode = 'P0001';
  end if;

  update public.booking_reschedule_requests
  set
    status = 'cancelled',
    reviewed_at = now(),
    review_note = '来店キャンセルにより終了'
  where booking_id = v_booking.id
    and status = 'pending';

  update public.bookings
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by_user_id = auth.uid(),
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_booking.id;

  update public.applications
  set status = 'cancelled'
  where id = v_booking.application_id;

  update public.payments
  set status = 'cancelled'
  where booking_id = v_booking.id
    and status = 'pending';

  update public.campaign_slots
  set
    reserved_count = greatest(0, reserved_count - 1),
    status = case
      when reserved_count - 1 < capacity then 'open'::public.slot_status
      else status
    end
  where id = v_slot.id;

  if v_campaign.status = 'filled'
     and v_campaign.application_deadline > now()
     and v_campaign.visit_period_end >= (now() at time zone 'Asia/Tokyo')::date then
    update public.campaigns
    set status = 'recruiting'
    where id = v_campaign.id;
  end if;

  select rm.user_id into v_restaurant_user_id
  from public.restaurant_memberships rm
  join public.users u on u.id = rm.user_id
  where rm.restaurant_id = v_campaign.restaurant_id
    and u.status = 'active'
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  if v_actor_role = 'creator' and v_restaurant_user_id is not null then
    perform public.create_notification(
      v_restaurant_user_id,
      'booking_cancelled',
      'PR来店がキャンセルされました',
      'Creatorから来店キャンセルがありました。'
    );
  elsif v_actor_role = 'restaurant' and v_creator_user_id is not null then
    perform public.create_notification(
      v_creator_user_id,
      'booking_cancelled',
      'PR来店がキャンセルされました',
      '店舗から来店キャンセルがありました。'
    );
  elsif v_actor_role = 'admin' then
    if v_creator_user_id is not null then
      perform public.create_notification(
        v_creator_user_id,
        'booking_cancelled',
        'PR来店がキャンセルされました',
        '運営により来店キャンセルが処理されました。'
      );
    end if;
    if v_restaurant_user_id is not null then
      perform public.create_notification(
        v_restaurant_user_id,
        'booking_cancelled',
        'PR来店がキャンセルされました',
        '運営により来店キャンセルが処理されました。'
      );
    end if;
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id,
    before_json, after_json
  )
  values(
    auth.uid(),
    v_actor_role,
    'booking.cancelled',
    'booking',
    v_booking.id,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object(
      'status', 'cancelled',
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );
end;
$$;

revoke all on function public.cancel_booking(uuid, text) from public;
grant execute on function public.cancel_booking(uuid, text) to authenticated;


create or replace function public.mark_booking_no_show(
  p_booking_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_slot public.campaign_slots%rowtype;
  v_creator_user_id uuid;
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

  select * into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id
  for update;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'reschedule_requested') then
    raise exception 'booking_not_no_showable' using errcode = 'P0001';
  end if;

  select * into v_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id;

  if not found then
    raise exception 'booking_slot_not_found' using errcode = 'P0002';
  end if;

  if v_slot.starts_at + interval '30 minutes' > now() then
    raise exception 'no_show_too_early' using errcode = 'P0001';
  end if;

  update public.booking_reschedule_requests
  set
    status = 'cancelled',
    reviewed_at = now(),
    review_note = '来店なし記録により終了'
  where booking_id = v_booking.id
    and status = 'pending';

  update public.bookings
  set
    status = 'no_show',
    no_show_at = now(),
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_booking.id;

  update public.applications
  set status = 'cancelled'
  where id = v_booking.application_id;

  update public.payments
  set status = 'cancelled'
  where booking_id = v_booking.id
    and status = 'pending';

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id is not null then
    perform public.create_notification(
      v_creator_user_id,
      'booking_no_show',
      '来店状況が更新されました',
      '店舗により来店なしとして記録されました。内容に相違がある場合は運営へご連絡ください。'
    );
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id,
    before_json, after_json
  )
  values(
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'booking.no_show',
    'booking',
    v_booking.id,
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object(
      'status', 'no_show',
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );
end;
$$;

revoke all on function public.mark_booking_no_show(uuid, text) from public;
grant execute on function public.mark_booking_no_show(uuid, text) to authenticated;


create or replace function public.submit_deliverable(
  p_deliverable_id uuid,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.deliverables%rowtype;
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_slot public.campaign_slots%rowtype;
  v_creator_user_id uuid;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_url !~ '^https?://[^[:space:]]+$' then
    raise exception 'invalid_deliverable_url' using errcode = 'P0001';
  end if;

  select * into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  if v_deliverable.verification_status = 'approved' then
    raise exception 'deliverable_already_approved' using errcode = 'P0001';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_deliverable.booking_id
  for update;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'visited') then
    raise exception 'booking_not_submittable' using errcode = 'P0001';
  end if;

  select * into v_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id;

  if not found then
    raise exception 'booking_slot_not_found' using errcode = 'P0002';
  end if;

  if v_slot.starts_at > now() then
    raise exception 'booking_not_started' using errcode = 'P0001';
  end if;

  if v_booking.status = 'confirmed' then
    update public.bookings
    set
      status = 'visited',
      visited_at = coalesce(visited_at, now())
    where id = v_booking.id;

    update public.applications
    set status = 'visited'
    where id = v_booking.application_id
      and status = 'scheduled';

    select * into v_campaign
    from public.campaigns
    where id = v_booking.campaign_id
    for update;

    update public.campaigns
    set status = 'in_progress'
    where id = v_campaign.id
      and status in ('published', 'recruiting', 'closed', 'filled');
  end if;

  update public.deliverables
  set
    submitted_url = p_url,
    submitted_at = now(),
    verification_status = 'pending',
    verification_note = null
  where id = p_deliverable_id;

  select count(*) into v_remaining
  from public.deliverables d
  where d.booking_id = v_booking.id
    and d.submitted_url is null;

  if v_remaining = 0 then
    update public.applications
    set status = 'submitted'
    where id = v_booking.application_id
      and status in ('scheduled', 'visited', 'submitted');
  end if;

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id, after_json
  )
  values(
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'creator'::public.user_role end,
    'deliverable.submitted',
    'deliverable',
    p_deliverable_id,
    jsonb_build_object('url', p_url)
  );
end;
$$;

revoke all on function public.submit_deliverable(uuid, text) from public;
grant execute on function public.submit_deliverable(uuid, text) to authenticated;


create or replace function public.finalize_campaign_when_payments_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_active_booking_count integer;
  v_unpaid_booking_count integer;
begin
  if new.status <> 'paid'
     or old.status is not distinct from new.status then
    return new;
  end if;

  select b.campaign_id into v_campaign_id
  from public.bookings b
  where b.id = new.booking_id;

  if v_campaign_id is null then
    return new;
  end if;

  select count(*) into v_active_booking_count
  from public.bookings b
  where b.campaign_id = v_campaign_id
    and b.status not in ('cancelled', 'no_show');

  select count(*) into v_unpaid_booking_count
  from public.bookings b
  left join public.payments p on p.booking_id = b.id
  where b.campaign_id = v_campaign_id
    and b.status not in ('cancelled', 'no_show')
    and (p.id is null or p.status <> 'paid');

  if v_active_booking_count > 0 and v_unpaid_booking_count = 0 then
    update public.campaigns
    set status = 'completed'
    where id = v_campaign_id
      and status in ('closed', 'filled', 'in_progress');
  end if;

  return new;
end;
$$;

drop trigger if exists payments_finalize_campaign
on public.payments;

create trigger payments_finalize_campaign
after update of status on public.payments
for each row execute function public.finalize_campaign_when_payments_paid();
