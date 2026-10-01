-- Notify the Restaurant when a Creator submits or resubmits a deliverable.

create or replace function public.notify_deliverable_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_campaign public.campaigns%rowtype;
  v_creator_name text;
  v_target_user_id uuid;
begin
  if new.submitted_url is null then
    return new;
  end if;

  if old.submitted_at is not distinct from new.submitted_at
     and old.submitted_url is not distinct from new.submitted_url then
    return new;
  end if;

  select *
    into v_booking
  from public.bookings b
  where b.id = new.booking_id;

  if not found then
    return new;
  end if;

  select *
    into v_campaign
  from public.campaigns c
  where c.id = v_booking.campaign_id;

  select cp.display_name
    into v_creator_name
  from public.creator_profiles cp
  where cp.id = v_booking.creator_id;

  select rm.user_id
    into v_target_user_id
  from public.restaurant_memberships rm
  join public.users u on u.id = rm.user_id
  where rm.restaurant_id = v_campaign.restaurant_id
    and u.status = 'active'
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  if v_target_user_id is not null then
    perform public.create_notification(
      v_target_user_id,
      'deliverable_submitted',
      'PR投稿が提出されました',
      coalesce(v_creator_name, 'Creator') || 'さんの投稿を確認してください。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists deliverables_notify_submission
on public.deliverables;

create trigger deliverables_notify_submission
after update of submitted_url, submitted_at on public.deliverables
for each row execute function public.notify_deliverable_submission();
