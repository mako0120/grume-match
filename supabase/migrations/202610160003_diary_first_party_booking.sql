-- Additional first-party consultation, proposal, confirmation and payment tracking.
-- No REST grants for anon/authenticated; this table is service-role only.
alter table public.diary_pr_inquiries
 add column inquiry_kind text not null default 'consultation'
  check (inquiry_kind in ('consultation','application')),
 add column desired_coverage text,
 add column featured_menu text,
 add column requested_outcome text,
 add column visit_preference text,
 add column proposed_visit_at timestamptz,
 add column proposed_visit_duration_minutes integer
  check (proposed_visit_duration_minutes between 30 and 240),
 add column proposed_deliverables text,
 add column agreed_fee_yen integer check (agreed_fee_yen >= 0),
 add column payment_terms text check (payment_terms in ('after_publish_7d','split_50_50')),
 add column proposal_token_hash text unique,
 add column proposal_expires_at timestamptz,
 add column proposal_email_state text not null default 'none'
  check (proposal_email_state in ('none','pending','sent','failed')),
 add column proposal_sent_at timestamptz,
 add column confirmed_at timestamptz,
 add column operator_notify_state text not null default 'none'
  check (operator_notify_state in ('none','pending','processing','sent','failed')),
 add column operator_notify_attempts integer not null default 0,
 add column operator_notify_claimed_at timestamptz,
 add column operator_notified_at timestamptz,
 add column published_at timestamptz,
 add column published_post_url text,
 add column payment_due_at timestamptz,
 add column payment_received_at timestamptz,
 add constraint diary_booked_requires_confirmed_proposal check (
  status <> 'booked' or (
   inquiry_kind = 'application' and compliance_status = 'approved'
   and confirmed_at is not null and proposed_visit_at is not null
   and agreed_fee_yen is not null and payment_terms is not null
   and proposed_deliverables is not null
  )
 ),
 add constraint diary_publication_payment_consistency check (
  payment_due_at is null or
  (published_at is not null and payment_due_at >= published_at)
 );

-- Stop the same single creator being double booked in a 2-hour time slot.
-- Explicit human rescheduling is required to avoid overlapping bookings.
alter table public.diary_pr_inquiries add constraint diary_no_overlapping_confirmed_visits
 exclude using gist (
   tstzrange(proposed_visit_at, proposed_visit_at + make_interval(mins => proposed_visit_duration_minutes), '[)') with &&
 ) where (status = 'booked' and proposed_visit_at is not null);

create index diary_pending_operator_notification_idx
 on public.diary_pr_inquiries (created_at) where
 status = 'booked' and operator_notify_state in ('pending','failed');
