-- Enforce trusted HTTPS social profile hosts at the database boundary.

create or replace function public.validate_creator_social_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if char_length(new.handle) = 0
     or char_length(new.handle) > 100
     or new.handle ~ '[[:space:]/]' then
    raise exception 'invalid_social_handle' using errcode = 'P0001';
  end if;

  if new.platform = 'instagram'
     and new.profile_url !~* '^https://(www\.)?instagram\.com(/|$)' then
    raise exception 'invalid_social_profile_url' using errcode = 'P0001';
  elsif new.platform = 'tiktok'
     and new.profile_url !~* '^https://(www\.)?tiktok\.com(/|$)' then
    raise exception 'invalid_social_profile_url' using errcode = 'P0001';
  elsif new.platform = 'youtube'
     and new.profile_url !~* '^https://(www\.)?youtube\.com(/|$)' then
    raise exception 'invalid_social_profile_url' using errcode = 'P0001';
  end if;

  if char_length(new.profile_url) > 2048 then
    raise exception 'invalid_social_profile_url' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists creator_social_validate
on public.creator_social_accounts;

create trigger creator_social_validate
before insert or update on public.creator_social_accounts
for each row execute function public.validate_creator_social_account();

alter table public.creator_social_accounts
  add constraint creator_social_followers_upper_bound
    check (followers <= 2000000000),
  add constraint creator_social_avg_views_upper_bound
    check (avg_views is null or avg_views <= 2000000000),
  add constraint creator_social_avg_saves_upper_bound
    check (avg_saves is null or avg_saves <= 2000000000);
