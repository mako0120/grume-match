-- Meal-only invitations (食事招待).
--
-- Restaurants can now choose between a meal-only invitation (cash reward
-- ¥0) and a meal plus cash reward. Both are advertising: the PR disclosure
-- rules and the platform fee (¥2,000 minimum) apply either way.

drop trigger if exists campaigns_require_positive_cash_reward on public.campaigns;
drop function if exists public.enforce_paid_campaign();

-- Nothing to transfer for a ¥0 payment: completing the PR settles it.
create or replace function public.settle_zero_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount = 0 and new.status = 'approved' and old.status = 'pending' then
    new.status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists payments_settle_zero on public.payments;
create trigger payments_settle_zero
before update of status on public.payments
for each row execute function public.settle_zero_payment();

-- No "¥0 の報酬…" notifications for meal-only PRs.
drop trigger if exists payments_notify_status_change on public.payments;
create trigger payments_notify_status_change
after update on public.payments
for each row
when (new.amount > 0)
execute function public.notify_payment_status_change();
