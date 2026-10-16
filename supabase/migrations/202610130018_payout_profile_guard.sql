-- Manual payouts cannot move to scheduled/paid until the Creator
-- has supplied a payout destination.

create or replace function public.require_creator_payout_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('scheduled', 'paid')
     and new.status is distinct from old.status
     and not exists (
       select 1
       from public.creator_payout_profiles cpp
       where cpp.creator_id = new.creator_id
     ) then
    raise exception 'creator_payout_profile_required' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_require_payout_profile
on public.payments;

create trigger payments_require_payout_profile
before update of status on public.payments
for each row execute function public.require_creator_payout_profile();
