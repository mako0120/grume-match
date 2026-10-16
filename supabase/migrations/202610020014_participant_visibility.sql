-- Hide suspended marketplace participants from counterparties.

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
          and exists (
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
      )
  );
$$;

create or replace function public.can_view_restaurant(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = target_restaurant_id
      and (
        public.is_admin()
        or public.is_restaurant_member(r.id)
        or (
          r.status = 'active'
          and public.is_active_creator()
        )
      )
  );
$$;
