-- Close expired recruitment while preserving already-confirmed bookings.

create or replace function public.reject_pending_applications_when_campaign_closes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('closed', 'filled', 'cancelled', 'suspended')
     and old.status is distinct from new.status then
    update public.applications
    set status = 'rejected'
    where campaign_id = new.id
      and status in ('applied', 'shortlisted', 'accepted');
  end if;

  return new;
end;
$$;
