-- Complete the application lifecycle without DM negotiation.

create or replace function public.withdraw_application(
  p_application_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_creator_id uuid;
  v_campaign public.campaigns%rowtype;
  v_restaurant_user_id uuid;
  v_creator_name text;
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

  select *
    into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  if v_application.creator_id <> v_creator_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_application.status not in ('applied', 'shortlisted', 'accepted') then
    raise exception 'application_cannot_be_withdrawn' using errcode = 'P0001';
  end if;

  update public.applications
  set status = 'withdrawn'
  where id = p_application_id;

  select *
    into v_campaign
  from public.campaigns
  where id = v_application.campaign_id;

  select rm.user_id
    into v_restaurant_user_id
  from public.restaurant_memberships rm
  join public.users u on u.id = rm.user_id
  where rm.restaurant_id = v_campaign.restaurant_id
    and u.status = 'active'
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  select cp.display_name
    into v_creator_name
  from public.creator_profiles cp
  where cp.id = v_creator_id;

  if v_restaurant_user_id is not null then
    perform public.create_notification(
      v_restaurant_user_id,
      'application_withdrawn',
      'PR応募が取り消されました',
      coalesce(v_creator_name, 'Creator') || 'さんが応募を取り消しました。'
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
    'creator',
    'application.withdrawn',
    'application',
    p_application_id,
    jsonb_build_object('campaign_id', v_application.campaign_id)
  );
end;
$$;

create or replace function public.reject_application(
  p_application_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_campaign public.campaigns%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  select *
    into v_campaign
  from public.campaigns
  where id = v_application.campaign_id;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_application.status not in ('applied', 'shortlisted', 'accepted') then
    raise exception 'application_not_rejectable' using errcode = 'P0001';
  end if;

  update public.applications
  set status = 'rejected'
  where id = p_application_id;

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
    'application.rejected',
    'application',
    p_application_id,
    jsonb_build_object('campaign_id', v_application.campaign_id)
  );
end;
$$;

revoke all on function public.withdraw_application(uuid) from public;
grant execute on function public.withdraw_application(uuid) to authenticated;

revoke all on function public.reject_application(uuid) from public;
grant execute on function public.reject_application(uuid) to authenticated;
