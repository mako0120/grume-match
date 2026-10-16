-- Simple Creator Standby: one tap means "I can take an urgent PR now".
-- No live location tracking. Standby expires automatically after 4 hours.

create table public.creator_standby (
  creator_id uuid primary key references public.creator_profiles(id) on delete cascade,
  enabled boolean not null default false,
  available_until timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (enabled = false)
    or
    (enabled = true and available_until is not null)
  )
);

alter table public.creator_standby enable row level security;

create policy "creator reads own standby"
on public.creator_standby for select
using (
  exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id
      and cp.user_id = auth.uid()
  )
  or public.is_admin()
);

create or replace function public.set_creator_standby(
  p_enabled boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_until timestamptz;
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

  v_until := case
    when p_enabled then now() + interval '4 hours'
    else null
  end;

  insert into public.creator_standby(
    creator_id,
    enabled,
    available_until,
    updated_at
  )
  values(
    v_creator_id,
    p_enabled,
    v_until,
    now()
  )
  on conflict (creator_id) do update
  set
    enabled = excluded.enabled,
    available_until = excluded.available_until,
    updated_at = now();

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
    'creator',
    case when p_enabled then 'creator.standby_enabled' else 'creator.standby_disabled' end,
    'creator_standby',
    v_creator_id,
    jsonb_build_object('available_until', v_until)
  );

  return v_until;
end;
$$;

revoke all on function public.set_creator_standby(boolean) from public;
grant execute on function public.set_creator_standby(boolean) to authenticated;

create or replace function public.get_active_standby_creators()
returns table (
  creator_id uuid,
  display_name text,
  base_area text,
  min_reward integer,
  followers integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    cp.display_name,
    cp.base_area,
    cp.min_reward,
    coalesce((
      select csa.followers
      from public.creator_social_accounts csa
      where csa.creator_id = cp.id
        and csa.platform = 'instagram'
      order by csa.followers desc
      limit 1
    ), 0) as followers
  from public.creator_standby cs
  join public.creator_profiles cp on cp.id = cs.creator_id
  join public.users u on u.id = cp.user_id
  where cs.enabled = true
    and cs.available_until > now()
    and u.status = 'active'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.restaurant_memberships rm
        where rm.user_id = auth.uid()
      )
    )
  order by cs.updated_at desc;
$$;

revoke all on function public.get_active_standby_creators() from public;
grant execute on function public.get_active_standby_creators() to authenticated;

create or replace function public.notify_standby_creators_for_flash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_restaurant_name text;
begin
  if new.kind <> 'flash' then
    return new;
  end if;

  select r.name
    into v_restaurant_name
  from public.restaurants r
  where r.id = new.restaurant_id;

  for v_row in
    select cp.user_id
    from public.creator_standby cs
    join public.creator_profiles cp on cp.id = cs.creator_id
    join public.users u on u.id = cp.user_id
    where cs.enabled = true
      and cs.available_until > now()
      and u.status = 'active'
  loop
    perform public.create_notification(
      v_row.user_id,
      'flash_for_standby',
      '今行けるFLASHが出ました',
      coalesce(v_restaurant_name, '店舗') || 'から緊急の有償PR募集が公開されました。'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists campaigns_notify_standby_flash on public.campaigns;

create trigger campaigns_notify_standby_flash
after insert on public.campaigns
for each row execute function public.notify_standby_creators_for_flash();
