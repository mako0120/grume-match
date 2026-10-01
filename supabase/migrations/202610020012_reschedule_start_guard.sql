-- Prevent reschedule requests after the original PR visit has started.

create or replace function public.validate_reschedule_request_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_start timestamptz;
begin
  select cs.starts_at
    into v_current_start
  from public.bookings b
  join public.campaign_slots cs on cs.id = b.campaign_slot_id
  where b.id = new.booking_id;

  if v_current_start is null then
    raise exception 'booking_slot_not_found' using errcode = 'P0002';
  end if;

  if v_current_start <= now() then
    raise exception 'booking_already_started' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reschedule_requests_validate_original_time
on public.booking_reschedule_requests;

create trigger reschedule_requests_validate_original_time
before insert on public.booking_reschedule_requests
for each row execute function public.validate_reschedule_request_time();
