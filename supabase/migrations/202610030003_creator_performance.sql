-- Creator performance (実績) and media kit.
--
-- Creators record per-post results from their platform insights (views,
-- likes, comments, reposts, shares). Restaurants see a 30-day summary when
-- choosing Creators, and a Creator can publish an opt-in media kit page to
-- pitch Restaurants that are not on the platform yet.
--
-- Numbers are self-reported. A Creator can attach an insights screenshot;
-- the Operator verifies it and the matching rows show as 運営確認済み. Editing
-- a verified row clears its verification. Screenshots are visible only to the
-- Creator and the Operator because they can contain audience data.

-- ---------------------------------------------------------------------------
-- Per-post metrics
-- ---------------------------------------------------------------------------

create table public.creator_post_metrics (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  platform text not null default 'instagram'
    check (platform in ('instagram', 'tiktok', 'youtube', 'threads')),
  area text not null check (char_length(trim(area)) between 1 and 30),
  headline text not null default '' check (char_length(headline) <= 60),
  post_url text check (
    post_url is null
    or (post_url ~ '^https://[^[:space:]]+$' and char_length(post_url) <= 500)
  ),
  posted_on date not null,
  posted_on_approx boolean not null default false,
  measured_on date not null,
  views integer not null check (views between 0 and 100000000),
  views_approx boolean not null default false,
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  reposts integer not null default 0 check (reposts >= 0),
  shares integer not null default 0 check (shares >= 0),
  saves integer check (saves is null or saves >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (posted_on <= measured_on)
);

create index creator_post_metrics_creator_idx
  on public.creator_post_metrics(creator_id, measured_on desc, posted_on desc);

create trigger creator_post_metrics_set_updated_at
before update on public.creator_post_metrics
for each row execute function public.set_updated_at();

alter table public.creator_post_metrics enable row level security;

create or replace function public.is_own_creator_profile(target_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_profiles cp
    join public.users u on u.id = cp.user_id
    where cp.id = target_creator_id
      and cp.user_id = auth.uid()
      and u.status = 'active'
  );
$$;

create policy "post metrics visible with creator profile"
on public.creator_post_metrics for select
using (public.can_view_creator_profile(creator_id));

create policy "creator manages own post metrics"
on public.creator_post_metrics for all
using (public.is_own_creator_profile(creator_id) or public.is_admin())
with check (public.is_own_creator_profile(creator_id) or public.is_admin());

-- Only the Operator can mark rows verified; any Creator edit resets it.
create or replace function public.guard_post_metric_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() then
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

create trigger creator_post_metrics_guard_verification
before insert or update on public.creator_post_metrics
for each row execute function public.guard_post_metric_verification();

-- Replace one insights snapshot (platform + measured date) atomically.
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
  v_count integer;
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
  where creator_id = v_creator_id
    and platform = p_platform
    and measured_on = p_measured_on;

  begin
    insert into public.creator_post_metrics (
      creator_id, platform, area, headline, post_url, posted_on,
      posted_on_approx, measured_on, views, views_approx, likes, comments,
      reposts, shares, saves
    )
    select
      v_creator_id,
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
      r.saves
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
      raise exception 'invalid_metric_rows' using errcode = 'P0001';
  end;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.replace_creator_post_metrics(text, date, jsonb) from public;
grant execute on function public.replace_creator_post_metrics(text, date, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Evidence screenshots (Creator + Operator only)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-evidence',
  'creator-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.creator_performance_evidence (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'threads')),
  measured_on date not null,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index creator_performance_evidence_status_idx
  on public.creator_performance_evidence(status, created_at);

alter table public.creator_performance_evidence enable row level security;

create policy "evidence visible to owner and operator"
on public.creator_performance_evidence for select
using (public.is_own_creator_profile(creator_id) or public.is_admin());

create policy "evidence files creator upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'creator-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.creator_profiles cp
    where cp.user_id = auth.uid()
  )
);

create policy "evidence files owner and operator read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'creator-evidence'
  and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin())
);

create policy "evidence files owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'creator-evidence'
  and split_part(name, '/', 1) = auth.uid()::text
);

create or replace function public.register_performance_evidence(
  p_platform text,
  p_measured_on date,
  p_storage_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid;
  v_mime text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select cp.id into v_creator_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.user_id = auth.uid() and u.status = 'active';

  if v_creator_id is null then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  if p_platform not in ('instagram', 'tiktok', 'youtube', 'threads') then
    raise exception 'invalid_platform' using errcode = 'P0001';
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

  insert into public.creator_performance_evidence (
    creator_id, platform, measured_on, storage_path
  )
  values (v_creator_id, p_platform, p_measured_on, p_storage_path)
  on conflict (storage_path) do update set measured_on = excluded.measured_on
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_performance_evidence(text, date, text) from public;
grant execute on function public.register_performance_evidence(text, date, text) to authenticated;

-- Operator review. Verifying marks the snapshot's rows as verified.
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
  if not public.is_admin() then
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
      else coalesce(nullif(trim(coalesce(p_note, '')), ''), 'スクリーンショットと入力内容をもう一度ご確認ください。')
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
grant execute on function public.review_performance_evidence(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Opt-in public media kit
-- ---------------------------------------------------------------------------

alter table public.creator_profiles
  add column if not exists media_kit_slug text unique
    check (media_kit_slug is null or media_kit_slug ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  add column if not exists media_kit_public boolean not null default false;

create or replace function public.set_media_kit(p_public boolean, p_slug text)
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

  if exists (
    select 1 from public.creator_profiles cp
    where cp.media_kit_slug = v_slug and cp.user_id <> auth.uid()
  ) then
    raise exception 'media_kit_slug_taken' using errcode = 'P0001';
  end if;

  update public.creator_profiles
  set media_kit_slug = v_slug,
      media_kit_public = coalesce(p_public, false)
  where user_id = auth.uid();

  if not found then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  return v_slug;
end;
$$;

revoke all on function public.set_media_kit(boolean, text) from public;
grant execute on function public.set_media_kit(boolean, text) to authenticated;

-- Public read of an opted-in kit: profile basics and the posts of the latest
-- snapshot. No contact details, no screenshots.
create or replace function public.get_public_media_kit(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', cp.display_name,
    'bio', cp.bio,
    'base_area', cp.base_area,
    'min_reward', cp.min_reward,
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
