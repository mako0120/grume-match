-- Creator directory and Standby visibility require an active Restaurant account.

create or replace function public.can_view_creator_profile(target_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or exists (
        select 1
        from public.creator_profiles cp
        join public.users u on u.id = cp.user_id
        where cp.id = target_creator_id
          and cp.user_id = auth.uid()
          and u.status = 'active'
      )
      or exists (
        select 1
        from public.restaurant_memberships rm
        join public.users u on u.id = rm.user_id
        join public.restaurants r on r.id = rm.restaurant_id
        where rm.user_id = auth.uid()
          and u.role = 'restaurant'
          and u.status = 'active'
          and r.status = 'active'
      )
    );
$$;

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
  join public.users creator_user on creator_user.id = cp.user_id
  where cs.enabled = true
    and cs.available_until > now()
    and creator_user.status = 'active'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.restaurant_memberships rm
        join public.users restaurant_user on restaurant_user.id = rm.user_id
        join public.restaurants r on r.id = rm.restaurant_id
        where rm.user_id = auth.uid()
          and restaurant_user.role = 'restaurant'
          and restaurant_user.status = 'active'
          and r.status = 'active'
      )
    )
  order by cs.updated_at desc;
$$;

revoke all on function public.get_active_standby_creators() from public;
grant execute on function public.get_active_standby_creators() to authenticated;
