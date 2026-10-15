-- Notify the participant when Admin finishes the one-time commercial verification.

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
  v_target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_kind = 'creator' then
    update public.creator_profiles cp
    set
      verified_at = coalesce(cp.verified_at, now()),
      updated_at = now()
    where cp.id = p_id
    returning cp.user_id into v_target_user_id;

    if not found then
      raise exception 'creator_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'creator_profile';
  elsif p_kind = 'restaurant' then
    update public.restaurants r
    set
      verified_at = coalesce(r.verified_at, now()),
      updated_at = now()
    where r.id = p_id
      and r.status = 'active';

    if not found then
      raise exception 'restaurant_not_found' using errcode = 'P0002';
    end if;

    select rm.user_id
      into v_target_user_id
    from public.restaurant_memberships rm
    join public.users u on u.id = rm.user_id
    where rm.restaurant_id = p_id
      and u.status = 'active'
    order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
    limit 1;

    v_entity_type := 'restaurant';
  else
    raise exception 'invalid_participant_kind' using errcode = 'P0001';
  end if;

  if v_target_user_id is not null then
    perform public.create_notification(
      v_target_user_id,
      'participant_verified',
      '利用確認が完了しました',
      case
        when p_kind = 'creator'
          then '有償PR案件へ応募できるようになりました。'
        else '有償PR案件を公開できるようになりました。'
      end
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
    'participant.verified',
    v_entity_type,
    p_id,
    jsonb_build_object(
      'verified_at', now(),
      'notified_user_id', v_target_user_id
    )
  );
end;
$$;

revoke all on function public.admin_verify_participant(text, uuid) from public;
grant execute on function public.admin_verify_participant(text, uuid) to authenticated;
