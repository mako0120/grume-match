-- Commercial launch: record consent to the Terms / Privacy Policy, and make
-- the Creator confirm the PR disclosure (景品表示法・ステマ規制) on every
-- post URL submission.

-- 1. Terms consent ---------------------------------------------------------
-- One row per user and version, kept as history. The current version lives in
-- the app (lib/legal.ts); a new version simply asks everyone again.
create table if not exists public.terms_acceptances (
  user_id uuid not null references public.users(id) on delete cascade,
  terms_version text not null check (terms_version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);

alter table public.terms_acceptances enable row level security;

drop policy if exists "users read own terms acceptances" on public.terms_acceptances;
create policy "users read own terms acceptances"
on public.terms_acceptances for select
using (user_id = auth.uid() or public.is_admin());

-- No insert/update/delete policies: writes go through accept_terms only.
revoke insert, update, delete on public.terms_acceptances from anon, authenticated;

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid_terms_version' using errcode = 'P0001';
  end if;

  insert into public.terms_acceptances (user_id, terms_version)
  values (auth.uid(), p_version)
  on conflict (user_id, terms_version) do nothing;

  if found then
    insert into public.audit_logs (
      actor_user_id, actor_role, action, entity_type, entity_id, after_json
    )
    select u.id, u.role, 'terms.accepted', 'user', u.id,
           jsonb_build_object('version', p_version)
    from public.users u
    where u.id = auth.uid();
  end if;
end;
$$;

revoke all on function public.accept_terms(text) from public;
grant execute on function public.accept_terms(text) to authenticated;

-- 2. PR disclosure on post URL submission ----------------------------------
alter table public.deliverables
  add column if not exists pr_disclosure_confirmed_at timestamptz;

-- The two-argument version is replaced: a URL can no longer be submitted
-- without the Creator confirming the PR disclosure.
drop function if exists public.submit_deliverable(uuid, text);

create or replace function public.submit_deliverable(
  p_deliverable_id uuid,
  p_url text,
  p_pr_disclosed boolean
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

  if p_pr_disclosed is not true then
    raise exception 'pr_disclosure_required' using errcode = 'P0001';
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
    pr_disclosure_confirmed_at = now(),
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
    jsonb_build_object('url', p_url, 'pr_disclosed', true)
  );
end;
$$;

revoke all on function public.submit_deliverable(uuid, text, boolean) from public;
grant execute on function public.submit_deliverable(uuid, text, boolean) to authenticated;
