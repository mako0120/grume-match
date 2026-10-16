create or replace function public.prevent_creator_self_application_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
begin
  if new.status = 'visited'
     and old.status in ('scheduled', 'reschedule_requested') then
    select cp.user_id
      into v_creator_user_id
    from public.creator_profiles cp
    where cp.id = old.creator_id;

    if v_creator_user_id = auth.uid() and not public.is_admin() then
      new.status := old.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_prevent_creator_self_visit
on public.applications;

create trigger applications_prevent_creator_self_visit
before update of status on public.applications
for each row execute function public.prevent_creator_self_application_visit();
