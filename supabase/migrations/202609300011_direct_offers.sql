-- Direct OFFER: one restaurant can invite one specific Creator to a paid PR campaign.

create type public.campaign_visibility as enum ('public', 'direct');

alter table public.campaigns
  add column if not exists visibility public.campaign_visibility not null default 'public';

create table public.campaign_target_creators (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, creator_id)
);

alter table public.campaign_target_creators enable row level security;

create or replace function public.can_view_campaign(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = target_campaign_id
      and (
        public.is_admin()
        or public.is_restaurant_member(c.restaurant_id)
        or (
          c.visibility = 'public'
          and c.status in ('published', 'recruiting', 'filled', 'in_progress', 'completed')
        )
        or (
          c.visibility = 'direct'
          and exists (
            select 1
            from public.campaign_target_creators ctc
            join public.creator_profiles cp on cp.id = ctc.creator_id
            where ctc.campaign_id = c.id
              and cp.user_id = auth.uid()
          )
        )
      )
  );
$$;

drop policy if exists "campaigns public published readable" on public.campaigns;
create policy "campaigns scoped readable"
on public.campaigns for select
using (public.can_view_campaign(id));

drop policy if exists "published campaign platforms readable" on public.campaign_platforms;
create policy "campaign platforms scoped readable"
on public.campaign_platforms for select
using (public.can_view_campaign(campaign_id));

drop policy if exists "published campaign slots readable" on public.campaign_slots;
create policy "campaign slots scoped readable"
on public.campaign_slots for select
using (public.can_view_campaign(campaign_id));

create policy "target creators scoped readable"
on public.campaign_target_creators for select
using (
  public.can_view_campaign(campaign_id)
);

create policy "restaurant manages campaign targets"
on public.campaign_target_creators for all
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and (public.is_restaurant_member(c.restaurant_id) or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and (public.is_restaurant_member(c.restaurant_id) or public.is_admin())
  )
);

create or replace function public.validate_direct_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visibility public.campaign_visibility;
begin
  select c.visibility
    into v_visibility
  from public.campaigns c
  where c.id = new.campaign_id;

  if v_visibility = 'direct' and not exists (
    select 1
    from public.campaign_target_creators ctc
    where ctc.campaign_id = new.campaign_id
      and ctc.creator_id = new.creator_id
  ) then
    raise exception 'creator_not_targeted' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_validate_direct_target on public.applications;
create trigger applications_validate_direct_target
before insert on public.applications
for each row execute function public.validate_direct_application();

create or replace function public.create_direct_offer_with_slots(
  p_restaurant_id uuid,
  p_creator_id uuid,
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
  p_slots jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if not exists (
    select 1
    from public.creator_profiles cp
    join public.users u on u.id = cp.user_id
    where cp.id = p_creator_id
      and u.status = 'active'
  ) then
    raise exception 'creator_not_available' using errcode = 'P0001';
  end if;

  v_campaign_id := public.create_campaign_with_slots(
    p_restaurant_id,
    p_title,
    p_description,
    p_category,
    p_area,
    p_cash_reward,
    p_reward_tax_mode,
    p_food_offer,
    p_max_companions,
    1,
    p_visit_period_start,
    p_visit_period_end,
    p_application_deadline,
    p_platforms,
    p_slots
  );

  update public.campaigns
  set visibility = 'direct'
  where id = v_campaign_id;

  insert into public.campaign_target_creators(campaign_id, creator_id)
  values(v_campaign_id, p_creator_id);

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
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'direct_offer.created',
    'campaign',
    v_campaign_id,
    jsonb_build_object(
      'creator_id', p_creator_id,
      'cash_reward', p_cash_reward
    )
  );

  return v_campaign_id;
end;
$$;

revoke all on function public.create_direct_offer_with_slots(
  uuid,uuid,text,text,text,text,integer,public.reward_tax_mode,text,
  integer,date,date,timestamptz,text[],jsonb
) from public;

grant execute on function public.create_direct_offer_with_slots(
  uuid,uuid,text,text,text,text,integer,public.reward_tax_mode,text,
  integer,date,date,timestamptz,text[],jsonb
) to authenticated;
