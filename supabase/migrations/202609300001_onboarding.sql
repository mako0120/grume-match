-- Onboarding helpers and profile ownership policies.

create policy "creator profile owner insert"
on public.creator_profiles for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "restaurant memberships read scoped"
on public.restaurant_memberships for select
using (user_id = auth.uid() or public.is_admin());

create or replace function public.complete_creator_onboarding(
  p_display_name text,
  p_bio text,
  p_base_area text,
  p_min_reward integer default 0,
  p_travel_radius_km integer default 20
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'display_name_required' using errcode = 'P0001';
  end if;

  if nullif(trim(p_base_area), '') is null then
    raise exception 'base_area_required' using errcode = 'P0001';
  end if;

  if p_min_reward < 0 or p_travel_radius_km < 0 then
    raise exception 'invalid_numeric_value' using errcode = 'P0001';
  end if;

  update public.users
  set role = 'creator'
  where id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'active_user_required' using errcode = 'P0001';
  end if;

  insert into public.creator_profiles (
    user_id,
    display_name,
    bio,
    base_area,
    min_reward,
    travel_radius_km
  )
  values (
    auth.uid(),
    trim(p_display_name),
    coalesce(p_bio, ''),
    trim(p_base_area),
    p_min_reward,
    p_travel_radius_km
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    bio = excluded.bio,
    base_area = excluded.base_area,
    min_reward = excluded.min_reward,
    travel_radius_km = excluded.travel_radius_km
  returning id into v_profile_id;

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
    'creator.onboarding_completed',
    'creator_profile',
    v_profile_id,
    jsonb_build_object(
      'base_area', trim(p_base_area),
      'min_reward', p_min_reward,
      'travel_radius_km', p_travel_radius_km
    )
  );

  return v_profile_id;
end;
$$;

create or replace function public.complete_restaurant_onboarding(
  p_name text,
  p_address text,
  p_area text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if nullif(trim(p_name), '') is null
     or nullif(trim(p_address), '') is null
     or nullif(trim(p_area), '') is null then
    raise exception 'restaurant_fields_required' using errcode = 'P0001';
  end if;

  update public.users
  set role = 'restaurant'
  where id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'active_user_required' using errcode = 'P0001';
  end if;

  select rm.restaurant_id
    into v_restaurant_id
  from public.restaurant_memberships rm
  where rm.user_id = auth.uid()
    and rm.role = 'owner'
  order by rm.id
  limit 1;

  if v_restaurant_id is null then
    insert into public.restaurants (name, address, area)
    values (trim(p_name), trim(p_address), trim(p_area))
    returning id into v_restaurant_id;

    insert into public.restaurant_memberships (
      restaurant_id,
      user_id,
      role
    )
    values (
      v_restaurant_id,
      auth.uid(),
      'owner'
    );
  else
    update public.restaurants
    set
      name = trim(p_name),
      address = trim(p_address),
      area = trim(p_area)
    where id = v_restaurant_id;
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
    'restaurant',
    'restaurant.onboarding_completed',
    'restaurant',
    v_restaurant_id,
    jsonb_build_object('area', trim(p_area))
  );

  return v_restaurant_id;
end;
$$;

revoke all on function public.complete_creator_onboarding(text, text, text, integer, integer) from public;
grant execute on function public.complete_creator_onboarding(text, text, text, integer, integer) to authenticated;

revoke all on function public.complete_restaurant_onboarding(text, text, text) from public;
grant execute on function public.complete_restaurant_onboarding(text, text, text) to authenticated;
