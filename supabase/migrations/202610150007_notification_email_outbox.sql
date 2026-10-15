-- Transactional email outbox. In-app notifications remain the source of truth;
-- email delivery is asynchronous and may be retried without affecting transactions.

create table public.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  email text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_email_outbox_delivery_idx
  on public.notification_email_outbox(status, available_at, attempts);

alter table public.notification_email_outbox enable row level security;

create policy "admin reads email outbox"
on public.notification_email_outbox for select
using (public.is_admin());


create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_status public.account_status;
begin
  select u.email, u.status
    into v_email, v_status
  from public.users u
  where u.id = new.user_id;

  if v_status <> 'active'
     or nullif(trim(coalesce(v_email, '')), '') is null then
    return new;
  end if;

  insert into public.notification_email_outbox(
    notification_id,
    user_id,
    email,
    subject,
    body
  )
  values(
    new.id,
    new.user_id,
    trim(v_email),
    new.title,
    new.body
  )
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_email
on public.notifications;

create trigger notifications_enqueue_email
after insert on public.notifications
for each row execute function public.enqueue_notification_email();


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

  update public.notification_email_outbox
  set
    status = 'pending',
    attempts = 0,
    available_at = now(),
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
