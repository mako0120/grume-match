-- Private-alpha RLS hardening.
-- Public campaign and restaurant metadata must not be readable anonymously.

create or replace function public.is_active_creator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'creator'
      and u.status = 'active'
  );
$$;

create or replace function public.can_view_campaign(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = target_campaign_id
      and (
        public.is_admin()
        or public.is_restaurant_member(c.restaurant_id)
        or (
          public.is_active_creator()
          and c.visibility = 'public'
          and c.status in (
            'published', 'recruiting', 'closed',
            'filled', 'in_progress', 'completed'
          )
        )
        or (
          public.is_active_creator()
          and c.visibility = 'direct'
          and exists (
            select 1
            from public.campaign_target_creators ctc
            join public.creator_profiles cp on cp.id = ctc.creator_id
            where ctc.campaign_id = c.id
              and cp.user_id = auth.uid()
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
        or public.is_active_creator()
      )
  );
$$;

drop policy if exists "restaurants public readable"
on public.restaurants;

create policy "restaurants authenticated scoped readable"
on public.restaurants for select
using (public.can_view_restaurant(id));
