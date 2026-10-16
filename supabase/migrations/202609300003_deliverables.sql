-- Deliverable submission/review workflow and payment approval.

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
  v_creator_user_id uuid;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_url !~ '^https?://[^[:space:]]+$' then
    raise exception 'invalid_deliverable_url' using errcode = 'P0001';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_deliverable.booking_id
  for update;

  select cp.user_id
    into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'visited') then
    raise exception 'booking_not_submittable' using errcode = 'P0001';
  end if;

  update public.deliverables
  set
    submitted_url = p_url,
    submitted_at = now(),
    verification_status = 'pending',
    verification_note = null
  where id = p_deliverable_id;

  select count(*)
    into v_remaining
  from public.deliverables d
  where d.booking_id = v_booking.id
    and d.submitted_url is null;

  if v_remaining = 0 then
    update public.applications
    set status = 'submitted'
    where id = v_booking.application_id
      and status in ('scheduled', 'visited', 'submitted');
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
    case when public.is_admin() then 'admin'::public.user_role else 'creator'::public.user_role end,
    'deliverable.submitted',
    'deliverable',
    p_deliverable_id,
    jsonb_build_object('url', p_url)
  );
end;
$$;

create or replace function public.review_deliverable(
  p_deliverable_id uuid,
  p_approved boolean,
  p_note text default null
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
  v_unapproved integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  if v_deliverable.submitted_url is null then
    raise exception 'deliverable_not_submitted' using errcode = 'P0001';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_deliverable.booking_id
  for update;

  select *
    into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.deliverables
  set
    verification_status = case
      when p_approved then 'approved'::public.verification_status
      else 'rejected'::public.verification_status
    end,
    verification_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_deliverable_id;

  if p_approved then
    select count(*)
      into v_unapproved
    from public.deliverables d
    where d.booking_id = v_booking.id
      and d.verification_status <> 'approved';

    if v_unapproved = 0 then
      update public.applications
      set status = 'approved'
      where id = v_booking.application_id;

      update public.payments
      set status = 'approved'
      where booking_id = v_booking.id
        and status = 'pending';
    end if;
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
    case when p_approved then 'deliverable.approved' else 'deliverable.rejected' end,
    'deliverable',
    p_deliverable_id,
    jsonb_build_object(
      'approved', p_approved,
      'note', p_note
    )
  );
end;
$$;

revoke all on function public.submit_deliverable(uuid, text) from public;
grant execute on function public.submit_deliverable(uuid, text) to authenticated;

revoke all on function public.review_deliverable(uuid, boolean, text) from public;
grant execute on function public.review_deliverable(uuid, boolean, text) to authenticated;
