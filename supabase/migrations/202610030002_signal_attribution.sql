-- P3-01: SIGNAL attribution — from a Creator's post to reservations and visits.
--
-- * Every booking gets a tracking link /r/<code>. The code doubles as a
--   short "PR code" that guests can mention when they reserve or visit.
-- * The public landing page records only counts: page views and taps on the
--   reservation / call buttons. No cookies, IP addresses, user agents or
--   other visitor identifiers are stored.
-- * Reservations and visits are recorded by the Restaurant when a guest
--   gives the PR code (phone, reservation note or at the table). Optional
--   party size and spend make ROI measurable without collecting guest data.
-- * Raw events are kept for 13 months (purge_expired_signal_events).

-- ---------------------------------------------------------------------------
-- Restaurant reservation contact shown on the landing page
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists phone text
    check (phone is null or phone ~ '^\+?[0-9][0-9-]{6,18}[0-9]$'),
  add column if not exists reservation_url text
    check (
      reservation_url is null
      or (reservation_url ~ '^https://[^[:space:]]+\.[^[:space:]]+$' and char_length(reservation_url) <= 500)
    );

create or replace function public.update_restaurant_contact(
  p_restaurant_id uuid,
  p_phone text,
  p_reservation_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[[:space:]]', '', 'g'), '');
  v_url text := nullif(trim(coalesce(p_reservation_url, '')), '');
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not (public.is_restaurant_member(p_restaurant_id) or public.is_admin()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9-]{6,18}[0-9]$' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;

  if v_url is not null and (
    v_url !~ '^https://[^[:space:]]+\.[^[:space:]]+$' or char_length(v_url) > 500
  ) then
    raise exception 'invalid_reservation_url' using errcode = 'P0001';
  end if;

  update public.restaurants
  set phone = v_phone,
      reservation_url = v_url
  where id = p_restaurant_id;
end;
$$;

revoke all on function public.update_restaurant_contact(uuid, text, text) from public;
grant execute on function public.update_restaurant_contact(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tracking links
-- ---------------------------------------------------------------------------

create table public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index tracking_links_restaurant_idx on public.tracking_links(restaurant_id);
create index tracking_links_creator_idx on public.tracking_links(creator_id);

alter table public.tracking_links enable row level security;

create policy "tracking links readable by parties"
on public.tracking_links for select
using (
  public.is_restaurant_member(restaurant_id)
  or exists (
    select 1
    from public.creator_profiles cp
    where cp.id = creator_id
      and cp.user_id = auth.uid()
  )
  or public.is_admin()
);

-- 8 characters without look-alikes (no I, O, 0, 1): easy to read out loud.
create or replace function public.generate_signal_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- Fully random bytes of a v4 UUID (bytes 6 and 8 carry version bits).
  v_positions constant integer[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_positions[i]) % 32) + 1, 1);
    end loop;

    exit when not exists (
      select 1 from public.tracking_links tl where tl.code = v_code
    );
  end loop;

  return v_code;
end;
$$;

revoke all on function public.generate_signal_code() from public;
revoke all on function public.generate_signal_code() from anon, authenticated;

create or replace function public.create_tracking_link_for_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tracking_links (
    code,
    booking_id,
    campaign_id,
    restaurant_id,
    creator_id
  )
  select
    public.generate_signal_code(),
    new.id,
    c.id,
    c.restaurant_id,
    new.creator_id
  from public.campaigns c
  where c.id = new.campaign_id
  on conflict (booking_id) do nothing;

  return new;
end;
$$;

create trigger bookings_create_tracking_link
after insert on public.bookings
for each row execute function public.create_tracking_link_for_booking();

-- Cancelled bookings stop collecting signals.
create or replace function public.disable_tracking_link_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.tracking_links
    set disabled_at = coalesce(disabled_at, now())
    where booking_id = new.id;
  end if;

  return new;
end;
$$;

create trigger bookings_disable_tracking_link
after update of status on public.bookings
for each row execute function public.disable_tracking_link_on_cancel();

-- Backfill links for bookings that already exist.
insert into public.tracking_links (code, booking_id, campaign_id, restaurant_id, creator_id)
select
  public.generate_signal_code(),
  b.id,
  b.campaign_id,
  c.restaurant_id,
  b.creator_id
from public.bookings b
join public.campaigns c on c.id = b.campaign_id
where not exists (
  select 1 from public.tracking_links tl where tl.booking_id = b.id
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.signal_events (
  id uuid primary key default gen_random_uuid(),
  tracking_link_id uuid not null references public.tracking_links(id) on delete cascade,
  kind text not null check (
    kind in ('landing_view', 'reserve_click', 'call_click', 'reservation', 'visit')
  ),
  occurred_at timestamptz not null default now(),
  party_size integer check (party_size is null or party_size between 1 and 50),
  revenue_yen integer check (revenue_yen is null or revenue_yen between 0 and 10000000),
  recorded_by uuid references public.users(id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    kind in ('reservation', 'visit')
    or (party_size is null and revenue_yen is null and recorded_by is null)
  ),
  check (kind = 'visit' or revenue_yen is null)
);

create index signal_events_link_kind_idx
  on public.signal_events(tracking_link_id, kind, occurred_at desc);
create index signal_events_created_idx
  on public.signal_events(created_at);

alter table public.signal_events enable row level security;

-- Only the Restaurant (and Operator) sees raw events, including spend.
-- Creators get aggregate counts via creator_signal_summary().
create policy "signal events readable by restaurant"
on public.signal_events for select
using (
  exists (
    select 1
    from public.tracking_links tl
    where tl.id = tracking_link_id
      and (public.is_restaurant_member(tl.restaurant_id) or public.is_admin())
  )
);

create or replace function public.normalize_signal_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Public, read-only data for the landing page. Returns no row for unknown or
-- disabled links.
create or replace function public.get_signal_landing(p_code text)
returns table (
  code text,
  restaurant_name text,
  area text,
  address text,
  phone text,
  reservation_url text,
  category text,
  creator_name text,
  post_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tl.code,
    r.name,
    r.area,
    r.address,
    r.phone,
    r.reservation_url,
    c.category,
    cp.display_name,
    (
      select d.submitted_url
      from public.deliverables d
      where d.booking_id = tl.booking_id
        and d.verification_status = 'approved'
        and d.submitted_url is not null
      order by d.submitted_at desc nulls last
      limit 1
    )
  from public.tracking_links tl
  join public.restaurants r on r.id = tl.restaurant_id
  join public.campaigns c on c.id = tl.campaign_id
  join public.creator_profiles cp on cp.id = tl.creator_id
  where tl.code = public.normalize_signal_code(p_code)
    and tl.disabled_at is null
    and r.status = 'active';
$$;

revoke all on function public.get_signal_landing(text) from public;
grant execute on function public.get_signal_landing(text) to anon, authenticated;

-- Anonymous touch events from the landing page. Throttled per link so that a
-- runaway client or bot cannot flood the table.
create or replace function public.record_signal_touch(p_code text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_recent integer;
begin
  if p_kind not in ('landing_view', 'reserve_click', 'call_click') then
    raise exception 'invalid_signal_kind' using errcode = 'P0001';
  end if;

  select tl.id
    into v_link_id
  from public.tracking_links tl
  join public.restaurants r on r.id = tl.restaurant_id
  where tl.code = public.normalize_signal_code(p_code)
    and tl.disabled_at is null
    and r.status = 'active';

  if v_link_id is null then
    return false;
  end if;

  select count(*)
    into v_recent
  from public.signal_events e
  where e.tracking_link_id = v_link_id
    and e.kind = p_kind
    and e.occurred_at > now() - interval '1 minute';

  if v_recent >= 30 then
    return false;
  end if;

  insert into public.signal_events (tracking_link_id, kind)
  values (v_link_id, p_kind);

  return true;
end;
$$;

revoke all on function public.record_signal_touch(text, text) from public;
grant execute on function public.record_signal_touch(text, text) to anon, authenticated;

-- Restaurant records a reservation or visit for a guest who gave a PR code.
create or replace function public.record_signal_conversion(
  p_code text,
  p_kind text,
  p_party_size integer default null,
  p_revenue_yen integer default null,
  p_occurred_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.tracking_links%rowtype;
  v_occurred_at timestamptz;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_kind not in ('reservation', 'visit') then
    raise exception 'invalid_signal_kind' using errcode = 'P0001';
  end if;

  select *
    into v_link
  from public.tracking_links tl
  where tl.code = public.normalize_signal_code(p_code);

  -- Unknown codes and other Restaurants' codes look the same to the caller.
  if not found
     or not (public.is_restaurant_member(v_link.restaurant_id) or public.is_admin()) then
    raise exception 'signal_code_not_found' using errcode = 'P0002';
  end if;

  if p_party_size is not null and (p_party_size < 1 or p_party_size > 50) then
    raise exception 'invalid_party_size' using errcode = 'P0001';
  end if;

  if p_revenue_yen is not null and (p_revenue_yen < 0 or p_revenue_yen > 10000000) then
    raise exception 'invalid_revenue' using errcode = 'P0001';
  end if;

  if p_kind = 'reservation' and p_revenue_yen is not null then
    raise exception 'revenue_only_for_visits' using errcode = 'P0001';
  end if;

  if p_occurred_on is null then
    v_occurred_at := now();
  else
    if p_occurred_on > (now() at time zone 'Asia/Tokyo')::date
       or p_occurred_on < (now() at time zone 'Asia/Tokyo')::date - 60 then
      raise exception 'invalid_signal_date' using errcode = 'P0001';
    end if;
    -- Noon in Tokyo keeps the event on the chosen local date.
    v_occurred_at := (p_occurred_on + time '12:00') at time zone 'Asia/Tokyo';
  end if;

  insert into public.signal_events (
    tracking_link_id,
    kind,
    occurred_at,
    party_size,
    revenue_yen,
    recorded_by
  )
  values (
    v_link.id,
    p_kind,
    v_occurred_at,
    p_party_size,
    p_revenue_yen,
    auth.uid()
  )
  returning id into v_event_id;

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_json
  )
  values (
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'signal.' || p_kind || '_recorded',
    'signal_event',
    v_event_id,
    jsonb_build_object(
      'tracking_link_id', v_link.id,
      'party_size', p_party_size,
      'revenue_yen', p_revenue_yen
    )
  );

  return v_event_id;
end;
$$;

revoke all on function public.record_signal_conversion(text, text, integer, integer, date) from public;
grant execute on function public.record_signal_conversion(text, text, integer, integer, date) to authenticated;

create or replace function public.void_signal_conversion(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.signal_events%rowtype;
  v_restaurant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_event
  from public.signal_events
  where id = p_event_id
  for update;

  if found then
    select tl.restaurant_id
      into v_restaurant_id
    from public.tracking_links tl
    where tl.id = v_event.tracking_link_id;
  end if;

  if not found
     or v_event.kind not in ('reservation', 'visit')
     or not (public.is_restaurant_member(v_restaurant_id) or public.is_admin()) then
    raise exception 'signal_event_not_found' using errcode = 'P0002';
  end if;

  if v_event.voided_at is not null then
    return;
  end if;

  update public.signal_events
  set voided_at = now()
  where id = p_event_id;

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id
  )
  values (
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'signal.conversion_voided',
    'signal_event',
    p_event_id
  );
end;
$$;

revoke all on function public.void_signal_conversion(uuid) from public;
grant execute on function public.void_signal_conversion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Aggregates
-- ---------------------------------------------------------------------------

-- Per tracking link for the Restaurants the caller belongs to (all for the
-- Operator). cost_yen is what the Restaurant owes the Creator (reward +
-- usage fee); failed payments are excluded.
create or replace function public.restaurant_signal_summary(p_since timestamptz default null)
returns table (
  tracking_link_id uuid,
  code text,
  booking_id uuid,
  restaurant_id uuid,
  campaign_id uuid,
  campaign_title text,
  creator_name text,
  visit_starts_at timestamptz,
  disabled boolean,
  cost_yen integer,
  landing_views integer,
  reserve_clicks integer,
  call_clicks integer,
  reservations integer,
  visits integer,
  visit_guests integer,
  revenue_yen bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tl.id,
    tl.code,
    tl.booking_id,
    tl.restaurant_id,
    tl.campaign_id,
    c.title,
    cp.display_name,
    s.starts_at,
    tl.disabled_at is not null,
    coalesce(
      (select p.amount from public.payments p
       where p.booking_id = tl.booking_id and p.status <> 'failed'),
      0
    ),
    count(e.id) filter (where e.kind = 'landing_view')::integer,
    count(e.id) filter (where e.kind = 'reserve_click')::integer,
    count(e.id) filter (where e.kind = 'call_click')::integer,
    count(e.id) filter (where e.kind = 'reservation')::integer,
    count(e.id) filter (where e.kind = 'visit')::integer,
    coalesce(sum(coalesce(e.party_size, 1)) filter (where e.kind = 'visit'), 0)::integer,
    coalesce(sum(e.revenue_yen) filter (where e.kind = 'visit'), 0)::bigint
  from public.tracking_links tl
  join public.campaigns c on c.id = tl.campaign_id
  join public.creator_profiles cp on cp.id = tl.creator_id
  join public.bookings b on b.id = tl.booking_id
  join public.campaign_slots s on s.id = b.campaign_slot_id
  left join public.signal_events e
    on e.tracking_link_id = tl.id
   and e.voided_at is null
   and (p_since is null or e.occurred_at >= p_since)
  where auth.uid() is not null
    and (public.is_restaurant_member(tl.restaurant_id) or public.is_admin())
  group by tl.id, c.title, cp.display_name, s.starts_at;
$$;

revoke all on function public.restaurant_signal_summary(timestamptz) from public;
grant execute on function public.restaurant_signal_summary(timestamptz) to authenticated;

-- Counts for the Creator's own booking. Spend is the Restaurant's data and
-- is not exposed here.
create or replace function public.creator_signal_summary(p_booking_id uuid)
returns table (
  code text,
  landing_views integer,
  reserve_clicks integer,
  call_clicks integer,
  reservations integer,
  visits integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tl.code,
    count(e.id) filter (where e.kind = 'landing_view')::integer,
    count(e.id) filter (where e.kind = 'reserve_click')::integer,
    count(e.id) filter (where e.kind = 'call_click')::integer,
    count(e.id) filter (where e.kind = 'reservation')::integer,
    count(e.id) filter (where e.kind = 'visit')::integer
  from public.tracking_links tl
  join public.creator_profiles cp on cp.id = tl.creator_id
  left join public.signal_events e
    on e.tracking_link_id = tl.id
   and e.voided_at is null
  where tl.booking_id = p_booking_id
    and tl.disabled_at is null
    and (cp.user_id = auth.uid() or public.is_admin())
  group by tl.id;
$$;

revoke all on function public.creator_signal_summary(uuid) from public;
grant execute on function public.creator_signal_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

create or replace function public.purge_expired_signal_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.signal_events
  where created_at < now() - interval '13 months';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_signal_events() from public;
revoke all on function public.purge_expired_signal_events() from anon, authenticated;
grant execute on function public.purge_expired_signal_events() to service_role;
