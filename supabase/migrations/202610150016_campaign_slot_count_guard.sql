-- Prevent a direct RPC caller from generating an unbounded number of visit slots.

create or replace function public.enforce_campaign_slot_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing integer;
begin
  select count(*)
    into v_existing
  from public.campaign_slots cs
  where cs.campaign_id = new.campaign_id;

  if v_existing >= 1000 then
    raise exception 'campaign_slot_limit_exceeded' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_slots_enforce_count
on public.campaign_slots;

create trigger campaign_slots_enforce_count
before insert on public.campaign_slots
for each row execute function public.enforce_campaign_slot_count();
