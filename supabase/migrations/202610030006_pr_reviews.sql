-- Mutual reviews after a PR is complete (相互評価).
--
-- * When the post is approved (application approved/paid), the Restaurant
--   rates the Creator and the Creator rates the Restaurant: 1–5 stars, a few
--   fixed tags and an optional comment.
-- * Double-blind: the other side's review is shown only after both sides
--   have reviewed, or 14 days after the first review. Nobody can edit a
--   review afterwards, so ratings cannot be traded or retaliated against.
-- * Summaries (average, count, tag counts) use revealed reviews only. They
--   feed matching and are shown on applicant / campaign cards.
-- * Ratings of 2 or less go to the Operator inbox for follow-up.

create table public.pr_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  direction text not null check (direction in ('restaurant_to_creator', 'creator_to_restaurant')),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  reviewer_user_id uuid references public.users(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text check (comment is null or char_length(comment) <= 300),
  followed_up_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, direction)
);

create index pr_reviews_creator_idx on public.pr_reviews(creator_id, direction);
create index pr_reviews_restaurant_idx on public.pr_reviews(restaurant_id, direction);

alter table public.pr_reviews enable row level security;

-- Raw rows: the reviewer's own review and the Operator only. Everyone else
-- goes through the functions below, which apply the double-blind rule.
create policy "reviewers read their own reviews"
on public.pr_reviews for select
using (reviewer_user_id = auth.uid() or public.is_admin());

create or replace function public.pr_review_tags(p_direction text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_direction
    when 'restaurant_to_creator' then
      array['時間どおり', '写真・動画がきれい', '投稿が早い', '説明が丁寧', 'また依頼したい']
    when 'creator_to_restaurant' then
      array['説明どおりの内容', '対応が丁寧', '撮影しやすい', '連絡が早い', 'また行きたい']
    else array[]::text[]
  end;
$$;

grant execute on function public.pr_review_tags(text) to authenticated;

-- A review is visible to the other side once both have reviewed, or 14 days
-- after it was written.
create or replace function public.pr_review_revealed(p_review public.pr_reviews)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_review.created_at <= now() - interval '14 days'
    or exists (
      select 1 from public.pr_reviews other
      where other.booking_id = p_review.booking_id
        and other.direction <> p_review.direction
    );
$$;

revoke all on function public.pr_review_revealed(public.pr_reviews) from public;

create or replace function public.submit_pr_review(
  p_booking_id uuid,
  p_rating integer,
  p_tags text[] default '{}',
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_restaurant_id uuid;
  v_restaurant_name text;
  v_campaign_title text;
  v_creator_user_id uuid;
  v_creator_name text;
  v_application_status public.application_status;
  v_direction text;
  v_tags text[];
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_review_id uuid;
  v_member record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  select c.restaurant_id, r.name, c.title
    into v_restaurant_id, v_restaurant_name, v_campaign_title
  from public.campaigns c
  join public.restaurants r on r.id = c.restaurant_id
  where c.id = v_booking.campaign_id;

  select cp.user_id, cp.display_name
    into v_creator_user_id, v_creator_name
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  if v_creator_user_id = auth.uid() then
    v_direction := 'creator_to_restaurant';
  elsif public.is_restaurant_member(v_restaurant_id) then
    v_direction := 'restaurant_to_creator';
  else
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select a.status into v_application_status
  from public.applications a
  where a.id = v_booking.application_id;

  -- Only after the post has been approved: the PR is actually complete.
  if v_application_status not in ('approved', 'paid') then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct tag), '{}')
    into v_tags
  from unnest(coalesce(p_tags, '{}')) as tag;

  if not (v_tags <@ public.pr_review_tags(v_direction)) then
    raise exception 'invalid_review_tag' using errcode = 'P0001';
  end if;

  if v_comment is not null and char_length(v_comment) > 300 then
    raise exception 'review_comment_too_long' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.pr_reviews
    where booking_id = p_booking_id and direction = v_direction
  ) then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  insert into public.pr_reviews (
    booking_id, direction, creator_id, restaurant_id, reviewer_user_id, rating, tags, comment
  )
  values (
    p_booking_id, v_direction, v_booking.creator_id, v_restaurant_id, auth.uid(),
    p_rating, v_tags, v_comment
  )
  returning id into v_review_id;

  -- Tell the other side; the stars stay hidden until they review too.
  if v_direction = 'restaurant_to_creator' then
    perform public.create_notification(
      v_creator_user_id,
      'pr_review_received',
      coalesce(v_restaurant_name, '店舗') || 'から評価が届きました',
      'あなたも評価すると、お互いの評価が表示されます（' || v_campaign_title || '）。'
    );
  else
    for v_member in
      select rm.user_id from public.restaurant_memberships rm
      where rm.restaurant_id = v_restaurant_id
    loop
      perform public.create_notification(
        v_member.user_id,
        'pr_review_received',
        coalesce(v_creator_name, 'Creator') || 'さんから評価が届きました',
        'Creatorを評価すると、お互いの評価が表示されます（' || v_campaign_title || '）。'
      );
    end loop;
  end if;

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (
    auth.uid(),
    case when v_direction = 'creator_to_restaurant' then 'creator'::public.user_role else 'restaurant'::public.user_role end,
    'pr_review.submitted',
    'booking',
    p_booking_id,
    jsonb_build_object('direction', v_direction, 'rating', p_rating, 'tags', v_tags)
  );

  return v_review_id;
end;
$$;

revoke all on function public.submit_pr_review(uuid, integer, text[], text) from public;
grant execute on function public.submit_pr_review(uuid, integer, text[], text) to authenticated;

-- Both reviews of one booking, for its two parties. The other side's review
-- is returned only once revealed.
create or replace function public.booking_pr_reviews(p_booking_id uuid)
returns table (
  direction text,
  is_mine boolean,
  revealed boolean,
  rating smallint,
  tags text[],
  comment text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
  v_restaurant_id uuid;
  v_my_direction text;
begin
  select cp.user_id, c.restaurant_id
    into v_creator_user_id, v_restaurant_id
  from public.bookings b
  join public.creator_profiles cp on cp.id = b.creator_id
  join public.campaigns c on c.id = b.campaign_id
  where b.id = p_booking_id;

  if not found or auth.uid() is null then
    return;
  end if;

  if v_creator_user_id = auth.uid() then
    v_my_direction := 'creator_to_restaurant';
  elsif public.is_restaurant_member(v_restaurant_id) then
    v_my_direction := 'restaurant_to_creator';
  elsif not public.is_admin() then
    return;
  end if;

  return query
  select
    r.direction,
    r.direction = v_my_direction,
    public.pr_review_revealed(r),
    r.rating,
    r.tags,
    r.comment,
    r.created_at
  from public.pr_reviews r
  where r.booking_id = p_booking_id
    and (
      r.direction = v_my_direction
      or public.is_admin()
      or public.pr_review_revealed(r)
    );
end;
$$;

revoke all on function public.booking_pr_reviews(uuid) from public;
grant execute on function public.booking_pr_reviews(uuid) to authenticated;

-- How Restaurants rated these Creators (revealed reviews only).
create or replace function public.creator_review_summaries(p_creator_ids uuid[])
returns table (creator_id uuid, review_count integer, average_rating numeric, tag_counts jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    count(r.id)::integer,
    round(avg(r.rating), 2),
    coalesce((
      select jsonb_object_agg(tag, n)
      from (
        select tag, count(*)::integer as n
        from public.pr_reviews r2, unnest(r2.tags) as tag
        where r2.creator_id = cp.id
          and r2.direction = 'restaurant_to_creator'
          and public.pr_review_revealed(r2)
        group by tag
      ) t
    ), '{}'::jsonb)
  from public.creator_profiles cp
  left join public.pr_reviews r
    on r.creator_id = cp.id
   and r.direction = 'restaurant_to_creator'
   and public.pr_review_revealed(r)
  where cp.id = any(p_creator_ids)
    and public.can_view_creator_profile(cp.id)
  group by cp.id;
$$;

revoke all on function public.creator_review_summaries(uuid[]) from public;
grant execute on function public.creator_review_summaries(uuid[]) to authenticated;

-- How Creators rated these Restaurants (revealed reviews only).
create or replace function public.restaurant_review_summaries(p_restaurant_ids uuid[])
returns table (restaurant_id uuid, review_count integer, average_rating numeric, tag_counts jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rs.id,
    count(r.id)::integer,
    round(avg(r.rating), 2),
    coalesce((
      select jsonb_object_agg(tag, n)
      from (
        select tag, count(*)::integer as n
        from public.pr_reviews r2, unnest(r2.tags) as tag
        where r2.restaurant_id = rs.id
          and r2.direction = 'creator_to_restaurant'
          and public.pr_review_revealed(r2)
        group by tag
      ) t
    ), '{}'::jsonb)
  from public.restaurants rs
  left join public.pr_reviews r
    on r.restaurant_id = rs.id
   and r.direction = 'creator_to_restaurant'
   and public.pr_review_revealed(r)
  where rs.id = any(p_restaurant_ids)
    and auth.uid() is not null
    and public.can_view_restaurant(rs.id)
  group by rs.id;
$$;

revoke all on function public.restaurant_review_summaries(uuid[]) from public;
grant execute on function public.restaurant_review_summaries(uuid[]) to authenticated;

-- Operator: mark a low rating as followed up so it leaves the inbox.
create or replace function public.mark_pr_review_followed_up(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_operator_or_service() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.pr_reviews
  set followed_up_at = coalesce(followed_up_at, now())
  where id = p_review_id;

  if not found then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_pr_review_followed_up(uuid) from public;
grant execute on function public.mark_pr_review_followed_up(uuid) to authenticated, service_role;
