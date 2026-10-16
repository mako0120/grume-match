-- Remove the original permissive Creator directory policies.
-- Only the Creator themself, Admin, or a verified active Restaurant may read
-- marketplace Creator data.

create or replace function public.can_view_creator_profile(target_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_profiles cp
    join public.users creator_user on creator_user.id = cp.user_id
    where cp.id = target_creator_id
      and (
        public.is_admin()
        or (
          cp.user_id = auth.uid()
          and creator_user.status = 'active'
        )
        or (
          creator_user.status = 'active'
          and cp.verified_at is not null
          and exists (
            select 1
            from public.restaurant_memberships rm
            join public.users restaurant_user on restaurant_user.id = rm.user_id
            join public.restaurants r on r.id = rm.restaurant_id
            where rm.user_id = auth.uid()
              and restaurant_user.role = 'restaurant'
              and restaurant_user.status = 'active'
              and r.status = 'active'
              and r.verified_at is not null
          )
        )
      )
  );
$$;

drop policy if exists "creator profiles public readable"
on public.creator_profiles;

drop policy if exists "creator profiles scoped readable"
on public.creator_profiles;

create policy "creator profiles scoped readable"
on public.creator_profiles for select
using (public.can_view_creator_profile(id));


drop policy if exists "creator social accounts readable"
on public.creator_social_accounts;

drop policy if exists "creator social scoped readable"
on public.creator_social_accounts;

create policy "creator social scoped readable"
on public.creator_social_accounts for select
using (public.can_view_creator_profile(creator_id));


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
    and cp.verified_at is not null
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
          and r.verified_at is not null
      )
    )
  order by cs.updated_at desc;
$$;

revoke all on function public.get_active_standby_creators() from public;
grant execute on function public.get_active_standby_creators() to authenticated;
