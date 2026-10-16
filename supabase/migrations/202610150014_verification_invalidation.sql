-- Re-run participant verification when identity-bearing profile data changes.

create or replace function public.invalidate_creator_verification_on_profile_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name then
    new.verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists creator_profile_invalidate_verification
on public.creator_profiles;

create trigger creator_profile_invalidate_verification
before update on public.creator_profiles
for each row execute function public.invalidate_creator_verification_on_profile_change();


create or replace function public.invalidate_creator_verification_on_social_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
begin
  v_creator_id := case
    when tg_op = 'DELETE' then old.creator_id
    else new.creator_id
  end;

  if tg_op = 'UPDATE'
     and new.platform is not distinct from old.platform
     and new.handle is not distinct from old.handle
     and new.profile_url is not distinct from old.profile_url then
    return new;
  end if;

  update public.creator_profiles
  set verified_at = null
  where id = v_creator_id
    and verified_at is not null;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists creator_social_invalidate_verification
on public.creator_social_accounts;

create trigger creator_social_invalidate_verification
after insert or update or delete on public.creator_social_accounts
for each row execute function public.invalidate_creator_verification_on_social_change();


create or replace function public.invalidate_restaurant_verification_on_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
     or new.address is distinct from old.address then
    new.verified_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_invalidate_verification
on public.restaurants;

create trigger restaurant_invalidate_verification
before update on public.restaurants
for each row execute function public.invalidate_restaurant_verification_on_identity_change();
