-- Platform fee (decided 2026-10-03).
--
-- * No setup or monthly fee. A fee is due only when a PR is completed: when
--   the Creator's payment becomes approved (every deliverable approved).
-- * Fee = 20% of what the Restaurant pays the Creator (reward + usage
--   fee), at least ¥2,000. The Creator always receives the full amount.
-- * Each Restaurant's first completed PR is free (waived).
-- * Fees are invoiced to the Restaurant monthly by the Operator, outside
--   the app. The app records the status only.

create or replace function public.platform_fee_for(p_amount integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_amount, 0) <= 0 then 0
    else greatest(round(p_amount * 0.2)::integer, 2000)
  end;
$$;

grant execute on function public.platform_fee_for(integer) to anon, authenticated, service_role;

create table public.platform_fees (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  base_amount integer not null check (base_amount >= 0),
  fee integer not null check (fee >= 0),
  status text not null default 'pending' check (status in ('pending', 'invoiced', 'paid', 'waived')),
  note text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_fees_restaurant_idx on public.platform_fees(restaurant_id, created_at desc);
create index platform_fees_status_idx on public.platform_fees(status, created_at);

alter table public.platform_fees enable row level security;

create policy "fees visible to the restaurant and operator"
on public.platform_fees for select
using (public.is_restaurant_member(restaurant_id) or public.is_admin());

-- Record the fee when the PR completes. Idempotent per booking.
create or replace function public.record_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
  v_first boolean;
begin
  if new.status <> 'approved' or old.status is not distinct from new.status then
    return new;
  end if;

  select c.restaurant_id into v_restaurant_id
  from public.bookings b
  join public.campaigns c on c.id = b.campaign_id
  where b.id = new.booking_id;

  if v_restaurant_id is null then
    return new;
  end if;

  v_first := not exists (
    select 1 from public.platform_fees f where f.restaurant_id = v_restaurant_id
  );

  insert into public.platform_fees (booking_id, restaurant_id, base_amount, fee, status, note)
  values (
    new.booking_id,
    v_restaurant_id,
    new.amount,
    case when v_first then 0 else public.platform_fee_for(new.amount) end,
    case when v_first then 'waived' else 'pending' end,
    case when v_first then '初回のPRは手数料無料' end
  )
  on conflict (booking_id) do nothing;

  return new;
end;
$$;

revoke all on function public.record_platform_fee() from public;

drop trigger if exists payments_record_platform_fee on public.payments;
create trigger payments_record_platform_fee
after update of status on public.payments
for each row execute function public.record_platform_fee();

-- PRs completed before this migration: record them the same way (the
-- earliest per Restaurant is the free one).
insert into public.platform_fees (booking_id, restaurant_id, base_amount, fee, status, note)
select
  done.booking_id,
  done.restaurant_id,
  done.amount,
  case when done.n = 1 then 0 else public.platform_fee_for(done.amount) end,
  case when done.n = 1 then 'waived' else 'pending' end,
  case when done.n = 1 then '初回のPRは手数料無料' end
from (
  select
    p.booking_id,
    c.restaurant_id,
    p.amount,
    row_number() over (partition by c.restaurant_id order by p.updated_at, p.id) as n
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.campaigns c on c.id = b.campaign_id
  where p.status in ('approved', 'scheduled', 'paid')
) done
on conflict (booking_id) do nothing;

-- Operator / Claude (経理): move fees through invoiced → paid.
create or replace function public.set_platform_fee_status(p_fee_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status not in ('invoiced', 'paid') then
    raise exception 'invalid_fee_status' using errcode = 'P0001';
  end if;

  update public.platform_fees
  set status = p_status,
      invoiced_at = coalesce(invoiced_at, now()),
      paid_at = case when p_status = 'paid' then now() else paid_at end,
      updated_at = now()
  where id = any(p_fee_ids)
    and status <> 'waived'
    and (
      (p_status = 'invoiced' and status = 'pending')
      or (p_status = 'paid' and status in ('pending', 'invoiced'))
    );

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else null end,
    'platform_fee.' || p_status,
    'platform_fee',
    null,
    jsonb_build_object('ids', p_fee_ids, 'updated', v_count)
  );

  return v_count;
end;
$$;

revoke all on function public.set_platform_fee_status(uuid[], text) from public;
grant execute on function public.set_platform_fee_status(uuid[], text) to authenticated, service_role;
