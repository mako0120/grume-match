-- Notify the selected Creator when a restaurant creates a private direct offer.

create or replace function public.notify_direct_offer_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_campaign_title text;
  v_restaurant_name text;
begin
  select cp.user_id
    into v_user_id
  from public.creator_profiles cp
  where cp.id = new.creator_id;

  select c.title, r.name
    into v_campaign_title, v_restaurant_name
  from public.campaigns c
  join public.restaurants r on r.id = c.restaurant_id
  where c.id = new.campaign_id;

  if v_user_id is not null then
    perform public.create_notification(
      v_user_id,
      'direct_offer_received',
      '店舗から指名PRが届きました',
      coalesce(v_restaurant_name, '店舗') || 'から「' ||
        coalesce(v_campaign_title, '有償PR') || '」の指名オファーが届きました。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_targets_notify_insert
on public.campaign_target_creators;

create trigger campaign_targets_notify_insert
after insert on public.campaign_target_creators
for each row execute function public.notify_direct_offer_target();
