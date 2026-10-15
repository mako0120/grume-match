-- Do not suspend a Restaurant while any transaction or money remains open.

create or replace function public.restaurant_has_open_commercial_transactions(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.campaigns c
      where c.restaurant_id = p_restaurant_id
        and c.status in ('published', 'recruiting', 'filled', 'in_progress')
    )
    or exists (
      select 1
      from public.campaigns c
      join public.applications a on a.campaign_id = c.id
      where c.restaurant_id = p_restaurant_id
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
      from public.campaigns c
      join public.bookings b on b.campaign_id = c.id
      where c.restaurant_id = p_restaurant_id
        and b.status in ('held', 'confirmed', 'visited', 'reschedule_requested')
    )
    or exists (
      select 1
      from public.campaigns c
      join public.bookings b on b.campaign_id = c.id
      join public.payments p on p.booking_id = b.id
      where c.restaurant_id = p_restaurant_id
        and p.status not in ('paid', 'cancelled')
    )
    or exists (
      select 1
      from public.campaigns c
      join public.bookings b on b.campaign_id = c.id
      join public.booking_disputes bd on bd.booking_id = b.id
      where c.restaurant_id = p_restaurant_id
        and bd.status = 'open'
    );
$$;

revoke all on function public.restaurant_has_open_commercial_transactions(uuid)
from public;


create or replace function public.admin_suspend_participant(
  p_kind text,
  p_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_entity_type text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'moderation_reason_required' using errcode = 'P0001';
  end if;

  if p_kind = 'creator' then
    select cp.user_id into v_user_id
    from public.creator_profiles cp
    where cp.id = p_id;

    if v_user_id is null then
      raise exception 'creator_not_found' using errcode = 'P0002';
    end if;

    if public.user_has_open_commercial_transactions(v_user_id) then
      raise exception 'participant_has_active_transactions' using errcode = 'P0001';
    end if;

    update public.users
    set
      status = 'suspended',
      updated_at = now()
    where id = v_user_id;

    v_entity_type := 'creator_profile';

  elsif p_kind = 'restaurant' then
    if public.restaurant_has_open_commercial_transactions(p_id) then
      raise exception 'participant_has_active_transactions' using errcode = 'P0001';
    end if;

    update public.restaurants
    set
      status = 'suspended',
      updated_at = now()
    where id = p_id
      and status = 'active';

    if not found then
      raise exception 'restaurant_not_found' using errcode = 'P0002';
    end if;

    select rm.user_id into v_user_id
    from public.restaurant_memberships rm
    join public.users u on u.id = rm.user_id
    where rm.restaurant_id = p_id
      and u.status = 'active'
    order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
    limit 1;

    v_entity_type := 'restaurant';
  else
    raise exception 'invalid_participant_kind' using errcode = 'P0001';
  end if;

  if v_user_id is not null then
    perform public.create_notification(
      v_user_id,
      'participant_suspended',
      '利用状態を確認してください',
      '運営確認により有償PR機能の利用を停止しました。'
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
    'admin',
    'participant.suspended',
    v_entity_type,
    p_id,
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

revoke all on function public.admin_suspend_participant(text, uuid, text) from public;
grant execute on function public.admin_suspend_participant(text, uuid, text) to authenticated;
