-- New dedicated Stripe invoice lifecycle for first-party Gurume Diary PR.
alter table public.diary_pr_inquiries
 add column stripe_customer_id text,
 add column stripe_invoice_id text unique,
 add column stripe_invoice_status text not null default 'not_created'
  check (stripe_invoice_status in ('not_created','draft','open','paid','failed','void','uncollectible')),
 add column stripe_invoice_pdf text,
 add column stripe_hosted_invoice_url text,
 add column stripe_invoice_error text,
 add column stripe_invoice_last_attempt_at timestamptz,
 add column invoice_issued_at timestamptz,
 add column invoice_sent_at timestamptz;

create index diary_stripe_invoice_jobs_idx on public.diary_pr_inquiries (created_at)
 where status = 'booked' and stripe_invoice_status in ('not_created','draft','failed');

-- Do not expose invoice fields to logged-in restaurant/creator users.
-- Existing table RLS has no user-facing policies.
create table public.diary_stripe_webhook_events (
 id text primary key,
 type text not null,
 received_at timestamptz not null default now()
);
alter table public.diary_stripe_webhook_events enable row level security;
revoke all on public.diary_stripe_webhook_events from anon, authenticated;
grant all on public.diary_stripe_webhook_events to service_role;
