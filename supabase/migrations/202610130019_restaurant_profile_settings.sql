create or replace function public.save_restaurant_profile(
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

  select rm.restaurant_id into v_restaurant_id
  from public.restaurant_memberships rm
  join public.users u on u.id = rm.user_id
  where rm.user_id = auth.uid()
    and rm.role in ('owner', 'manager')
    and u.status = 'active'
  order by case rm.role when 'owner' then 1 else 2 end
  limit 1;

  if v_restaurant_id is null then
    raise exception 'restaurant_membership_required' using errcode = 'P0001';
  end if;

  update public.restaurants
  set
    name = trim(p_name),
    address = trim(p_address),
    area = trim(p_area),
    updated_at = now()
  where id = v_restaurant_id
    and status = 'active';

  if not found then
    raise exception 'active_restaurant_required' using errcode = 'P0001';
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
    'restaurant',
    'restaurant.profile_saved',
    'restaurant',
    v_restaurant_id,
    jsonb_build_object(
      'name', trim(p_name),
      'area', trim(p_area)
    )
  );

  return v_restaurant_id;
end;
$$;

revoke all on function public.save_restaurant_profile(text, text, text) from public;
grant execute on function public.save_restaurant_profile(text, text, text) to authenticated;
