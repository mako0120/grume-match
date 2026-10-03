-- Matching: invitations and track records.
--
-- * Restaurants invite well-matched Creators to a public campaign, and the
--   app auto-invites the best matches when a campaign is published. An
--   invitation is a notification plus a record, so the Creator sees
--   「招待あり」 and nobody is invited twice.
-- * creator_track_records() gives Restaurants completed-PR and no-show
--   counts without exposing other Restaurants' bookings or payments.

create table public.campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  source text not null check (source in ('restaurant', 'auto')),
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create index campaign_invitations_creator_idx
  on public.campaign_invitations(creator_id, created_at desc);

alter table public.campaign_invitations enable row level security;

create policy "invitations visible to the parties"
on public.campaign_invitations for select
using (
  public.is_own_creator_profile(creator_id)
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and public.is_restaurant_member(c.restaurant_id)
  )
  or public.is_admin()
);

create or replace function public.invite_creators_to_campaign(
  p_campaign_id uuid,
  p_creator_ids uuid[],
  p_source text default 'restaurant'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_restaurant_name text;
  v_existing integer;
  v_invited integer := 0;
  v_creator record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_source not in ('restaurant', 'auto') then
    raise exception 'invalid_invitation_source' using errcode = 'P0001';
  end if;

  if coalesce(array_length(p_creator_ids, 1), 0) = 0 then
    return 0;
  end if;

  if array_length(p_creator_ids, 1) > 10 then
    raise exception 'too_many_invitations' using errcode = 'P0001';
  end if;

  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found
     or not (public.is_restaurant_member(v_campaign.restaurant_id) or public.is_admin()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_campaign.visibility <> 'public'
     or v_campaign.status not in ('published', 'recruiting')
     or v_campaign.application_deadline <= now() then
    raise exception 'campaign_not_inviting' using errcode = 'P0001';
  end if;

  select count(*) into v_existing
  from public.campaign_invitations
  where campaign_id = p_campaign_id;

  select r.name into v_restaurant_name
  from public.restaurants r
  where r.id = v_campaign.restaurant_id;

  for v_creator in
    select cp.id, cp.user_id
    from public.creator_profiles cp
    join public.users u on u.id = cp.user_id
    where cp.id = any(p_creator_ids)
      and u.status = 'active'
      and u.role = 'creator'
      and not exists (
        select 1 from public.applications a
        where a.campaign_id = p_campaign_id and a.creator_id = cp.id
      )
      and not exists (
        select 1 from public.campaign_invitations i
        where i.campaign_id = p_campaign_id and i.creator_id = cp.id
      )
  loop
    -- At most 30 invitations per campaign: invitations are for good fits,
    -- not for broadcasting.
    exit when v_existing + v_invited >= 30;

    insert into public.campaign_invitations (campaign_id, creator_id, source, invited_by)
    values (p_campaign_id, v_creator.id, p_source, auth.uid());

    perform public.create_notification(
      v_creator.user_id,
      'campaign_invitation',
      case
        when p_source = 'auto' then 'あなたの実績に合う新着PR案件'
        else coalesce(v_restaurant_name, '店舗') || 'からPR案件への招待'
      end,
      v_campaign.title || '・現金報酬¥' || to_char(v_campaign.cash_reward, 'FM999,999,999') ||
        '。案件一覧の「招待あり」から確認できます。'
    );

    v_invited := v_invited + 1;
  end loop;

  if v_invited > 0 then
    insert into public.audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, after_json)
    values (
      auth.uid(),
      case when public.is_admin() then 'admin'::public.user_role else 'restaurant'::public.user_role end,
      'campaign.invited',
      'campaign',
      p_campaign_id,
      jsonb_build_object('source', p_source, 'count', v_invited)
    );
  end if;

  return v_invited;
end;
$$;

revoke all on function public.invite_creators_to_campaign(uuid, uuid[], text) from public;
grant execute on function public.invite_creators_to_campaign(uuid, uuid[], text) to authenticated;

-- Completed PRs and no-shows per Creator, counts only.
create or replace function public.creator_track_records(p_creator_ids uuid[])
returns table (creator_id uuid, completed integer, no_shows integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cp.id,
    (
      select count(*)::integer
      from public.bookings b
      join public.applications a on a.id = b.application_id
      where b.creator_id = cp.id
        and a.status in ('approved', 'paid')
    ),
    (
      select count(*)::integer
      from public.bookings b
      where b.creator_id = cp.id
        and b.status = 'no_show'
    )
  from public.creator_profiles cp
  where cp.id = any(p_creator_ids)
    and public.can_view_creator_profile(cp.id);
$$;

revoke all on function public.creator_track_records(uuid[]) from public;
grant execute on function public.creator_track_records(uuid[]) to authenticated;
