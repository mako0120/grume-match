-- Claim email delivery work before sending to prevent concurrent cron workers
-- from delivering the same notification twice. Provider idempotency is a second layer.

alter table public.notification_email_outbox
  add column if not exists claimed_at timestamptz,
  add column if not exists provider_message_id text;

alter table public.notification_email_outbox
  drop constraint if exists notification_email_outbox_status_check;

alter table public.notification_email_outbox
  add constraint notification_email_outbox_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));

create index if not exists notification_email_outbox_processing_idx
  on public.notification_email_outbox(status, available_at)
  where status = 'processing';
