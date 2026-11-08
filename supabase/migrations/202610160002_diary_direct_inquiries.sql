-- Independent first-party PR intake for グルメ日誌｜大阪.
-- Never join these contact details into the marketplace tenant tables.
create table public.diary_pr_inquiries (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null check (char_length(restaurant_name) between 1 and 100),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 254),
  phone text,
  instagram_url text,
  service text not null check (service in (
    'instagram_feed', 'instagram_feed_video', 'instagram_reel', 'instagram_stories',
    'photo_video', 'consultation'
  )),
  budget text not null check (budget in (
    'undecided', 'under_10000', '10000_30000',
    '30000_50000', 'over_50000'
  )),
  desired_period text,
  -- Save current published reference at time of submission; never rewrite
  -- earlier leads when follower milestones change.
  post_price_reference_yen integer check (
    post_price_reference_yen is null or post_price_reference_yen >= 0
  ),
  followers_at_inquiry integer check (
    followers_at_inquiry is null or followers_at_inquiry >= 0
  ),
  follower_snapshot_verified_at date,
  price_policy_version text,
  message text not null check (char_length(message) between 10 and 2000),
  privacy_consented_at timestamptz not null,
  compliance_confirmed_at timestamptz not null,
  compliance_policy_version text not null default '2026-10-16',
  compliance_status text not null default 'pending' check (compliance_status in ('pending', 'approved', 'rejected')),
  compliance_reviewed_at timestamptz,
  check (compliance_status <> 'approved' or compliance_reviewed_at is not null),
  status text not null default 'new' check (status in (
    'new', 'contacted', 'proposed', 'booked', 'closed'
  )),
  check (status not in ('proposed', 'booked') or compliance_status = 'approved'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index diary_pr_inquiries_status_created_idx
  on public.diary_pr_inquiries (status, created_at desc);
create trigger diary_pr_inquiries_set_updated_at
  before update on public.diary_pr_inquiries
  for each row execute function public.set_updated_at();

-- No anon/authenticated SELECT, INSERT, UPDATE or DELETE policies:
-- only the server-side Supabase service role may access this table.
alter table public.diary_pr_inquiries enable row level security;
revoke all on table public.diary_pr_inquiries from anon, authenticated;
grant all on table public.diary_pr_inquiries to service_role;
comment on table public.diary_pr_inquiries is
  'First-party inbound leads to @gurunavi_diary; private operator-only contact data.';
