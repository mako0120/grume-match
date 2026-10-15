-- Require an Admin verification pass before commercial participants can transact.

create or replace function public.enforce_verified_live_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
begin
  if public.is_admin() then
    return new;
  end if;

  if (
    (tg_op = 'INSERT' and new.status in ('published', 'recruiting'))
    or
    (tg_op = 'UPDATE'
      and old.status = 'draft'
      and new.status in ('published', 'recruiting'))
  ) then
    select * into v_restaurant
    from public.restaurants
    where id = new.restaurant_id;

    if not found
       or v_restaurant.status <> 'active'
       or v_restaurant.verified_at is null then
      raise exception 'restaurant_not_verified' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_require_verified_restaurant
on public.campaigns;

create trigger campaigns_require_verified_restaurant
before insert or update of status on public.campaigns
for each row execute function public.enforce_verified_live_campaign();


create or replace function public.enforce_verified_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_verified_at timestamptz;
  v_creator_user_status public.account_status;
  v_restaurant_verified_at timestamptz;
  v_restaurant_status public.account_status;
begin
  if public.is_admin() then
    return new;
  end if;

  select cp.verified_at, u.status
    into v_creator_verified_at, v_creator_user_status
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.id = new.creator_id;

  if v_creator_user_status is distinct from 'active'
     or v_creator_verified_at is null then
    raise exception 'creator_not_verified' using errcode = 'P0001';
  end if;

  select r.verified_at, r.status
    into v_restaurant_verified_at, v_restaurant_status
  from public.campaigns c
  join public.restaurants r on r.id = c.restaurant_id
  where c.id = new.campaign_id;

  if v_restaurant_status is distinct from 'active'
     or v_restaurant_verified_at is null then
    raise exception 'restaurant_not_verified' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_require_verified_participants
on public.applications;

create trigger applications_require_verified_participants
before insert on public.applications
for each row execute function public.enforce_verified_application();


create or replace function public.enforce_verified_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_verified_at timestamptz;
  v_creator_user_status public.account_status;
  v_restaurant_verified_at timestamptz;
  v_restaurant_status public.account_status;
begin
  if public.is_admin() then
    return new;
  end if;

  select cp.verified_at, u.status
    into v_creator_verified_at, v_creator_user_status
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.id = new.creator_id;

  if v_creator_user_status is distinct from 'active'
     or v_creator_verified_at is null then
    raise exception 'creator_not_verified' using errcode = 'P0001';
  end if;

  select r.verified_at, r.status
    into v_restaurant_verified_at, v_restaurant_status
  from public.campaigns c
  join public.restaurants r on r.id = c.restaurant_id
  where c.id = new.campaign_id;

  if v_restaurant_status is distinct from 'active'
     or v_restaurant_verified_at is null then
    raise exception 'restaurant_not_verified' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_require_verified_participants
on public.bookings;

create trigger bookings_require_verified_participants
before insert on public.bookings
for each row execute function public.enforce_verified_booking();


create or replace function public.admin_verify_participant(
  p_kind text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_kind = 'creator' then
    update public.creator_profiles
    set
      verified_at = coalesce(verified_at, now()),
      updated_at = now()
    where id = p_id;

    if not found then
      raise exception 'creator_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'creator_profile';
  elsif p_kind = 'restaurant' then
    update public.restaurants
    set
      verified_at = coalesce(verified_at, now()),
      updated_at = now()
    where id = p_id
      and status = 'active';

    if not found then
      raise exception 'restaurant_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'restaurant';
  else
    raise exception 'invalid_participant_kind' using errcode = 'P0001';
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
    'participant.verified',
    v_entity_type,
    p_id,
    jsonb_build_object('verified_at', now())
  );
end;
$$;

revoke all on function public.admin_verify_participant(text, uuid) from public;
grant execute on function public.admin_verify_participant(text, uuid) to authenticated;
