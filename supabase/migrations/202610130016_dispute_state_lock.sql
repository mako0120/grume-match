-- Freeze transaction state while an exception is under Admin review.

create or replace function public.has_open_booking_dispute(target_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.booking_disputes bd
    where bd.booking_id = target_booking_id
      and bd.status = 'open'
  );
$$;

create or replace function public.protect_disputed_booking_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and public.has_open_booking_dispute(old.id)
     and not public.is_admin() then
    raise exception 'booking_locked_by_dispute' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_protect_dispute
on public.bookings;

create trigger bookings_protect_dispute
before update of status on public.bookings
for each row execute function public.protect_disputed_booking_state();


create or replace function public.protect_disputed_application_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
begin
  if old.status = 'dispute'
     and new.status is distinct from old.status
     and not public.is_admin() then
    select b.id into v_booking_id
    from public.bookings b
    where b.application_id = old.id;

    if v_booking_id is not null
       and public.has_open_booking_dispute(v_booking_id) then
      raise exception 'application_locked_by_dispute' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_protect_dispute
on public.applications;

create trigger applications_protect_dispute
before update of status on public.applications
for each row execute function public.protect_disputed_application_state();


create or replace function public.protect_disputed_payment_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status <> 'on_hold'
     and public.has_open_booking_dispute(old.booking_id)
     and not public.is_admin() then
    raise exception 'payment_locked_by_dispute' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_protect_dispute
on public.payments;

create trigger payments_protect_dispute
before update of status on public.payments
for each row execute function public.protect_disputed_payment_state();

revoke all on function public.has_open_booking_dispute(uuid) from public;
grant execute on function public.has_open_booking_dispute(uuid) to authenticated;
