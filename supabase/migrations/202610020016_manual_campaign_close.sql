-- Let a Restaurant stop accepting new applications without cancelling confirmed visits.

create or replace function public.close_campaign_recruitment(
  p_campaign_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select *
    into v_campaign
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  if not (
    public.is_restaurant_member(v_campaign.restaurant_id)
    or public.is_admin()
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_campaign.status not in ('published', 'recruiting') then
    raise exception 'campaign_not_recruiting' using errcode = 'P0001';
  end if;

  update public.campaigns
  set status = 'closed'
  where id = p_campaign_id;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  )
  values(
    auth.uid(),
    case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
    'campaign.recruitment_closed',
    'campaign',
    p_campaign_id,
    jsonb_build_object('status', v_campaign.status),
    jsonb_build_object('status', 'closed')
  );
end;
$$;

revoke all on function public.close_campaign_recruitment(uuid) from public;
grant execute on function public.close_campaign_recruitment(uuid) to authenticated;
