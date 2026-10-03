-- PR post reports: how many people saw each PR post.
--
-- * After the post is submitted, the Creator sends one screenshot of that
--   post's insights (閲覧数・リーチ・保存…). Same bucket and same rule as the
--   30-day insights: the Restaurant never sees the image.
-- * The Operator (or Claude, via `npm run insights -- posts`) reads the
--   screenshot and registers the numbers. Nobody types numbers by hand into
--   the Restaurant's report, so the report is always "運営確認済み".
-- * The Restaurant sees views, reach, saves etc. and the cost per 1,000
--   views next to its PR cost.

create table public.pr_post_reports (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null unique references public.deliverables(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text,
  measured_on date,
  views integer check (views is null or views >= 0),
  reach integer check (reach is null or reach >= 0),
  likes integer check (likes is null or likes >= 0),
  comments integer check (comments is null or comments >= 0),
  saves integer check (saves is null or saves >= 0),
  shares integer check (shares is null or shares >= 0),
  follows integer check (follows is null or follows >= 0),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  check (status <> 'verified' or (views is not null and measured_on is not null))
);

create index pr_post_reports_status_idx on public.pr_post_reports(status, submitted_at);
create index pr_post_reports_restaurant_idx on public.pr_post_reports(restaurant_id);

alter table public.pr_post_reports enable row level security;

-- Numbers are visible to the PR's two parties and the Operator. The Creator
-- and Restaurant never write rows directly.
create policy "post reports visible to the parties"
on public.pr_post_reports for select
using (
  public.is_own_creator_profile(creator_id)
  or public.is_restaurant_member(restaurant_id)
  or public.is_admin()
);

-- Creator: attach the insights screenshot of a submitted PR post. Sending a
-- new screenshot replaces one that is still waiting or was sent back.
create or replace function public.register_pr_post_report(
  p_deliverable_id uuid,
  p_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.deliverables%rowtype;
  v_booking public.bookings%rowtype;
  v_restaurant_id uuid;
  v_existing public.pr_post_reports%rowtype;
  v_mime text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_deliverable from public.deliverables where id = p_deliverable_id;
  if not found then
    raise exception 'deliverable_not_found' using errcode = 'P0002';
  end if;

  select * into v_booking from public.bookings where id = v_deliverable.booking_id;

  if not public.is_own_creator_profile(v_booking.creator_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_deliverable.submitted_url is null then
    raise exception 'post_not_submitted' using errcode = 'P0001';
  end if;

  if split_part(p_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select o.metadata ->> 'mimetype' into v_mime
  from storage.objects o
  where o.bucket_id = 'creator-evidence'
    and o.name = p_storage_path;

  if not found then
    raise exception 'upload_not_found' using errcode = 'P0002';
  end if;

  if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') then
    raise exception 'unsupported_file_type' using errcode = 'P0001';
  end if;

  select c.restaurant_id into v_restaurant_id
  from public.campaigns c where c.id = v_booking.campaign_id;

  select * into v_existing
  from public.pr_post_reports
  where deliverable_id = p_deliverable_id
  for update;

  if found then
    if v_existing.status = 'verified' then
      raise exception 'post_report_already_verified' using errcode = 'P0001';
    end if;

    update public.pr_post_reports
    set storage_path = p_storage_path,
        status = 'pending',
        review_note = null,
        submitted_at = now(),
        reviewed_by = null,
        reviewed_at = null
    where id = v_existing.id
    returning id into v_id;
  else
    insert into public.pr_post_reports (
      deliverable_id, booking_id, creator_id, restaurant_id, storage_path
    )
    values (
      p_deliverable_id, v_booking.id, v_booking.creator_id, v_restaurant_id, p_storage_path
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.register_pr_post_report(uuid, text) from public;
grant execute on function public.register_pr_post_report(uuid, text) to authenticated;

-- Operator / Claude: register the numbers read from the screenshot.
create or replace function public.import_pr_post_report(
  p_report_id uuid,
  p_measured_on date,
  p_views integer,
  p_reach integer default null,
  p_likes integer default null,
  p_comments integer default null,
  p_saves integer default null,
  p_shares integer default null,
  p_follows integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.pr_post_reports%rowtype;
  v_creator_user uuid;
  v_creator_name text;
  v_campaign_title text;
  v_member record;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_report from public.pr_post_reports where id = p_report_id for update;
  if not found then
    raise exception 'post_report_not_found' using errcode = 'P0002';
  end if;

  if v_report.status <> 'pending' then
    raise exception 'post_report_not_pending' using errcode = 'P0001';
  end if;

  if p_measured_on is null
     or p_measured_on > (now() at time zone 'Asia/Tokyo')::date
     or p_measured_on < (v_report.submitted_at at time zone 'Asia/Tokyo')::date - 60 then
    raise exception 'invalid_measured_on' using errcode = 'P0001';
  end if;

  if p_views is null or p_views < 0
     or coalesce(p_reach, 0) < 0 or coalesce(p_likes, 0) < 0 or coalesce(p_comments, 0) < 0
     or coalesce(p_saves, 0) < 0 or coalesce(p_shares, 0) < 0 or coalesce(p_follows, 0) < 0 then
    raise exception 'invalid_post_metrics' using errcode = 'P0001';
  end if;

  -- Reach (people) can never exceed views (plays).
  if p_reach is not null and p_reach > p_views then
    raise exception 'reach_exceeds_views' using errcode = 'P0001';
  end if;

  update public.pr_post_reports
  set status = 'verified',
      measured_on = p_measured_on,
      views = p_views,
      reach = p_reach,
      likes = p_likes,
      comments = p_comments,
      saves = p_saves,
      shares = p_shares,
      follows = p_follows,
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id;

  select cp.user_id, cp.display_name into v_creator_user, v_creator_name
  from public.creator_profiles cp where cp.id = v_report.creator_id;

  select c.title into v_campaign_title
  from public.bookings b join public.campaigns c on c.id = b.campaign_id
  where b.id = v_report.booking_id;

  perform public.create_notification(
    v_creator_user,
    'post_report_verified',
    'PR投稿の閲覧数を登録しました',
    v_campaign_title || '・' || to_char(p_views, 'FM999,999,999') || '閲覧。店舗のレポートに反映されました。'
  );

  for v_member in
    select rm.user_id from public.restaurant_memberships rm
    where rm.restaurant_id = v_report.restaurant_id
  loop
    perform public.create_notification(
      v_member.user_id,
      'post_report_verified',
      coalesce(v_creator_name, 'Creator') || 'さんのPR投稿レポート',
      v_campaign_title || '・' || to_char(p_views, 'FM999,999,999') || '閲覧（運営確認済み）。PR効果から確認できます。'
    );
  end loop;

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else null end,
    'pr_post_report.verified',
    'pr_post_report',
    p_report_id,
    jsonb_build_object('views', p_views, 'reach', p_reach, 'measured_on', p_measured_on)
  );
end;
$$;

revoke all on function public.import_pr_post_report(uuid, date, integer, integer, integer, integer, integer, integer, integer) from public;
grant execute on function public.import_pr_post_report(uuid, date, integer, integer, integer, integer, integer, integer, integer) to authenticated, service_role;

-- Operator / Claude: send the screenshot back with a reason.
create or replace function public.reject_pr_post_report(p_report_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.pr_post_reports%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_creator_user uuid;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_report from public.pr_post_reports where id = p_report_id for update;
  if not found then
    raise exception 'post_report_not_found' using errcode = 'P0002';
  end if;

  if v_report.status <> 'pending' then
    raise exception 'post_report_not_pending' using errcode = 'P0001';
  end if;

  update public.pr_post_reports
  set status = 'rejected',
      review_note = left(v_reason, 300),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id;

  select cp.user_id into v_creator_user
  from public.creator_profiles cp where cp.id = v_report.creator_id;

  perform public.create_notification(
    v_creator_user,
    'post_report_rejected',
    'PR投稿のスクショを読み取れませんでした',
    left(v_reason, 300)
  );
end;
$$;

revoke all on function public.reject_pr_post_report(uuid, text) from public;
grant execute on function public.reject_pr_post_report(uuid, text) to authenticated, service_role;
