-- Every live PR campaign on this product is a paid campaign.

create or replace function public.enforce_paid_campaign()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('published', 'recruiting', 'filled', 'in_progress', 'completed')
     and new.cash_reward <= 0 then
    raise exception 'cash_reward_must_be_positive' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_require_positive_cash_reward on public.campaigns;

create trigger campaigns_require_positive_cash_reward
before insert or update of cash_reward, status
on public.campaigns
for each row execute function public.enforce_paid_campaign();
