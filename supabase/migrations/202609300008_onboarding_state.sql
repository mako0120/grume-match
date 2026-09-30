-- Track whether the account finished its first role onboarding.

alter table public.users
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.mark_creator_onboarding_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set
    role = 'creator',
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists creator_profile_marks_onboarding on public.creator_profiles;
create trigger creator_profile_marks_onboarding
after insert or update on public.creator_profiles
for each row execute function public.mark_creator_onboarding_complete();

create or replace function public.mark_restaurant_onboarding_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'owner' then
    update public.users
    set
      role = 'restaurant',
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_membership_marks_onboarding on public.restaurant_memberships;
create trigger restaurant_membership_marks_onboarding
after insert on public.restaurant_memberships
for each row execute function public.mark_restaurant_onboarding_complete();
