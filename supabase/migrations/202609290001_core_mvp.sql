-- GOURMET DIARY PR OS — core MVP schema
-- Generated for Supabase/PostgreSQL.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('creator', 'restaurant', 'admin');
create type public.account_status as enum ('active', 'suspended', 'deleted');
create type public.restaurant_member_role as enum ('owner', 'manager', 'staff');
create type public.campaign_status as enum (
  'draft', 'published', 'recruiting', 'filled', 'in_progress',
  'completed', 'cancelled', 'suspended'
);
create type public.reward_tax_mode as enum ('tax_included', 'tax_excluded', 'unspecified');
create type public.platform_type as enum (
  'instagram_feed', 'instagram_reel', 'instagram_story',
  'tiktok', 'youtube_shorts', 'ugc_photo', 'ugc_video'
);
create type public.slot_status as enum ('open', 'full', 'closed');
create type public.application_status as enum (
  'applied', 'shortlisted', 'accepted', 'rejected', 'withdrawn',
  'scheduled', 'visited', 'submitted', 'approved', 'paid',
  'reschedule_requested', 'cancelled', 'dispute'
);
create type public.availability_kind as enum ('exact_slot', 'flexible_after');
create type public.booking_status as enum (
  'held', 'confirmed', 'visited', 'reschedule_requested',
  'cancelled', 'no_show'
);
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.payment_status as enum ('pending', 'approved', 'scheduled', 'paid', 'failed');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'creator',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  base_area text not null,
  min_reward integer not null default 0 check (min_reward >= 0),
  travel_radius_km integer not null default 20 check (travel_radius_km >= 0),
  reliability_score numeric(5,2),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube')),
  handle text not null,
  profile_url text not null,
  followers integer not null default 0 check (followers >= 0),
  avg_views integer check (avg_views is null or avg_views >= 0),
  avg_saves integer check (avg_saves is null or avg_saves >= 0),
  local_audience_ratio numeric(5,2) check (
    local_audience_ratio is null or
    (local_audience_ratio >= 0 and local_audience_ratio <= 100)
  ),
  metrics_verified_at timestamptz,
  unique (creator_id, platform, handle)
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  area text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  status public.account_status not null default 'active',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.restaurant_member_role not null default 'staff',
  unique (restaurant_id, user_id)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null,
  area text not null,
  cash_reward integer not null check (cash_reward >= 0),
  reward_tax_mode public.reward_tax_mode not null default 'unspecified',
  food_offer text not null default '',
  max_companions integer not null default 0 check (max_companions between 0 and 10),
  creator_slots integer not null default 1 check (creator_slots > 0),
  visit_period_start date not null,
  visit_period_end date not null,
  application_deadline timestamptz not null,
  status public.campaign_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visit_period_end >= visit_period_start)
);

create table public.campaign_platforms (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  platform public.platform_type not null,
  quantity integer not null default 1 check (quantity > 0),
  required boolean not null default true,
  unique (campaign_id, platform)
);

create table public.campaign_slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity > 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  status public.slot_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (campaign_id, starts_at),
  check (ends_at > starts_at),
  check (reserved_count <= capacity)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  party_size integer not null default 1 check (party_size between 1 and 20),
  status public.application_status not null default 'applied',
  note text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create table public.application_availabilities (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind public.availability_kind not null,
  campaign_slot_id uuid references public.campaign_slots(id) on delete cascade,
  date_local date,
  flexible_after_local time,
  created_at timestamptz not null default now(),
  check (
    (kind = 'exact_slot' and campaign_slot_id is not null and date_local is null and flexible_after_local is null)
    or
    (kind = 'flexible_after' and campaign_slot_id is null and date_local is not null and flexible_after_local is not null)
  )
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  creator_id uuid not null references public.creator_profiles(id) on delete restrict,
  campaign_slot_id uuid not null references public.campaign_slots(id) on delete restrict,
  party_size integer not null check (party_size between 1 and 20),
  status public.booking_status not null default 'confirmed',
  confirmed_at timestamptz not null default now(),
  visited_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  platform public.platform_type not null,
  due_at timestamptz not null,
  submitted_url text,
  submitted_at timestamptz,
  verification_status public.verification_status not null default 'pending',
  verification_note text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  creator_id uuid not null references public.creator_profiles(id) on delete restrict,
  amount integer not null check (amount >= 0),
  currency char(3) not null default 'JPY',
  status public.payment_status not null default 'pending',
  due_at timestamptz,
  paid_at timestamptz,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index campaigns_status_area_visit_idx
  on public.campaigns(status, area, visit_period_start);
create index campaign_slots_campaign_starts_status_idx
  on public.campaign_slots(campaign_id, starts_at, status);
create index applications_campaign_status_idx
  on public.applications(campaign_id, status);
create index applications_creator_status_idx
  on public.applications(creator_id, status);
create index bookings_creator_status_idx
  on public.bookings(creator_id, status);
create index bookings_campaign_status_idx
  on public.bookings(campaign_id, status);
create index deliverables_due_verification_idx
  on public.deliverables(due_at, verification_status);
create index payments_status_due_idx
  on public.payments(status, due_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function public.set_updated_at();

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_restaurant_member(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships
    where restaurant_id = target_restaurant_id
      and user_id = auth.uid()
  );
$$;

alter table public.users enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.creator_social_accounts enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_platforms enable row level security;
alter table public.campaign_slots enable row level security;
alter table public.applications enable row level security;
alter table public.application_availabilities enable row level security;
alter table public.bookings enable row level security;
alter table public.deliverables enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read self"
on public.users for select
using (id = auth.uid() or public.is_admin());

create policy "creator profiles public readable"
on public.creator_profiles for select
using (true);

create policy "creator profile owner update"
on public.creator_profiles for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "creator social accounts readable"
on public.creator_social_accounts for select
using (true);

create policy "creator social owner all"
on public.creator_social_accounts for all
using (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  ) or public.is_admin()
)
with check (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  ) or public.is_admin()
);

create policy "restaurants public readable"
on public.restaurants for select
using (status = 'active' or public.is_restaurant_member(id) or public.is_admin());

create policy "campaigns public published readable"
on public.campaigns for select
using (
  status in ('published', 'recruiting', 'filled', 'in_progress', 'completed')
  or public.is_restaurant_member(restaurant_id)
  or public.is_admin()
);

create policy "restaurant members manage campaigns"
on public.campaigns for all
using (public.is_restaurant_member(restaurant_id) or public.is_admin())
with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "published campaign platforms readable"
on public.campaign_platforms for select
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and (
        c.status in ('published','recruiting','filled','in_progress','completed')
        or public.is_restaurant_member(c.restaurant_id)
        or public.is_admin()
      )
  )
);

create policy "published campaign slots readable"
on public.campaign_slots for select
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and (
        c.status in ('published','recruiting','filled','in_progress')
        or public.is_restaurant_member(c.restaurant_id)
        or public.is_admin()
      )
  )
);

create policy "restaurant members manage slots"
on public.campaign_slots for all
using (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and (public.is_restaurant_member(c.restaurant_id) or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.campaigns c
    where c.id = campaign_id
      and (public.is_restaurant_member(c.restaurant_id) or public.is_admin())
  )
);

create policy "creator reads own applications"
on public.applications for select
using (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and public.is_restaurant_member(c.restaurant_id)
  )
  or public.is_admin()
);

create policy "creator creates own applications"
on public.applications for insert
with check (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
);

create policy "application availability scoped access"
on public.application_availabilities for select
using (
  exists (
    select 1
    from public.applications a
    join public.creator_profiles cp on cp.id = a.creator_id
    join public.campaigns c on c.id = a.campaign_id
    where a.id = application_id
      and (
        cp.user_id = auth.uid()
        or public.is_restaurant_member(c.restaurant_id)
        or public.is_admin()
      )
  )
);

create policy "creator manages own availability"
on public.application_availabilities for all
using (
  exists (
    select 1
    from public.applications a
    join public.creator_profiles cp on cp.id = a.creator_id
    where a.id = application_id and cp.user_id = auth.uid()
  ) or public.is_admin()
)
with check (
  exists (
    select 1
    from public.applications a
    join public.creator_profiles cp on cp.id = a.creator_id
    where a.id = application_id and cp.user_id = auth.uid()
  ) or public.is_admin()
);

create policy "booking parties can read"
on public.bookings for select
using (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and public.is_restaurant_member(c.restaurant_id)
  )
  or public.is_admin()
);

create policy "deliverables parties can read"
on public.deliverables for select
using (
  exists (
    select 1
    from public.bookings b
    join public.creator_profiles cp on cp.id = b.creator_id
    join public.campaigns c on c.id = b.campaign_id
    where b.id = booking_id
      and (
        cp.user_id = auth.uid()
        or public.is_restaurant_member(c.restaurant_id)
        or public.is_admin()
      )
  )
);

create policy "payments creator can read own"
on public.payments for select
using (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_id and cp.user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "notifications read own"
on public.notifications for select
using (user_id = auth.uid() or public.is_admin());

create policy "audit admin read"
on public.audit_logs for select
using (public.is_admin());

-- Booking creation and capacity updates will be performed by a server-side
-- transaction/RPC in the scheduling implementation. Clients must not receive
-- direct INSERT/UPDATE policies on bookings or payments.
