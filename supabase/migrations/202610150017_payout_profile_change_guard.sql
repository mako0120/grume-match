-- Bank destination changes must not race an approved/scheduled payout.

create or replace function public.guard_creator_payout_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.bank_name is not distinct from old.bank_name
     and new.branch_name is not distinct from old.branch_name
     and new.account_type is not distinct from old.account_type
     and new.account_number is not distinct from old.account_number
     and new.account_holder is not distinct from old.account_holder then
    return new;
  end if;

  if exists (
    select 1
    from public.payments p
    where p.creator_id = old.creator_id
      and p.status in ('approved', 'on_hold', 'scheduled')
  ) then
    raise exception 'payout_profile_locked_by_active_payment' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists creator_payout_profile_change_guard
on public.creator_payout_profiles;

create trigger creator_payout_profile_change_guard
before update or delete on public.creator_payout_profiles
for each row execute function public.guard_creator_payout_profile_change();
