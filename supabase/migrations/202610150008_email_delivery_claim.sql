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


create or replace function public.admin_retry_notification_email(
  p_outbox_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_email_outbox%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_row
  from public.notification_email_outbox
  where id = p_outbox_id
  for update;

  if not found then
    raise exception 'email_outbox_not_found' using errcode = 'P0002';
  end if;

  if v_row.status = 'sent' then
    raise exception 'email_already_sent' using errcode = 'P0001';
  end if;

  if v_row.status <> 'failed' then
    raise exception 'email_not_retryable' using errcode = 'P0001';
  end if;

  update public.notification_email_outbox
  set
    status = 'pending',
    attempts = 0,
    available_at = now(),
    claimed_at = null,
    last_error = null,
    updated_at = now()
  where id = p_outbox_id;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  )
  values(
    auth.uid(),
    'admin',
    'notification_email.retry_requested',
    'notification_email_outbox',
    p_outbox_id,
    jsonb_build_object(
      'status', v_row.status,
      'attempts', v_row.attempts
    ),
    jsonb_build_object(
      'status', 'pending',
      'attempts', 0
    )
  );
end;
$$;

revoke all on function public.admin_retry_notification_email(uuid) from public;
grant execute on function public.admin_retry_notification_email(uuid) to authenticated;
