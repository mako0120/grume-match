-- Keep the MVP account role stable after first onboarding.
-- A user can choose Creator or Restaurant once; later role changes require a trusted admin path.

create or replace function public.is_restaurant_member(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships rm
    join public.users u on u.id = rm.user_id
    join public.restaurants r on r.id = rm.restaurant_id
    where rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and u.role = 'restaurant'
      and u.status = 'active'
      and r.status = 'active'
  );
$$;

create or replace function public.prevent_self_role_switch_after_onboarding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.onboarding_completed_at is not null
     and new.role is distinct from old.role
     and auth.uid() = old.id then
    raise exception 'role_locked_after_onboarding' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_lock_role_after_onboarding on public.users;

create trigger users_lock_role_after_onboarding
before update of role on public.users
for each row execute function public.prevent_self_role_switch_after_onboarding();
