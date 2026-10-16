create or replace function public.prevent_creator_self_visit_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
begin
  if new.status = 'visited'
     and old.status in ('confirmed', 'reschedule_requested') then
    select cp.user_id
      into v_creator_user_id
    from public.creator_profiles cp
    where cp.id = old.creator_id;

    if v_creator_user_id = auth.uid() and not public.is_admin() then
      new.status := old.status;
      new.visited_at := old.visited_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_prevent_creator_self_visit
on public.bookings;

create trigger bookings_prevent_creator_self_visit
before update of status on public.bookings
for each row execute function public.prevent_creator_self_visit_confirmation();
