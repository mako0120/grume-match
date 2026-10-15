-- Account/safety notifications must still reach a suspended Creator by email.
-- Normal product notifications remain limited to active users.

create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_status public.account_status;
begin
  select u.email, u.status
    into v_email, v_status
  from public.users u
  where u.id = new.user_id;

  if nullif(trim(coalesce(v_email, '')), '') is null then
    return new;
  end if;

  if v_status <> 'active'
     and not (
       v_status = 'suspended'
       and new.type in ('participant_suspended', 'account_suspended')
     ) then
    return new;
  end if;

  insert into public.notification_email_outbox(
    notification_id,
    user_id,
    email,
    subject,
    body
  )
  values(
    new.id,
    new.user_id,
    trim(v_email),
    new.title,
    new.body
  )
  on conflict (notification_id) do nothing;

  return new;
end;
$$;


create or replace function public.notify_account_closure_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'processed' then
    perform public.create_notification(
      new.user_id,
      'account_suspended',
      'アカウントを停止しました',
      'ご依頼内容の確認が完了し、GOURMET DIARYのアカウント利用を停止しました。'
    );
  elsif old.status = 'pending' and new.status = 'dismissed' then
    perform public.create_notification(
      new.user_id,
      'account_closure_dismissed',
      'アカウント依頼を確認しました',
      '運営確認の結果、今回はアカウントを停止していません。必要な場合はサポートへお問い合わせください。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists account_closure_notify_result
on public.account_closure_requests;

create trigger account_closure_notify_result
after update of status on public.account_closure_requests
for each row execute function public.notify_account_closure_result();
