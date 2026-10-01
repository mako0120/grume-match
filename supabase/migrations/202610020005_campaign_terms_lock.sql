-- Lock the terms a Creator applied to.
-- Restaurants may change status, but cannot silently change price, deliverables,
-- dates, or targeting after the first application exists.

create or replace function public.campaign_has_applications(target_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    where a.campaign_id = target_campaign_id
  );
$$;

create or replace function public.lock_campaign_terms_after_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.campaign_has_applications(old.id) and (
    new.restaurant_id is distinct from old.restaurant_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.area is distinct from old.area
    or new.cash_reward is distinct from old.cash_reward
    or new.reward_tax_mode is distinct from old.reward_tax_mode
    or new.food_offer is distinct from old.food_offer
    or new.max_companions is distinct from old.max_companions
    or new.creator_slots is distinct from old.creator_slots
    or new.visit_period_start is distinct from old.visit_period_start
    or new.visit_period_end is distinct from old.visit_period_end
    or new.application_deadline is distinct from old.application_deadline
    or new.kind is distinct from old.kind
    or new.visibility is distinct from old.visibility
  ) then
    raise exception 'campaign_terms_locked_after_application' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_lock_terms_after_application on public.campaigns;

create trigger campaigns_lock_terms_after_application
before update on public.campaigns
for each row execute function public.lock_campaign_terms_after_application();

create or replace function public.lock_campaign_platforms_after_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := case
    when tg_op = 'DELETE' then old.campaign_id
    else new.campaign_id
  end;

  if public.campaign_has_applications(v_campaign_id) then
    raise exception 'campaign_deliverables_locked_after_application' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_platforms_lock_after_application
on public.campaign_platforms;

create trigger campaign_platforms_lock_after_application
before insert or update or delete on public.campaign_platforms
for each row execute function public.lock_campaign_platforms_after_application();

create or replace function public.lock_campaign_slot_terms_after_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := case
    when tg_op = 'DELETE' then old.campaign_id
    else new.campaign_id
  end;

  if tg_op = 'DELETE' and public.campaign_has_applications(v_campaign_id) then
    raise exception 'campaign_slots_locked_after_application' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE'
     and public.campaign_has_applications(v_campaign_id)
     and (
       new.campaign_id is distinct from old.campaign_id
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.capacity is distinct from old.capacity
     ) then
    raise exception 'campaign_slots_locked_after_application' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_slots_lock_terms_after_application
on public.campaign_slots;

create trigger campaign_slots_lock_terms_after_application
before update or delete on public.campaign_slots
for each row execute function public.lock_campaign_slot_terms_after_application();

create or replace function public.lock_direct_target_after_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  v_campaign_id := case
    when tg_op = 'DELETE' then old.campaign_id
    else new.campaign_id
  end;

  if public.campaign_has_applications(v_campaign_id) then
    raise exception 'direct_target_locked_after_application' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_targets_lock_after_application
on public.campaign_target_creators;

create trigger campaign_targets_lock_after_application
before update or delete on public.campaign_target_creators
for each row execute function public.lock_direct_target_after_application();
