-- PR desk: flat-rate PR orders, screenshot-only performance, outreach log.
--
-- * A Creator can open a "PR desk": a fixed-price plan (グルメ日誌: ¥8,000
--   税込, Instagram Reel 1本, 食事1名分は店舗負担) published with the media
--   kit. Restaurants order it from /order/<slug> by picking candidate dates;
--   the price and deliverable come from the database, not the form.
-- * Performance can be registered from a screenshot alone. The Operator (or
--   Claude running the read-insights procedure with the service role) reads
--   the screenshot and imports the rows as verified.
-- * Creators keep a private log of the sales emails they open in Gmail.

-- ---------------------------------------------------------------------------
-- Flat-rate plan
-- ---------------------------------------------------------------------------

alter table public.creator_profiles
  add column if not exists flat_plan_enabled boolean not null default false,
  add column if not exists flat_plan_price integer not null default 8000
    check (flat_plan_price between 1000 and 1000000);

-- One switch for the Creator: publishes the media kit and the plan together.
create or replace function public.set_pr_desk(
  p_enabled boolean,
  p_price integer,
  p_slug text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,29}$' then
    raise exception 'invalid_media_kit_slug' using errcode = 'P0001';
  end if;

  if p_price is null or p_price < 1000 or p_price > 1000000 then
    raise exception 'invalid_flat_plan_price' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.creator_profiles cp
    where cp.media_kit_slug = v_slug and cp.user_id <> auth.uid()
  ) then
    raise exception 'media_kit_slug_taken' using errcode = 'P0001';
  end if;

  update public.creator_profiles
  set media_kit_slug = v_slug,
      media_kit_public = coalesce(p_enabled, false),
      flat_plan_enabled = coalesce(p_enabled, false),
      flat_plan_price = p_price
  where user_id = auth.uid();

  if not found then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  return v_slug;
end;
$$;

revoke all on function public.set_pr_desk(boolean, integer, text) from public;
grant execute on function public.set_pr_desk(boolean, integer, text) to authenticated;

-- Public kit now also carries the plan.
create or replace function public.get_public_media_kit(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', cp.media_kit_slug,
    'display_name', cp.display_name,
    'bio', cp.bio,
    'base_area', cp.base_area,
    'min_reward', cp.min_reward,
    'flat_plan_enabled', cp.flat_plan_enabled,
    'flat_plan_price', cp.flat_plan_price,
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', sa.platform,
        'handle', sa.handle,
        'profile_url', sa.profile_url,
        'followers', sa.followers
      ))
      from public.creator_social_accounts sa
      where sa.creator_id = cp.id
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', m.platform,
        'area', m.area,
        'headline', m.headline,
        'post_url', m.post_url,
        'posted_on', m.posted_on,
        'posted_on_approx', m.posted_on_approx,
        'measured_on', m.measured_on,
        'views', m.views,
        'views_approx', m.views_approx,
        'likes', m.likes,
        'comments', m.comments,
        'reposts', m.reposts,
        'shares', m.shares,
        'saves', m.saves,
        'verified', m.verified_at is not null
      ) order by m.views desc)
      from public.creator_post_metrics m
      where m.creator_id = cp.id
        and m.measured_on >= (
          select max(m2.measured_on) - 45
          from public.creator_post_metrics m2
          where m2.creator_id = cp.id
        )
    ), '[]'::jsonb)
  )
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.media_kit_slug = lower(trim(p_slug))
    and cp.media_kit_public
    and u.status = 'active';
$$;

revoke all on function public.get_public_media_kit(text) from public;
grant execute on function public.get_public_media_kit(text) to anon, authenticated;

-- Restaurant orders the plan. Everything except the dates and a note is
-- fixed by the plan.
create or replace function public.create_flat_plan_order(
  p_slug text,
  p_visit_period_start date,
  p_visit_period_end date,
  p_application_deadline timestamptz,
  p_slots jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator public.creator_profiles%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_campaign_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select cp.*
    into v_creator
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.media_kit_slug = lower(trim(p_slug))
    and cp.flat_plan_enabled
    and cp.media_kit_public
    and u.status = 'active';

  if not found then
    raise exception 'flat_plan_not_available' using errcode = 'P0002';
  end if;

  select r.*
    into v_restaurant
  from public.restaurant_memberships rm
  join public.restaurants r on r.id = rm.restaurant_id
  join public.users u on u.id = rm.user_id
  where rm.user_id = auth.uid()
    and u.role = 'restaurant'
    and u.status = 'active'
    and r.status = 'active'
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  if not found then
    raise exception 'restaurant_required' using errcode = '42501';
  end if;

  v_campaign_id := public.create_direct_offer_with_slots(
    v_restaurant.id,
    v_creator.id,
    v_restaurant.name || ' PRご依頼（' || v_creator.display_name || ' 定額プラン）',
    left(coalesce(trim(p_note), ''), 500),
    'グルメ',
    v_restaurant.area,
    v_creator.flat_plan_price,
    'tax_included',
    '1名分提供',
    0,
    p_visit_period_start,
    p_visit_period_end,
    p_application_deadline,
    array['instagram_reel'],
    p_slots,
    null
  );

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (
    auth.uid(), 'restaurant', 'flat_plan.ordered', 'campaign', v_campaign_id,
    jsonb_build_object('creator_id', v_creator.id, 'price', v_creator.flat_plan_price)
  );

  return v_campaign_id;
end;
$$;

revoke all on function public.create_flat_plan_order(text, date, date, timestamptz, jsonb, text) from public;
grant execute on function public.create_flat_plan_order(text, date, date, timestamptz, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Screenshot-only performance
-- ---------------------------------------------------------------------------

-- Rows written by the Operator's screenshot import are verified at insert.
create or replace function public.guard_post_metric_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin()
     or current_setting('app.metrics_import_verified', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_at := null;
    return new;
  end if;

  if new.verified_at is distinct from old.verified_at
     and new.verified_at is not null then
    new.verified_at := old.verified_at;
  end if;

  if (new.area, new.headline, new.post_url, new.posted_on, new.measured_on,
      new.views, new.likes, new.comments, new.reposts, new.shares, new.saves,
      new.platform)
     is distinct from
     (old.area, old.headline, old.post_url, old.posted_on, old.measured_on,
      old.views, old.likes, old.comments, old.reposts, old.shares, old.saves,
      old.platform) then
    new.verified_at := null;
  end if;

  return new;
end;
$$;

-- Shared writer for one snapshot. Internal only.
create or replace function public.write_post_metrics_snapshot(
  p_creator_id uuid,
  p_platform text,
  p_measured_on date,
  p_rows jsonb,
  p_verified boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_platform not in ('instagram', 'tiktok', 'youtube', 'threads') then
    raise exception 'invalid_platform' using errcode = 'P0001';
  end if;

  if p_measured_on > (now() at time zone 'Asia/Tokyo')::date
     or p_measured_on < (now() at time zone 'Asia/Tokyo')::date - 400 then
    raise exception 'invalid_measured_on' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0
     or jsonb_array_length(p_rows) > 60 then
    raise exception 'invalid_metric_rows' using errcode = 'P0001';
  end if;

  delete from public.creator_post_metrics
  where creator_id = p_creator_id
    and platform = p_platform
    and measured_on = p_measured_on;

  if p_verified then
    perform set_config('app.metrics_import_verified', 'on', true);
  end if;

  begin
    insert into public.creator_post_metrics (
      creator_id, platform, area, headline, post_url, posted_on,
      posted_on_approx, measured_on, views, views_approx, likes, comments,
      reposts, shares, saves, verified_at
    )
    select
      p_creator_id,
      p_platform,
      trim(r.area),
      coalesce(trim(r.headline), ''),
      nullif(trim(coalesce(r.post_url, '')), ''),
      r.posted_on,
      coalesce(r.posted_on_approx, false),
      p_measured_on,
      r.views,
      coalesce(r.views_approx, false),
      coalesce(r.likes, 0),
      coalesce(r.comments, 0),
      coalesce(r.reposts, 0),
      coalesce(r.shares, 0),
      r.saves,
      case when p_verified then now() else null end
    from jsonb_to_recordset(p_rows) as r(
      area text,
      headline text,
      post_url text,
      posted_on date,
      posted_on_approx boolean,
      views integer,
      views_approx boolean,
      likes integer,
      comments integer,
      reposts integer,
      shares integer,
      saves integer
    );
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or numeric_value_out_of_range or datetime_field_overflow then
      perform set_config('app.metrics_import_verified', 'off', true);
      raise exception 'invalid_metric_rows' using errcode = 'P0001';
  end;

  get diagnostics v_count = row_count;
  perform set_config('app.metrics_import_verified', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.write_post_metrics_snapshot(uuid, text, date, jsonb, boolean) from public;
revoke all on function public.write_post_metrics_snapshot(uuid, text, date, jsonb, boolean) from anon, authenticated;

create or replace function public.replace_creator_post_metrics(
  p_platform text,
  p_measured_on date,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select cp.id
    into v_creator_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.user_id = auth.uid()
    and u.status = 'active';

  if v_creator_id is null then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  return public.write_post_metrics_snapshot(
    v_creator_id, p_platform, p_measured_on, p_rows, false
  );
end;
$$;

revoke all on function public.replace_creator_post_metrics(text, date, jsonb) from public;
grant execute on function public.replace_creator_post_metrics(text, date, jsonb) to authenticated;

create or replace function public.is_operator_or_service()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or coalesce(auth.role(), '') = 'service_role';
$$;

-- Operator / Claude: rows read from the screenshot become the snapshot,
-- verified, and the Creator is notified.
create or replace function public.import_metrics_from_evidence(
  p_evidence_id uuid,
  p_rows jsonb,
  p_measured_on date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.creator_performance_evidence%rowtype;
  v_measured_on date;
  v_count integer;
  v_creator_user uuid;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_evidence
  from public.creator_performance_evidence
  where id = p_evidence_id
  for update;

  if not found then
    raise exception 'evidence_not_found' using errcode = 'P0002';
  end if;

  v_measured_on := coalesce(p_measured_on, v_evidence.measured_on);

  v_count := public.write_post_metrics_snapshot(
    v_evidence.creator_id, v_evidence.platform, v_measured_on, p_rows, true
  );

  update public.creator_performance_evidence
  set status = 'verified',
      measured_on = v_measured_on,
      review_note = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_evidence_id;

  select cp.user_id into v_creator_user
  from public.creator_profiles cp
  where cp.id = v_evidence.creator_id;

  perform public.create_notification(
    v_creator_user,
    'performance_reviewed',
    '実績を登録しました',
    'スクリーンショットから' || v_count || '投稿を読み取り、運営確認済みで登録しました。'
  );

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (
    auth.uid(), 'admin', 'performance_evidence.imported',
    'creator_performance_evidence', p_evidence_id,
    jsonb_build_object('rows', v_count, 'measured_on', v_measured_on)
  );

  return v_count;
end;
$$;

revoke all on function public.import_metrics_from_evidence(uuid, jsonb, date) from public;
grant execute on function public.import_metrics_from_evidence(uuid, jsonb, date) to authenticated, service_role;

-- Same review as before, also callable by the service role (Claude's
-- read-insights procedure) to send a screenshot back.
create or replace function public.review_performance_evidence(
  p_evidence_id uuid,
  p_approve boolean,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.creator_performance_evidence%rowtype;
  v_count integer := 0;
  v_creator_user uuid;
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_evidence
  from public.creator_performance_evidence
  where id = p_evidence_id
  for update;

  if not found then
    raise exception 'evidence_not_found' using errcode = 'P0002';
  end if;

  update public.creator_performance_evidence
  set status = case when p_approve then 'verified' else 'rejected' end,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_evidence_id;

  if p_approve then
    update public.creator_post_metrics
    set verified_at = now()
    where creator_id = v_evidence.creator_id
      and platform = v_evidence.platform
      and measured_on = v_evidence.measured_on;
    get diagnostics v_count = row_count;
  end if;

  select cp.user_id into v_creator_user
  from public.creator_profiles cp
  where cp.id = v_evidence.creator_id;

  perform public.create_notification(
    v_creator_user,
    'performance_reviewed',
    case when p_approve then '実績が運営確認済みになりました' else '実績スクリーンショットを確認できませんでした' end,
    case
      when p_approve then '店舗に表示される実績に「運営確認済み」が付きました。'
      else coalesce(nullif(trim(coalesce(p_note, '')), ''), 'スクリーンショットをもう一度ご確認ください。')
    end
  );

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (
    auth.uid(), 'admin', 'performance_evidence.' || case when p_approve then 'verified' else 'rejected' end,
    'creator_performance_evidence', p_evidence_id,
    jsonb_build_object('rows_verified', v_count)
  );

  return v_count;
end;
$$;

revoke all on function public.review_performance_evidence(uuid, boolean, text) from public;
grant execute on function public.review_performance_evidence(uuid, boolean, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Outreach log (private to the Creator)
-- ---------------------------------------------------------------------------

create table public.creator_outreach (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) between 1 and 80),
  contact_name text check (contact_name is null or char_length(contact_name) <= 40),
  email text check (email is null or (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 200)),
  created_at timestamptz not null default now()
);

create index creator_outreach_creator_idx on public.creator_outreach(creator_id, created_at desc);

alter table public.creator_outreach enable row level security;

create policy "creator manages own outreach"
on public.creator_outreach for all
using (public.is_own_creator_profile(creator_id))
with check (public.is_own_creator_profile(creator_id));
