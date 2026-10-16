create or replace function public.confirm_visit_on_deliverable_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.campaign_slots%rowtype;
begin
  if new.verification_status <> 'approved'
     or old.verification_status is not distinct from new.verification_status then
    return new;
  end if;

  select * into v_booking
  from public.bookings
  where id = new.booking_id
  for update;

  if not found
     or v_booking.status not in ('confirmed', 'reschedule_requested') then
    return new;
  end if;

  select * into v_slot
  from public.campaign_slots
  where id = v_booking.campaign_slot_id;

  if not found or v_slot.starts_at > now() then
    return new;
  end if;

  update public.bookings
  set
    status = 'visited',
    visited_at = coalesce(visited_at, now())
  where id = v_booking.id;

  update public.applications
  set status = 'visited'
  where id = v_booking.application_id
    and status in ('scheduled', 'reschedule_requested');

  return new;
end;
$$;

drop trigger if exists deliverables_confirm_visit_on_approval
on public.deliverables;

create trigger deliverables_confirm_visit_on_approval
after update of verification_status on public.deliverables
for each row execute function public.confirm_visit_on_deliverable_approval();
