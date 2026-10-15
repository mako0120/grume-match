-- Manual payout destination for the paid PR alpha.
-- Restaurant users must never receive access to these fields.

create table public.creator_payout_profiles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  bank_name text not null,
  branch_name text not null,
  account_type text not null check (account_type in ('ordinary', 'current')),
  account_number text not null,
  account_holder text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_payout_profiles enable row level security;

create policy "creator payout owner read"
on public.creator_payout_profiles for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id
      and cp.user_id = auth.uid()
  )
);

create or replace function public.save_creator_payout_profile(
  p_bank_name text,
  p_branch_name text,
  p_account_type text,
  p_account_number text,
  p_account_holder text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if nullif(trim(p_bank_name), '') is null
     or nullif(trim(p_branch_name), '') is null
     or nullif(trim(p_account_number), '') is null
     or nullif(trim(p_account_holder), '') is null then
    raise exception 'payout_fields_required' using errcode = 'P0001';
  end if;

  if p_account_type not in ('ordinary', 'current') then
    raise exception 'invalid_account_type' using errcode = 'P0001';
  end if;

  if p_account_number !~ '^[0-9]{4,8}$' then
    raise exception 'invalid_account_number' using errcode = 'P0001';
  end if;

  select cp.id into v_creator_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.user_id = auth.uid()
    and u.status = 'active';

  if v_creator_id is null then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  insert into public.creator_payout_profiles(
    creator_id,
    bank_name,
    branch_name,
    account_type,
    account_number,
    account_holder
  )
  values(
    v_creator_id,
    trim(p_bank_name),
    trim(p_branch_name),
    p_account_type,
    trim(p_account_number),
    trim(p_account_holder)
  )
  on conflict (creator_id) do update
  set
    bank_name = excluded.bank_name,
    branch_name = excluded.branch_name,
    account_type = excluded.account_type,
    account_number = excluded.account_number,
    account_holder = excluded.account_holder,
    updated_at = now()
  returning id into v_profile_id;

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
    'creator.payout_profile_saved',
    'creator_payout_profile',
    v_profile_id,
    jsonb_build_object(
      'bank_name', trim(p_bank_name),
      'branch_name', trim(p_branch_name),
      'account_number_last4', right(trim(p_account_number), 4)
    )
  );

  return v_profile_id;
end;
$$;

revoke all on function public.save_creator_payout_profile(text, text, text, text, text)
from public;

grant execute on function public.save_creator_payout_profile(text, text, text, text, text)
to authenticated;
