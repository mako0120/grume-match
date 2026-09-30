-- Restaurant campaign creation and nested write policies.

create policy "restaurant members manage campaign platforms"
on public.campaign_platforms for all
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

create or replace function public.create_campaign_with_slots(
  p_restaurant_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_area text,
  p_cash_reward integer,
  p_reward_tax_mode public.reward_tax_mode,
  p_food_offer text,
  p_max_companions integer,
  p_creator_slots integer,
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
  v_platform text;
  v_slot record;
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

  if nullif(trim(p_title), '') is null
     or nullif(trim(p_category), '') is null
     or nullif(trim(p_area), '') is null then
    raise exception 'campaign_fields_required' using errcode = 'P0001';
  end if;

  if p_cash_reward < 0
     or p_max_companions < 0
     or p_creator_slots <= 0 then
    raise exception 'invalid_campaign_numbers' using errcode = 'P0001';
  end if;

  if p_visit_period_end < p_visit_period_start then
    raise exception 'invalid_visit_period' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_platforms, 1), 0) = 0 then
    raise exception 'platform_required' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(p_slots, '[]'::jsonb)) = 0 then
    raise exception 'slots_required' using errcode = 'P0001';
  end if;

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
    published_at
  )
  values (
    p_restaurant_id,
    trim(p_title),
    coalesce(p_description, ''),
    trim(p_category),
    trim(p_area),
    p_cash_reward,
    p_reward_tax_mode,
    coalesce(p_food_offer, ''),
    p_max_companions,
    p_creator_slots,
    p_visit_period_start,
    p_visit_period_end,
    p_application_deadline,
    'recruiting',
    now()
  )
  returning id into v_campaign_id;

  foreach v_platform in array p_platforms
  loop
    insert into public.campaign_platforms (
      campaign_id,
      platform,
      quantity,
      required
    )
    values (
      v_campaign_id,
      v_platform::public.platform_type,
      1,
      true
    )
    on conflict (campaign_id, platform) do nothing;
  end loop;

  for v_slot in
    select *
    from jsonb_to_recordset(p_slots)
      as x(starts_at timestamptz, ends_at timestamptz, capacity integer)
  loop
    if v_slot.ends_at <= v_slot.starts_at then
      raise exception 'invalid_slot_duration' using errcode = 'P0001';
    end if;

    if v_slot.capacity <= 0 then
      raise exception 'invalid_slot_capacity' using errcode = 'P0001';
    end if;

    if (v_slot.starts_at at time zone 'Asia/Tokyo')::date < p_visit_period_start
       or (v_slot.starts_at at time zone 'Asia/Tokyo')::date > p_visit_period_end then
      raise exception 'slot_outside_visit_period' using errcode = 'P0001';
    end if;

    insert into public.campaign_slots (
      campaign_id,
      starts_at,
      ends_at,
      capacity,
      reserved_count,
      status
    )
    values (
      v_campaign_id,
      v_slot.starts_at,
      v_slot.ends_at,
      v_slot.capacity,
      0,
      'open'
    );
  end loop;

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
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'campaign.created',
    'campaign',
    v_campaign_id,
    jsonb_build_object(
      'cash_reward', p_cash_reward,
      'creator_slots', p_creator_slots,
      'slot_count', jsonb_array_length(p_slots)
    )
  );

  return v_campaign_id;
end;
$$;

revoke all on function public.create_campaign_with_slots(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb
) from public;

grant execute on function public.create_campaign_with_slots(
  uuid, text, text, text, text, integer, public.reward_tax_mode, text,
  integer, integer, date, date, timestamptz, text[], jsonb
) to authenticated;
