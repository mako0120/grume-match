-- Account closure requests are reviewed instead of deleting transactional records inline.

create table public.account_closure_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index account_closure_one_pending_idx
  on public.account_closure_requests(user_id)
  where status = 'pending';

alter table public.account_closure_requests enable row level security;

create policy "users read own closure requests"
on public.account_closure_requests for select
using (user_id = auth.uid() or public.is_admin());


create or replace function public.request_account_closure(
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select u.role into v_role
  from public.users u
  where u.id = auth.uid()
    and u.status = 'active';

  if v_role is null then
    raise exception 'active_user_required' using errcode = 'P0001';
  end if;

  if v_role = 'admin' then
    raise exception 'admin_closure_requires_manual_review' using errcode = 'P0001';
  end if;

  insert into public.account_closure_requests(user_id, reason)
  values(
    auth.uid(),
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_request_id;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_json
  )
  values(
    auth.uid(),
    v_role,
    'account.closure_requested',
    'account_closure_request',
    v_request_id,
    jsonb_build_object('reason_provided', nullif(trim(coalesce(p_reason, '')), '') is not null)
  );

  return v_request_id;

exception
  when unique_violation then
    raise exception 'closure_request_already_pending' using errcode = '23505';
end;
$$;


create or replace function public.review_account_closure(
  p_request_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_closure_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action not in ('suspend', 'dismiss') then
    raise exception 'invalid_closure_action' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.account_closure_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'closure_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'closure_request_already_resolved' using errcode = 'P0001';
  end if;

  if p_action = 'suspend' then
    update public.users
    set
      status = 'suspended',
      updated_at = now()
    where id = v_request.user_id;
  end if;

  update public.account_closure_requests
  set
    status = case when p_action = 'suspend' then 'processed' else 'dismissed' end,
    admin_note = nullif(trim(coalesce(p_note, '')), ''),
    resolved_at = now()
  where id = p_request_id;

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
    'account.closure_reviewed',
    'account_closure_request',
    p_request_id,
    jsonb_build_object('status', v_request.status),
    jsonb_build_object(
      'action', p_action,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );
end;
$$;

revoke all on function public.request_account_closure(text) from public;
grant execute on function public.request_account_closure(text) to authenticated;

revoke all on function public.review_account_closure(uuid, text, text) from public;
grant execute on function public.review_account_closure(uuid, text, text) to authenticated;
