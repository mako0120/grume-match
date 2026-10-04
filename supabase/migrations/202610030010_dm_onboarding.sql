-- Bring PR requests that start in Instagram DMs onto the platform.
--
-- 1. Creator request page (/c/<slug>): a Creator who gets a PR request by
--    DM replies with their link. Restaurants see the Creator's verified
--    numbers and conditions and send a Direct OFFER (signing up first).
--    Opt-in; only verified posts and counts are shown.
-- 2. Offer invite (/i/<token>): a Restaurant that wants a Creator who is
--    not on the platform yet creates a 1-person offer and sends the link by
--    DM. The Creator signs up, claims it and the offer becomes theirs.

-- ---------------------------------------------------------------------------
-- 1. Creator request page
-- ---------------------------------------------------------------------------

alter table public.creator_profiles
  add column if not exists request_slug text unique,
  add column if not exists request_page_enabled boolean not null default false;

alter table public.creator_profiles
  add constraint creator_profiles_request_slug_format
  check (request_slug is null or request_slug ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

create or replace function public.set_creator_request_page(p_slug text, p_enabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_creator_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select id into v_creator_id from public.creator_profiles where user_id = auth.uid();
  if v_creator_id is null then
    raise exception 'creator_profile_required' using errcode = 'P0001';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then
    raise exception 'invalid_request_slug' using errcode = 'P0001';
  end if;

  if v_slug in ('admin', 'api', 'login', 'signup', 'restaurant', 'creator', 'gourmet', 'gourmetdiary', 'official', 'support') then
    raise exception 'request_slug_reserved' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.creator_profiles
    where request_slug = v_slug and id <> v_creator_id
  ) then
    raise exception 'request_slug_taken' using errcode = 'P0001';
  end if;

  update public.creator_profiles
  set request_slug = v_slug,
      request_page_enabled = coalesce(p_enabled, false),
      updated_at = now()
  where id = v_creator_id;

  return v_slug;
end;
$$;

revoke all on function public.set_creator_request_page(text, boolean) from public;
grant execute on function public.set_creator_request_page(text, boolean) to authenticated;

-- Public view of an enabled page. Verified posts only, no contact details.
create or replace function public.get_creator_request_page(p_slug text)
returns table (
  creator_id uuid,
  display_name text,
  base_area text,
  bio text,
  min_reward integer,
  completed_prs integer,
  review_count integer,
  average_rating numeric,
  posts jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    cp.display_name,
    cp.base_area,
    cp.bio,
    cp.min_reward,
    (
      select count(*)::integer
      from public.bookings b
      join public.applications a on a.id = b.application_id
      where b.creator_id = cp.id and a.status in ('approved', 'paid')
    ),
    (
      select count(*)::integer from public.pr_reviews r
      where r.creator_id = cp.id and r.direction = 'restaurant_to_creator'
        and public.pr_review_revealed(r)
    ),
    (
      select round(avg(r.rating), 2) from public.pr_reviews r
      where r.creator_id = cp.id and r.direction = 'restaurant_to_creator'
        and public.pr_review_revealed(r)
    ),
    coalesce((
      select jsonb_agg(to_jsonb(m) order by m.views desc)
      from (
        select platform, area, headline, post_url, posted_on, posted_on_approx,
               measured_on, views, views_approx, likes, comments, reposts, shares,
               saves, verified_at
        from public.creator_post_metrics
        where creator_id = cp.id
          and verified_at is not null
          and measured_on >= (now() at time zone 'Asia/Tokyo')::date - 60
        order by views desc
        limit 30
      ) m
    ), '[]'::jsonb)
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id
  where cp.request_slug = lower(btrim(p_slug))
    and cp.request_page_enabled
    and u.status = 'active';
$$;

revoke all on function public.get_creator_request_page(text) from public;
grant execute on function public.get_creator_request_page(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Offer invites
-- ---------------------------------------------------------------------------

create table public.offer_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[a-z0-9]{20}$'),
  campaign_id uuid not null unique references public.campaigns(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  instagram_handle text not null check (instagram_handle ~ '^[a-z0-9._]{1,30}$'),
  created_by uuid references public.users(id) on delete set null,
  claimed_by_creator_id uuid references public.creator_profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.offer_invites enable row level security;

create policy "invites visible to the restaurant and operator"
on public.offer_invites for select
using (public.is_restaurant_member(restaurant_id) or public.is_admin());

-- Same inputs as create_campaign_with_slots, for one Creator known only by
-- their Instagram handle. The campaign is a direct offer with no target
-- until the invite is claimed, so nobody else can see or apply to it.
create or replace function public.create_offer_invite(
  p_restaurant_id uuid,
  p_instagram_handle text,
  p_title text,
  p_description text,
  p_category text,
  p_area text,
  p_cash_reward integer,
  p_reward_tax_mode public.reward_tax_mode,
  p_food_offer text,
  p_max_companions integer,
  p_visit_period_start date,
  p_visit_period_end date,
  p_application_deadline timestamptz,
  p_platforms text[],
  p_slots jsonb,
  p_usage_rights jsonb default null
)
returns table (campaign_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := lower(regexp_replace(btrim(coalesce(p_instagram_handle, '')), '^@', ''));
  v_campaign_id uuid;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_restaurant_member(p_restaurant_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_handle !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'invalid_instagram_handle' using errcode = 'P0001';
  end if;

  v_campaign_id := public.create_campaign_with_slots(
    p_restaurant_id, p_title, p_description, p_category, p_area, p_cash_reward,
    p_reward_tax_mode, p_food_offer, p_max_companions, 1, p_visit_period_start,
    p_visit_period_end, p_application_deadline, p_platforms, p_slots, p_usage_rights
  );

  update public.campaigns set visibility = 'direct' where id = v_campaign_id;

  v_token := substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 20);

  insert into public.offer_invites (token, campaign_id, restaurant_id, instagram_handle, created_by)
  values (v_token, v_campaign_id, p_restaurant_id, v_handle, auth.uid());

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (auth.uid(), 'restaurant', 'offer_invite.created', 'campaign', v_campaign_id,
          jsonb_build_object('instagram_handle', v_handle));

  return query select v_campaign_id, v_token;
end;
$$;

revoke all on function public.create_offer_invite(uuid, text, text, text, text, text, integer, public.reward_tax_mode, text, integer, date, date, timestamptz, text[], jsonb, jsonb) from public;
grant execute on function public.create_offer_invite(uuid, text, text, text, text, text, integer, public.reward_tax_mode, text, integer, date, date, timestamptz, text[], jsonb, jsonb) to authenticated;

-- What the invited Creator sees before signing up. No address until claimed.
create or replace function public.get_offer_invite(p_token text)
returns table (
  restaurant_name text,
  area text,
  category text,
  title text,
  description text,
  cash_reward integer,
  food_offer text,
  max_companions integer,
  visit_period_start date,
  visit_period_end date,
  application_deadline timestamptz,
  platforms text[],
  instagram_handle text,
  claimed boolean,
  claimed_by_me boolean,
  open boolean,
  campaign_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.name,
    c.area,
    c.category,
    c.title,
    c.description,
    c.cash_reward,
    c.food_offer,
    c.max_companions,
    c.visit_period_start,
    c.visit_period_end,
    c.application_deadline,
    coalesce((select array_agg(cp.platform::text order by cp.platform) from public.campaign_platforms cp where cp.campaign_id = c.id), '{}'),
    i.instagram_handle,
    i.claimed_by_creator_id is not null,
    coalesce(i.claimed_by_creator_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    ), false),
    c.status in ('published', 'recruiting') and c.application_deadline > now(),
    case
      when i.claimed_by_creator_id in (select id from public.creator_profiles where user_id = auth.uid())
      then c.id
    end
  from public.offer_invites i
  join public.campaigns c on c.id = i.campaign_id
  join public.restaurants r on r.id = i.restaurant_id
  where i.token = lower(btrim(p_token));
$$;

revoke all on function public.get_offer_invite(text) from public;
grant execute on function public.get_offer_invite(text) to anon, authenticated;

-- The signed-in Creator takes the offer. One Creator per invite.
create or replace function public.claim_offer_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.offer_invites%rowtype;
  v_campaign public.campaigns%rowtype;
  v_creator_id uuid;
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

  select * into v_invite from public.offer_invites where token = lower(btrim(p_token)) for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if v_invite.claimed_by_creator_id = v_creator_id then
    return v_invite.campaign_id;
  end if;

  if v_invite.claimed_by_creator_id is not null then
    raise exception 'invite_already_claimed' using errcode = 'P0001';
  end if;

  select * into v_campaign from public.campaigns where id = v_invite.campaign_id;
  if v_campaign.status not in ('published', 'recruiting') or v_campaign.application_deadline <= now() then
    raise exception 'invite_closed' using errcode = 'P0001';
  end if;

  update public.offer_invites
  set claimed_by_creator_id = v_creator_id, claimed_at = now()
  where id = v_invite.id;

  -- Same path as a Direct OFFER from now on (the insert notifies the Creator).
  insert into public.campaign_target_creators (campaign_id, creator_id)
  values (v_invite.campaign_id, v_creator_id)
  on conflict do nothing;

  insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
  values (auth.uid(), 'creator', 'offer_invite.claimed', 'campaign', v_invite.campaign_id,
          jsonb_build_object('instagram_handle', v_invite.instagram_handle));

  return v_invite.campaign_id;
end;
$$;

revoke all on function public.claim_offer_invite(text) from public;
grant execute on function public.claim_offer_invite(text) to authenticated;
