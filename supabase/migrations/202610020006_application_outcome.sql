-- Close the loop for unselected applicants.
-- When recruitment ends, pending applicants should not remain "applied" forever.

create or replace function public.reject_pending_applications_when_campaign_closes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('filled', 'cancelled', 'suspended')
     and old.status is distinct from new.status then
    update public.applications
    set status = 'rejected'
    where campaign_id = new.id
      and status in ('applied', 'shortlisted', 'accepted');
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_reject_pending_applications
on public.campaigns;

create trigger campaigns_reject_pending_applications
after update of status on public.campaigns
for each row execute function public.reject_pending_applications_when_campaign_closes();

create or replace function public.notify_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
  v_campaign_title text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status <> 'rejected' then
    return new;
  end if;

  select cp.user_id
    into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = new.creator_id;

  select c.title
    into v_campaign_title
  from public.campaigns c
  where c.id = new.campaign_id;

  if v_creator_user_id is not null then
    perform public.create_notification(
      v_creator_user_id,
      'application_rejected',
      'PR案件の募集結果',
      coalesce(v_campaign_title, 'PR案件') || 'は今回は見送りとなりました。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists applications_notify_status_change
on public.applications;

create trigger applications_notify_status_change
after update of status on public.applications
for each row execute function public.notify_application_status_change();
