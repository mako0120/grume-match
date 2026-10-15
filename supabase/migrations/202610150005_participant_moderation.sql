-- Make Admin verification useful as a real commercial moderation gate.

create or replace function public.admin_verify_participant(
  p_kind text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text;
  v_user_id uuid;
  v_social_count integer;
  v_restaurant public.restaurants%rowtype;
  v_creator public.creator_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_kind = 'creator' then
    select * into v_creator
    from public.creator_profiles
    where id = p_id
    for update;

    if not found then
      raise exception 'creator_not_found' using errcode = 'P0002';
    end if;

    select cp.user_id into v_user_id
    from public.creator_profiles cp
    join public.users u on u.id = cp.user_id
    where cp.id = p_id
      and u.status = 'active';

    if v_user_id is null then
      raise exception 'creator_not_active' using errcode = 'P0001';
    end if;

    if nullif(trim(v_creator.display_name), '') is null
       or nullif(trim(v_creator.base_area), '') is null then
      raise exception 'creator_profile_incomplete' using errcode = 'P0001';
    end if;

    select count(*) into v_social_count
    from public.creator_social_accounts csa
    where csa.creator_id = p_id
      and nullif(trim(csa.handle), '') is not null;

    if v_social_count = 0 then
      raise exception 'creator_social_required' using errcode = 'P0001';
    end if;

    update public.creator_profiles
    set
      verified_at = coalesce(verified_at, now()),
      updated_at = now()
    where id = p_id;

    v_entity_type := 'creator_profile';

    perform public.create_notification(
      v_user_id,
      'participant_verified',
      '利用確認が完了しました',
      '有償PR案件を利用できるようになりました。'
    );

  elsif p_kind = 'restaurant' then
    select * into v_restaurant
    from public.restaurants
    where id = p_id
    for update;

    if not found then
      raise exception 'restaurant_not_found' using errcode = 'P0002';
    end if;

    if v_restaurant.status <> 'active' then
      raise exception 'restaurant_not_active' using errcode = 'P0001';
    end if;

    if nullif(trim(v_restaurant.name), '') is null
       or nullif(trim(v_restaurant.address), '') is null
       or nullif(trim(v_restaurant.area), '') is null then
      raise exception 'restaurant_profile_incomplete' using errcode = 'P0001';
    end if;

    select rm.user_id into v_user_id
    from public.restaurant_memberships rm
    join public.users u on u.id = rm.user_id
    where rm.restaurant_id = p_id
      and u.status = 'active'
    order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
    limit 1;

    if v_user_id is null then
      raise exception 'restaurant_owner_required' using errcode = 'P0001';
    end if;

    update public.restaurants
    set
      verified_at = coalesce(verified_at, now()),
      updated_at = now()
    where id = p_id;

    v_entity_type := 'restaurant';

    perform public.create_notification(
      v_user_id,
      'participant_verified',
      '利用確認が完了しました',
      '有償PR案件を公開できるようになりました。'
    );
  else
    raise exception 'invalid_participant_kind' using errcode = 'P0001';
  end if;

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
    'admin',
    'participant.verified',
    v_entity_type,
    p_id,
    jsonb_build_object('verified_at', now())
  );
end;
$$;


create or replace function public.admin_suspend_participant(
  p_kind text,
  p_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_entity_type text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'moderation_reason_required' using errcode = 'P0001';
  end if;

  if p_kind = 'creator' then
    select cp.user_id into v_user_id
    from public.creator_profiles cp
    where cp.id = p_id;

    if v_user_id is null then
      raise exception 'creator_not_found' using errcode = 'P0002';
    end if;

    if public.user_has_open_commercial_transactions(v_user_id) then
      raise exception 'participant_has_active_transactions' using errcode = 'P0001';
    end if;

    update public.users
    set
      status = 'suspended',
      updated_at = now()
    where id = v_user_id;

    v_entity_type := 'creator_profile';

  elsif p_kind = 'restaurant' then
    if exists (
      select 1
      from public.campaigns c
      where c.restaurant_id = p_id
        and c.status in ('published', 'recruiting', 'filled', 'in_progress')
    ) then
      raise exception 'participant_has_active_transactions' using errcode = 'P0001';
    end if;

    update public.restaurants
    set
      status = 'suspended',
      updated_at = now()
    where id = p_id;

    if not found then
      raise exception 'restaurant_not_found' using errcode = 'P0002';
    end if;

    select rm.user_id into v_user_id
    from public.restaurant_memberships rm
    where rm.restaurant_id = p_id
    order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
    limit 1;

    v_entity_type := 'restaurant';
  else
    raise exception 'invalid_participant_kind' using errcode = 'P0001';
  end if;

  if v_user_id is not null then
    perform public.create_notification(
      v_user_id,
      'participant_suspended',
      '利用状態を確認してください',
      '運営確認により有償PR機能の利用を停止しました。'
    );
  end if;

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
    'admin',
    'participant.suspended',
    v_entity_type,
    p_id,
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

revoke all on function public.admin_verify_participant(text, uuid) from public;
grant execute on function public.admin_verify_participant(text, uuid) to authenticated;

revoke all on function public.admin_suspend_participant(text, uuid, text) from public;
grant execute on function public.admin_suspend_participant(text, uuid, text) to authenticated;
