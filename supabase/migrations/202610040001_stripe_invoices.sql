-- Monthly platform-fee invoices through Stripe Invoicing.
--
-- * Only the platform fee goes through Stripe. Creator rewards stay a
--   direct Restaurant → Creator payment; the platform never holds them.
-- * The Operator (or Claude, `npm run ops -- invoice YYYY-MM`) creates one
--   invoice per Restaurant per month from its pending fees. Stripe emails it
--   and takes card or bank transfer; its webhook marks the fees paid.
-- * Fees are quoted before tax; 10% consumption tax is added on the invoice.

alter table public.restaurants
  add column if not exists billing_email text
    check (billing_email is null or billing_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column if not exists stripe_customer_id text unique;

create table public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  stripe_invoice_id text not null unique,
  hosted_invoice_url text check (hosted_invoice_url is null or hosted_invoice_url ~ '^https://'),
  subtotal integer not null check (subtotal >= 0),
  tax integer not null check (tax >= 0),
  total integer not null check (total = subtotal + tax),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- One live invoice per Restaurant and month; a voided one can be replaced.
create unique index platform_invoices_one_per_period
  on public.platform_invoices(restaurant_id, period)
  where status <> 'void';

alter table public.platform_invoices enable row level security;

create policy "invoices visible to the restaurant and operator"
on public.platform_invoices for select
using (public.is_restaurant_member(restaurant_id) or public.is_admin());

alter table public.platform_fees
  add column if not exists invoice_id uuid references public.platform_invoices(id) on delete set null;

-- Restaurant: where Stripe sends the invoice.
create or replace function public.set_restaurant_billing_email(p_restaurant_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_restaurant_member(p_restaurant_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_billing_email' using errcode = 'P0001';
  end if;

  update public.restaurants set billing_email = v_email where id = p_restaurant_id;
end;
$$;

revoke all on function public.set_restaurant_billing_email(uuid, text) from public;
grant execute on function public.set_restaurant_billing_email(uuid, text) to authenticated;

-- Service role (billing script): remember the Stripe customer.
create or replace function public.set_restaurant_stripe_customer(p_restaurant_id uuid, p_customer_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_customer_id !~ '^cus_[A-Za-z0-9]+$' then
    raise exception 'invalid_stripe_customer' using errcode = 'P0001';
  end if;

  update public.restaurants set stripe_customer_id = p_customer_id where id = p_restaurant_id;
end;
$$;

revoke all on function public.set_restaurant_stripe_customer(uuid, text) from public;
grant execute on function public.set_restaurant_stripe_customer(uuid, text) to authenticated, service_role;

-- Service role: an invoice was sent for these pending fees. All or nothing.
create or replace function public.record_platform_invoice(
  p_restaurant_id uuid,
  p_period text,
  p_fee_ids uuid[],
  p_stripe_invoice_id text,
  p_hosted_invoice_url text,
  p_subtotal integer,
  p_tax integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_sum integer;
  v_count integer;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_stripe_invoice_id !~ '^in_[A-Za-z0-9]+$' then
    raise exception 'invalid_stripe_invoice' using errcode = 'P0001';
  end if;

  perform 1 from public.platform_fees where id = any(p_fee_ids) for update;

  select coalesce(sum(fee), 0), count(*)
    into v_sum, v_count
  from public.platform_fees
  where id = any(p_fee_ids)
    and restaurant_id = p_restaurant_id
    and status = 'pending'
    and invoice_id is null;

  -- The Stripe invoice must match exactly what the app says is owed.
  if v_count <> coalesce(array_length(p_fee_ids, 1), 0) or v_count = 0 or v_sum <> p_subtotal then
    raise exception 'invoice_fees_mismatch' using errcode = 'P0001';
  end if;

  insert into public.platform_invoices (
    restaurant_id, period, stripe_invoice_id, hosted_invoice_url, subtotal, tax, total
  )
  values (
    p_restaurant_id, p_period, p_stripe_invoice_id, p_hosted_invoice_url,
    p_subtotal, p_tax, p_subtotal + p_tax
  )
  returning id into v_invoice_id;

  update public.platform_fees
  set status = 'invoiced', invoice_id = v_invoice_id,
      invoiced_at = now(), updated_at = now()
  where id = any(p_fee_ids);

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (auth.uid(), null, 'platform_invoice.sent', 'platform_invoice', v_invoice_id,
          jsonb_build_object('stripe_invoice_id', p_stripe_invoice_id, 'period', p_period,
                             'subtotal', p_subtotal, 'tax', p_tax, 'fees', v_count));

  return v_invoice_id;
end;
$$;

revoke all on function public.record_platform_invoice(uuid, text, uuid[], text, text, integer, integer) from public;
grant execute on function public.record_platform_invoice(uuid, text, uuid[], text, text, integer, integer) to authenticated, service_role;

-- Service role (Stripe webhook): invoice paid or voided. Idempotent.
create or replace function public.apply_stripe_invoice_event(p_stripe_invoice_id text, p_event text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.platform_invoices%rowtype;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_invoice from public.platform_invoices
  where stripe_invoice_id = p_stripe_invoice_id
  for update;

  if not found then
    return 'unknown_invoice';
  end if;

  if p_event = 'paid' then
    if v_invoice.status = 'paid' then
      return 'already_paid';
    end if;
    update public.platform_invoices set status = 'paid', paid_at = now() where id = v_invoice.id;
    update public.platform_fees
    set status = 'paid', paid_at = now(), updated_at = now()
    where invoice_id = v_invoice.id;
    return 'paid';
  elsif p_event = 'void' then
    if v_invoice.status <> 'open' then
      return 'ignored';
    end if;
    -- The fees go back to pending so the next run can invoice them again.
    update public.platform_invoices set status = 'void' where id = v_invoice.id;
    update public.platform_fees
    set status = 'pending', invoice_id = null, invoiced_at = null, updated_at = now()
    where invoice_id = v_invoice.id;
    return 'void';
  end if;

  raise exception 'invalid_invoice_event' using errcode = 'P0001';
end;
$$;

revoke all on function public.apply_stripe_invoice_event(text, text) from public;
grant execute on function public.apply_stripe_invoice_event(text, text) to authenticated, service_role;
