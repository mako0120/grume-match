-- Preserve recruitment state when the first Creator visits a multi-Creator campaign.
-- Only a fully-filled campaign should automatically move to in_progress.

create or replace function public.guard_campaign_progress_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'in_progress'
     and old.status in ('published', 'recruiting', 'closed') then
    new.status := old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_guard_progress_transition
on public.campaigns;

create trigger campaigns_guard_progress_transition
before update of status on public.campaigns
for each row execute function public.guard_campaign_progress_transition();
