-- FLASH: same-day / next-day urgent paid PR campaigns.

create type public.campaign_kind as enum ('market', 'flash');

alter table public.campaigns
  add column if not exists kind public.campaign_kind not null default 'market',
  add column if not exists flash_expires_at timestamptz;

create index if not exists campaigns_kind_status_idx
  on public.campaigns(kind, status, flash_expires_at);

create or replace function public.create_flash_campaign(
  p_restaurant_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_area text,
  p_cash_reward integer,
  p_food_offer text,
  p_max_companions integer,
  p_creator_slots integer,
  p_starts_at timestamptz,
  p_visit_duration_minutes integer,
  p_application_deadline timestamptz,
  p_platforms text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_platform text;
  v_ends_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not (
    public.is_restaurant_member(p_restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_cash_reward < 0
     or p_creator_slots <= 0
     or p_visit_duration_minutes <= 0 then
    raise exception 'invalid_flash_values' using errcode = 'P0001';
  end if;

  if p_starts_at <= now() or p_application_deadline >= p_starts_at then
    raise exception 'invalid_flash_time' using errcode = 'P0001';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => p_visit_duration_minutes);

  insert into public.campaigns (
    restaurant_id,
    title,
    description,
    category,
    area,
    cash_reward,
    reward_tax_mode,
    food_offer,
    max_companions,
    creator_slots,
    visit_period_start,
    visit_period_end,
    application_deadline,
    status,
    published_at,
    kind,
    flash_expires_at
  )
  values (
    p_restaurant_id,
    trim(p_title),
    coalesce(p_description, ''),
    trim(p_category),
    trim(p_area),
    p_cash_reward,
    'tax_included',
    coalesce(p_food_offer, ''),
    p_max_companions,
    p_creator_slots,
    (p_starts_at at time zone 'Asia/Tokyo')::date,
    (p_starts_at at time zone 'Asia/Tokyo')::date,
    p_application_deadline,
    'recruiting',
    now(),
    'flash',
    p_application_deadline
  )
  returning id into v_campaign_id;

  foreach v_platform in array p_platforms
  loop
    insert into public.campaign_platforms(
      campaign_id, platform, quantity, required
    )
    values(
      v_campaign_id,
      v_platform::public.platform_type,
      1,
      true
    )
    on conflict (campaign_id, platform) do nothing;
  end loop;

  insert into public.campaign_slots(
    campaign_id,
    starts_at,
    ends_at,
    capacity,
    reserved_count,
    status
  )
  values(
    v_campaign_id,
    p_starts_at,
    v_ends_at,
    p_creator_slots,
    0,
    'open'
  );

  insert into public.audit_logs(
    actor_user_id, actor_role, action, entity_type, entity_id, after_json
  )
  values(
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'flash_campaign.created',
    'campaign',
    v_campaign_id,
    jsonb_build_object(
      'starts_at', p_starts_at,
      'application_deadline', p_application_deadline,
      'cash_reward', p_cash_reward
    )
  );

  return v_campaign_id;
end;
$$;

revoke all on function public.create_flash_campaign(
  uuid,text,text,text,text,integer,text,integer,integer,
  timestamptz,integer,timestamptz,text[]
) from public;

grant execute on function public.create_flash_campaign(
  uuid,text,text,text,text,integer,text,integer,integer,
  timestamptz,integer,timestamptz,text[]
) to authenticated;
