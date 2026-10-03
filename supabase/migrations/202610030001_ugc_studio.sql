-- P2-03: UGC STUDIO and structured content usage rights.
--
-- * Restaurants state up front how they may reuse a Creator's content:
--   scope (organic SNS/Web only, or organic + paid ads), a fixed term of
--   30/90/365 days and an additional fee. Perpetual or unlimited reuse is not
--   representable.
-- * The terms are snapshotted per booking into content_usage_licenses. The
--   fee is added to the Creator's payment. The license term starts when every
--   deliverable of the booking is approved.
-- * UGC photo/video deliverables are delivered as files in the private
--   `ugc-assets` Storage bucket instead of a post URL. Restaurants can open
--   the files while reviewing and while the license is active, never after it
--   expires.

-- ---------------------------------------------------------------------------
-- Campaign-level usage terms
-- ---------------------------------------------------------------------------

create table public.campaign_usage_rights (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  usage_scope text not null check (usage_scope in ('organic', 'organic_and_ads')),
  duration_days integer not null check (duration_days in (30, 90, 365)),
  fee integer not null default 0 check (fee >= 0 and fee <= 1000000),
  created_at timestamptz not null default now(),
  -- Paid advertising use is always paid for separately.
  check (usage_scope <> 'organic_and_ads' or fee > 0)
);

alter table public.campaign_usage_rights enable row level security;

create policy "usage rights readable with campaign"
on public.campaign_usage_rights for select
using (public.can_view_campaign(campaign_id));

-- Terms a Creator applied to cannot change afterwards.
create or replace function public.lock_campaign_usage_rights_after_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := case
    when tg_op = 'DELETE' then old.campaign_id
    else new.campaign_id
  end;

  if public.campaign_has_applications(v_campaign_id) then
    raise exception 'campaign_usage_rights_locked_after_application' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger campaign_usage_rights_lock_after_application
before insert or update or delete on public.campaign_usage_rights
for each row execute function public.lock_campaign_usage_rights_after_application();

-- A UGC deliverable without usage terms would hand files over with no
-- defined rights. Checked at commit so that creation RPCs can insert the
-- platforms first and the terms second inside one transaction.
create or replace function public.require_usage_rights_for_ugc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform in ('ugc_photo', 'ugc_video')
     and not exists (
       select 1
       from public.campaign_usage_rights ur
       where ur.campaign_id = new.campaign_id
     ) then
    raise exception 'usage_rights_required_for_ugc' using errcode = 'P0001';
  end if;

  return null;
end;
$$;

create constraint trigger campaign_platforms_require_usage_rights
after insert or update on public.campaign_platforms
deferrable initially deferred
for each row execute function public.require_usage_rights_for_ugc();

-- Internal helper used by the creation RPCs. Not callable by clients.
create or replace function public.apply_campaign_usage_rights(
  p_campaign_id uuid,
  p_usage_rights jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text;
  v_duration integer;
  v_fee integer;
begin
  if p_usage_rights is null or p_usage_rights = 'null'::jsonb then
    return;
  end if;

  v_scope := p_usage_rights ->> 'scope';
  begin
    v_duration := (p_usage_rights ->> 'duration_days')::integer;
    v_fee := coalesce((p_usage_rights ->> 'fee')::integer, 0);
  exception when others then
    raise exception 'invalid_usage_rights' using errcode = 'P0001';
  end;

  if v_scope is null
     or v_scope not in ('organic', 'organic_and_ads')
     or v_duration is null
     or v_duration not in (30, 90, 365)
     or v_fee < 0
     or v_fee > 1000000 then
    raise exception 'invalid_usage_rights' using errcode = 'P0001';
  end if;

  if v_scope = 'organic_and_ads' and v_fee = 0 then
    raise exception 'ads_usage_requires_fee' using errcode = 'P0001';
  end if;

  insert into public.campaign_usage_rights (
    campaign_id,
    usage_scope,
    duration_days,
    fee
  )
  values (
    p_campaign_id,
    v_scope,
    v_duration,
    v_fee
  );
end;
$$;

revoke all on function public.apply_campaign_usage_rights(uuid, jsonb) from public;
revoke all on function public.apply_campaign_usage_rights(uuid, jsonb) from anon, authenticated;

-- Extend MARKET campaign creation with optional usage terms. The previous
-- implementation is kept as an internal building block.
alter function public.create_campaign_with_slots(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb
) rename to create_campaign_with_slots_base;

revoke all on function public.create_campaign_with_slots_base(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb
) from public;
revoke all on function public.create_campaign_with_slots_base(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb
) from anon, authenticated;

create or replace function public.create_campaign_with_slots(
  p_restaurant_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_area text,
  p_cash_reward integer,
  p_reward_tax_mode public.reward_tax_mode,
  p_food_offer text,
  p_max_companions integer,
  p_creator_slots integer,
  p_visit_period_start date,
  p_visit_period_end date,
  p_application_deadline timestamptz,
  p_platforms text[],
  p_slots jsonb,
  p_usage_rights jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := public.create_campaign_with_slots_base(
    p_restaurant_id,
    p_title,
    p_description,
    p_category,
    p_area,
    p_cash_reward,
    p_reward_tax_mode,
    p_food_offer,
    p_max_companions,
    p_creator_slots,
    p_visit_period_start,
    p_visit_period_end,
    p_application_deadline,
    p_platforms,
    p_slots
  );

  perform public.apply_campaign_usage_rights(v_campaign_id, p_usage_rights);

  return v_campaign_id;
end;
$$;

revoke all on function public.create_campaign_with_slots(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb, jsonb
) from public;
grant execute on function public.create_campaign_with_slots(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb, jsonb
) to authenticated;

-- Same for Direct OFFER.
alter function public.create_direct_offer_with_slots(
  uuid, uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, date, date, timestamptz, text[], jsonb
) rename to create_direct_offer_with_slots_base;

revoke all on function public.create_direct_offer_with_slots_base(
  uuid, uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, date, date, timestamptz, text[], jsonb
) from public;
revoke all on function public.create_direct_offer_with_slots_base(
  uuid, uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, date, date, timestamptz, text[], jsonb
) from anon, authenticated;

create or replace function public.create_direct_offer_with_slots(
  p_restaurant_id uuid,
  p_creator_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_area text,
  p_cash_reward integer,
  p_reward_tax_mode public.reward_tax_mode,
  p_food_offer text,
  p_max_companions integer,
  p_visit_period_start date,
  p_visit_period_end date,
  p_application_deadline timestamptz,
  p_platforms text[],
  p_slots jsonb,
  p_usage_rights jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := public.create_direct_offer_with_slots_base(
    p_restaurant_id,
    p_creator_id,
    p_title,
    p_description,
    p_category,
    p_area,
    p_cash_reward,
    p_reward_tax_mode,
    p_food_offer,
    p_max_companions,
    p_visit_period_start,
    p_visit_period_end,
    p_application_deadline,
    p_platforms,
    p_slots
  );

  perform public.apply_campaign_usage_rights(v_campaign_id, p_usage_rights);

  return v_campaign_id;
end;
$$;

revoke all on function public.create_direct_offer_with_slots(
  uuid, uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, date, date, timestamptz, text[], jsonb, jsonb
) from public;
grant execute on function public.create_direct_offer_with_slots(
  uuid, uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, date, date, timestamptz, text[], jsonb, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-booking license snapshot
-- ---------------------------------------------------------------------------

create table public.content_usage_licenses (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  usage_scope text not null check (usage_scope in ('organic', 'organic_and_ads')),
  duration_days integer not null check (duration_days in (30, 90, 365)),
  fee integer not null check (fee >= 0),
  status text not null default 'pending' check (status in ('pending', 'active')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and starts_at is null and expires_at is null)
    or
    (status = 'active' and starts_at is not null and expires_at > starts_at)
  )
);

create index content_usage_licenses_restaurant_idx
  on public.content_usage_licenses(restaurant_id, status, expires_at);
create index content_usage_licenses_creator_idx
  on public.content_usage_licenses(creator_id);

alter table public.content_usage_licenses enable row level security;

create policy "usage licenses readable by parties"
on public.content_usage_licenses for select
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

create or replace function public.snapshot_usage_license_for_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.content_usage_licenses (
    booking_id,
    campaign_id,
    restaurant_id,
    creator_id,
    usage_scope,
    duration_days,
    fee
  )
  select
    new.id,
    c.id,
    c.restaurant_id,
    new.creator_id,
    ur.usage_scope,
    ur.duration_days,
    ur.fee
  from public.campaigns c
  join public.campaign_usage_rights ur on ur.campaign_id = c.id
  where c.id = new.campaign_id;

  return new;
end;
$$;

create trigger bookings_snapshot_usage_license
after insert on public.bookings
for each row execute function public.snapshot_usage_license_for_booking();

-- The usage fee is part of what the Creator is owed for the booking.
create or replace function public.add_usage_fee_to_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee integer;
begin
  select l.fee
    into v_fee
  from public.content_usage_licenses l
  where l.booking_id = new.booking_id;

  new.amount := new.amount + coalesce(v_fee, 0);
  return new;
end;
$$;

create trigger payments_add_usage_fee
before insert on public.payments
for each row execute function public.add_usage_fee_to_payment();

-- ---------------------------------------------------------------------------
-- UGC files
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ugc-assets',
  'ugc-assets',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  created_at timestamptz not null default now()
);

create index content_assets_deliverable_idx
  on public.content_assets(deliverable_id);
create index content_assets_restaurant_idx
  on public.content_assets(restaurant_id, created_at desc);

alter table public.content_assets enable row level security;

create policy "content assets readable by parties"
on public.content_assets for select
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

create or replace function public.ugc_kind_for_platform(p_platform public.platform_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_platform
    when 'ugc_photo' then 'photo'
    when 'ugc_video' then 'video'
    else null
  end;
$$;

create or replace function public.ugc_mime_allowed(p_kind text, p_mime text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'photo' then p_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    when 'video' then p_mime in ('video/mp4', 'video/quicktime')
    else false
  end;
$$;

create or replace function public.ugc_max_bytes(p_kind text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'photo' then 15728640::bigint
    when 'video' then 52428800::bigint
    else 0::bigint
  end;
$$;

-- Deliverable that the current user may still upload files for, resolved
-- from a Storage object path `<auth uid>/<deliverable id>/<file>`.
create or replace function public.ugc_upload_target(p_object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_deliverable_id uuid;
begin
  if auth.uid() is null or p_object_name is null then
    return null;
  end if;

  v_parts := string_to_array(p_object_name, '/');

  if coalesce(array_length(v_parts, 1), 0) <> 3
     or v_parts[1] <> auth.uid()::text
     or v_parts[3] !~ '^[A-Za-z0-9_-]{1,80}\.[a-z0-9]{2,5}$' then
    return null;
  end if;

  begin
    v_deliverable_id := v_parts[2]::uuid;
  exception when others then
    return null;
  end;

  if not exists (
    select 1
    from public.deliverables d
    join public.bookings b on b.id = d.booking_id
    join public.creator_profiles cp on cp.id = b.creator_id
    join public.users u on u.id = cp.user_id
    where d.id = v_deliverable_id
      and d.platform in ('ugc_photo', 'ugc_video')
      and d.verification_status <> 'approved'
      and b.status in ('confirmed', 'visited')
      and cp.user_id = auth.uid()
      and u.status = 'active'
  ) then
    return null;
  end if;

  return v_deliverable_id;
end;
$$;

-- Whether the current user may read a UGC file.
create or replace function public.can_read_ugc_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    or (
      auth.uid() is not null
      and split_part(p_object_name, '/', 1) = auth.uid()::text
    )
    or exists (
      select 1
      from public.content_assets a
      join public.content_usage_licenses l on l.booking_id = a.booking_id
      where a.storage_path = p_object_name
        and public.is_restaurant_member(a.restaurant_id)
        and (
          l.status = 'pending'
          or (l.status = 'active' and l.expires_at > now())
        )
    );
$$;

create policy "ugc assets creator upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ugc-assets'
  and public.ugc_upload_target(name) is not null
);

create policy "ugc assets scoped read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ugc-assets'
  and public.can_read_ugc_object(name)
);

-- Creators may remove files that are not (or no longer) registered, or whose
-- deliverable has not been approved yet.
create policy "ugc assets creator delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ugc-assets'
  and split_part(name, '/', 1) = auth.uid()::text
  and not exists (
    select 1
    from public.content_assets a
    join public.deliverables d on d.id = a.deliverable_id
    where a.storage_path = objects.name
      and d.verification_status = 'approved'
  )
);

create or replace function public.register_content_asset(
  p_deliverable_id uuid,
  p_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.deliverables%rowtype;
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_kind text;
  v_mime text;
  v_size bigint;
  v_count integer;
  v_asset_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  v_kind := public.ugc_kind_for_platform(v_deliverable.platform);

  if v_kind is null then
    raise exception 'deliverable_not_ugc' using errcode = 'P0001';
  end if;

  if public.ugc_upload_target(p_storage_path) is distinct from p_deliverable_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::bigint
    into v_mime, v_size
  from storage.objects o
  where o.bucket_id = 'ugc-assets'
    and o.name = p_storage_path;

  if not found then
    raise exception 'upload_not_found' using errcode = 'P0002';
  end if;

  if not public.ugc_mime_allowed(v_kind, v_mime) then
    raise exception 'unsupported_file_type' using errcode = 'P0001';
  end if;

  if v_size is null or v_size <= 0 or v_size > public.ugc_max_bytes(v_kind) then
    raise exception 'file_too_large' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
  from public.content_assets a
  where a.deliverable_id = p_deliverable_id;

  if v_count >= 10 then
    raise exception 'too_many_assets' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = v_deliverable.booking_id;
  select * into v_campaign from public.campaigns where id = v_booking.campaign_id;

  insert into public.content_assets (
    deliverable_id,
    booking_id,
    creator_id,
    restaurant_id,
    kind,
    storage_path,
    mime_type,
    byte_size
  )
  values (
    v_deliverable.id,
    v_booking.id,
    v_booking.creator_id,
    v_campaign.restaurant_id,
    v_kind,
    p_storage_path,
    v_mime,
    v_size
  )
  on conflict (storage_path) do nothing
  returning id into v_asset_id;

  if v_asset_id is null then
    select a.id into v_asset_id
    from public.content_assets a
    where a.storage_path = p_storage_path;
  end if;

  return v_asset_id;
end;
$$;

revoke all on function public.register_content_asset(uuid, text) from public;
grant execute on function public.register_content_asset(uuid, text) to authenticated;

-- Returns the storage path so the caller can delete the file itself.
create or replace function public.remove_content_asset(p_asset_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.content_assets%rowtype;
  v_deliverable public.deliverables%rowtype;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_asset
  from public.content_assets
  where id = p_asset_id;

  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = v_asset.deliverable_id
  for update;

  select cp.user_id into v_owner
  from public.creator_profiles cp
  where cp.id = v_asset.creator_id;

  if v_owner is distinct from auth.uid() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_deliverable.verification_status = 'approved' then
    raise exception 'deliverable_already_approved' using errcode = 'P0001';
  end if;

  delete from public.content_assets where id = p_asset_id;

  -- Withdrawing the last file withdraws the submission.
  if v_deliverable.submitted_at is not null
     and not exists (
       select 1 from public.content_assets a
       where a.deliverable_id = v_deliverable.id
     ) then
    update public.deliverables
    set submitted_at = null,
        verification_status = 'pending'
    where id = v_deliverable.id;

    update public.applications a
    set status = 'scheduled'
    from public.bookings b
    where b.id = v_deliverable.booking_id
      and a.id = b.application_id
      and a.status = 'submitted';
  end if;

  return v_asset.storage_path;
end;
$$;

revoke all on function public.remove_content_asset(uuid) from public;
grant execute on function public.remove_content_asset(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Submission / review (a deliverable is submitted when submitted_at is set;
-- URL deliverables also carry submitted_url, UGC deliverables carry files)
-- ---------------------------------------------------------------------------

create or replace function public.mark_application_submitted_if_complete(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.deliverables d
    where d.booking_id = p_booking_id
      and d.submitted_at is null
  ) then
    update public.applications a
    set status = 'submitted'
    from public.bookings b
    where b.id = p_booking_id
      and a.id = b.application_id
      and a.status in ('scheduled', 'visited', 'submitted');
  end if;
end;
$$;

revoke all on function public.mark_application_submitted_if_complete(uuid) from public;
revoke all on function public.mark_application_submitted_if_complete(uuid) from anon, authenticated;

create or replace function public.submit_deliverable(
  p_deliverable_id uuid,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.deliverables%rowtype;
  v_booking public.bookings%rowtype;
  v_creator_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_url !~ '^https?://[^[:space:]]+$' then
    raise exception 'invalid_deliverable_url' using errcode = 'P0001';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  if public.ugc_kind_for_platform(v_deliverable.platform) is not null then
    raise exception 'deliverable_requires_upload' using errcode = 'P0001';
  end if;

  if v_deliverable.verification_status = 'approved' then
    raise exception 'deliverable_already_approved' using errcode = 'P0001';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_deliverable.booking_id
  for update;

  select cp.user_id
    into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'visited') then
    raise exception 'booking_not_submittable' using errcode = 'P0001';
  end if;

  update public.deliverables
  set
    submitted_url = p_url,
    submitted_at = now(),
    verification_status = 'pending',
    verification_note = null
  where id = p_deliverable_id;

  perform public.mark_application_submitted_if_complete(v_booking.id);

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
    case when public.is_admin() then 'admin'::public.user_role else 'creator'::public.user_role end,
    'deliverable.submitted',
    'deliverable',
    p_deliverable_id,
    jsonb_build_object('url', p_url)
  );
end;
$$;

revoke all on function public.submit_deliverable(uuid, text) from public;
grant execute on function public.submit_deliverable(uuid, text) to authenticated;

create or replace function public.submit_ugc_deliverable(p_deliverable_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.deliverables%rowtype;
  v_booking public.bookings%rowtype;
  v_creator_user_id uuid;
  v_asset_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  if public.ugc_kind_for_platform(v_deliverable.platform) is null then
    raise exception 'deliverable_not_ugc' using errcode = 'P0001';
  end if;

  if v_deliverable.verification_status = 'approved' then
    raise exception 'deliverable_already_approved' using errcode = 'P0001';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_deliverable.booking_id
  for update;

  select cp.user_id
    into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id <> auth.uid() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'visited') then
    raise exception 'booking_not_submittable' using errcode = 'P0001';
  end if;

  select count(*)
    into v_asset_count
  from public.content_assets a
  where a.deliverable_id = p_deliverable_id;

  if v_asset_count = 0 then
    raise exception 'ugc_files_required' using errcode = 'P0001';
  end if;

  update public.deliverables
  set
    submitted_at = now(),
    verification_status = 'pending',
    verification_note = null
  where id = p_deliverable_id;

  perform public.mark_application_submitted_if_complete(v_booking.id);

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
    'creator'::public.user_role,
    'deliverable.submitted',
    'deliverable',
    p_deliverable_id,
    jsonb_build_object('files', v_asset_count)
  );
end;
$$;

revoke all on function public.submit_ugc_deliverable(uuid) from public;
grant execute on function public.submit_ugc_deliverable(uuid) to authenticated;

create or replace function public.review_deliverable(
  p_deliverable_id uuid,
  p_approved boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.deliverables%rowtype;
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_payment_status public.payment_status;
  v_unapproved integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_deliverable
  from public.deliverables
  where id = p_deliverable_id
  for update;

  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  if v_deliverable.submitted_at is null then
    raise exception 'deliverable_not_submitted' using errcode = 'P0001';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_deliverable.booking_id
  for update;

  select *
    into v_campaign
  from public.campaigns
  where id = v_booking.campaign_id;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Repeating an already-approved approval is harmless.
  if v_deliverable.verification_status = 'approved' and p_approved then
    return;
  end if;

  select p.status
    into v_payment_status
  from public.payments p
  where p.booking_id = v_booking.id
  for update;

  if v_payment_status in ('approved', 'scheduled', 'paid') then
    raise exception 'deliverable_review_locked_after_payout_approval' using errcode = 'P0001';
  end if;

  update public.deliverables
  set
    verification_status = case
      when p_approved then 'approved'::public.verification_status
      else 'rejected'::public.verification_status
    end,
    verification_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_deliverable_id;

  if p_approved then
    select count(*)
      into v_unapproved
    from public.deliverables d
    where d.booking_id = v_booking.id
      and d.verification_status <> 'approved';

    if v_unapproved = 0 then
      update public.applications
      set status = 'approved'
      where id = v_booking.application_id;

      update public.payments
      set status = 'approved'
      where booking_id = v_booking.id
        and status = 'pending';

      -- The usage term starts once the content is accepted.
      update public.content_usage_licenses
      set
        status = 'active',
        starts_at = now(),
        expires_at = now() + make_interval(days => duration_days)
      where booking_id = v_booking.id
        and status = 'pending';
    end if;
  else
    update public.applications
    set status = 'submitted'
    where id = v_booking.application_id
      and status in ('submitted', 'approved');
  end if;

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
    case when p_approved then 'deliverable.approved' else 'deliverable.rejected' end,
    'deliverable',
    p_deliverable_id,
    jsonb_build_object(
      'approved', p_approved,
      'note', p_note
    )
  );
end;
$$;

revoke all on function public.review_deliverable(uuid, boolean, text) from public;
grant execute on function public.review_deliverable(uuid, boolean, text) to authenticated;

-- Notify the Restaurant for URL and file submissions alike.
create or replace function public.notify_deliverable_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_creator_name text;
  v_target_user_id uuid;
begin
  if new.submitted_at is null then
    return new;
  end if;

  if old.submitted_at is not distinct from new.submitted_at
     and old.submitted_url is not distinct from new.submitted_url then
    return new;
  end if;

  select *
    into v_booking
  from public.bookings b
  where b.id = new.booking_id;

  if not found then
    return new;
  end if;

  select *
    into v_campaign
  from public.campaigns c
  where c.id = v_booking.campaign_id;

  select cp.display_name
    into v_creator_name
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  select rm.user_id
    into v_target_user_id
  from public.restaurant_memberships rm
  join public.users u on u.id = rm.user_id
  where rm.restaurant_id = v_campaign.restaurant_id
    and u.status = 'active'
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  if v_target_user_id is not null then
    perform public.create_notification(
      v_target_user_id,
      'deliverable_submitted',
      case
        when public.ugc_kind_for_platform(new.platform) is not null
          then 'UGC素材が納品されました'
        else 'PR投稿が提出されました'
      end,
      coalesce(v_creator_name, 'Creator') || 'さんの納品物を確認してください。'
    );
  end if;

  return new;
end;
$$;
