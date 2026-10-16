create type public.dispute_status as enum ('open', 'resolved');

create table public.booking_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  opened_by uuid not null references public.users(id) on delete restrict,
  reason text not null,
  status public.dispute_status not null default 'open',
  application_status_before public.application_status not null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index booking_disputes_one_open_idx
  on public.booking_disputes(booking_id)
  where status = 'open';

create index booking_disputes_status_created_idx
  on public.booking_disputes(status, created_at);

alter table public.booking_disputes enable row level security;

create policy "booking parties read disputes"
on public.booking_disputes for select
using (
  public.is_admin()
  or opened_by = auth.uid()
  or exists (
    select 1
    from public.bookings b
    join public.creator_profiles cp on cp.id = b.creator_id
    join public.campaigns c on c.id = b.campaign_id
    where b.id = booking_id
      and (
        cp.user_id = auth.uid()
        or public.is_restaurant_member(c.restaurant_id)
      )
  )
);
