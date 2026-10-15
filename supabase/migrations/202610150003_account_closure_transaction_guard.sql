-- Do not suspend a commercial participant while unresolved work or money remains.

create or replace function public.user_has_open_commercial_transactions(
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select u.role into v_role
  from public.users u
  where u.id = p_user_id;

  if v_role = 'creator' then
    return exists (
      select 1
      from public.creator_profiles cp
      join public.applications a on a.creator_id = cp.id
      where cp.user_id = p_user_id
        and a.status in (
          'applied',
          'shortlisted',
          'accepted',
          'scheduled',
          'visited',
          'submitted',
          'approved',
          'reschedule_requested',
          'dispute'
        )
    )
    or exists (
      select 1
      from public.creator_profiles cp
      join public.bookings b on b.creator_id = cp.id
      where cp.user_id = p_user_id
        and b.status in ('held', 'confirmed', 'visited', 'reschedule_requested')
    )
    or exists (
      select 1
      from public.creator_profiles cp
      join public.payments p on p.creator_id = cp.id
      where cp.user_id = p_user_id
        and p.status not in ('paid', 'cancelled')
    );
  end if;

  if v_role = 'restaurant' then
    return exists (
      select 1
      from public.restaurant_memberships rm
      join public.campaigns c on c.restaurant_id = rm.restaurant_id
      where rm.user_id = p_user_id
        and c.status in ('published', 'recruiting', 'filled', 'in_progress')
    )
    or exists (
      select 1
      from public.restaurant_memberships rm
      join public.campaigns c on c.restaurant_id = rm.restaurant_id
      join public.applications a on a.campaign_id = c.id
      where rm.user_id = p_user_id
        and a.status in (
          'applied',
          'shortlisted',
          'accepted',
          'scheduled',
          'visited',
          'submitted',
          'approved',
          'reschedule_requested',
          'dispute'
        )
    )
    or exists (
      select 1
      from public.restaurant_memberships rm
      join public.campaigns c on c.restaurant_id = rm.restaurant_id
      join public.bookings b on b.campaign_id = c.id
      left join public.payments p on p.booking_id = b.id
      where rm.user_id = p_user_id
        and (
          b.status in ('held', 'confirmed', 'visited', 'reschedule_requested')
          or (p.id is not null and p.status not in ('paid', 'cancelled'))
        )
    );
  end if;

  return false;
end;
$$;

revoke all on function public.user_has_open_commercial_transactions(uuid) from public;


create or replace function public.review_account_closure(
  p_request_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_closure_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action not in ('suspend', 'dismiss') then
    raise exception 'invalid_closure_action' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.account_closure_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'closure_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'closure_request_already_resolved' using errcode = 'P0001';
  end if;

  if p_action = 'suspend'
     and public.user_has_open_commercial_transactions(v_request.user_id) then
    raise exception 'closure_has_active_transactions' using errcode = 'P0001';
  end if;

  if p_action = 'suspend' then
    update public.users
    set
      status = 'suspended',
      updated_at = now()
    where id = v_request.user_id;
  end if;

  update public.account_closure_requests
  set
    status = case when p_action = 'suspend' then 'processed' else 'dismissed' end,
    admin_note = nullif(trim(coalesce(p_note, '')), ''),
    resolved_at = now()
  where id = p_request_id;

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
    'account.closure_reviewed',
    'account_closure_request',
    p_request_id,
    jsonb_build_object('status', v_request.status),
    jsonb_build_object(
      'action', p_action,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );
end;
$$;

revoke all on function public.review_account_closure(uuid, text, text) from public;
grant execute on function public.review_account_closure(uuid, text, text) to authenticated;
