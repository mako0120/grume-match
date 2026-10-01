-- Automatic lifecycle notifications and payment due dates.

create or replace function public.notify_new_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_creator_name text;
  v_target_user_id uuid;
begin
  select * into v_campaign
  from public.campaigns
  where id = new.campaign_id;

  select cp.display_name into v_creator_name
  from public.creator_profiles cp
  where cp.id = new.creator_id;

  select rm.user_id into v_target_user_id
  from public.restaurant_memberships rm
  where rm.restaurant_id = v_campaign.restaurant_id
  order by case rm.role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1;

  if v_target_user_id is not null then
    perform public.create_notification(
      v_target_user_id,
      'application_received',
      '新しいPR応募',
      coalesce(v_creator_name, 'Creator') || 'さんが案件に応募しました。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists applications_notify_insert on public.applications;
create trigger applications_notify_insert
after insert on public.applications
for each row execute function public.notify_new_application();

create or replace function public.notify_booking_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
  v_campaign_title text;
begin
  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = new.creator_id;

  select c.title into v_campaign_title
  from public.campaigns c
  where c.id = new.campaign_id;

  if v_creator_user_id is not null then
    perform public.create_notification(
      v_creator_user_id,
      'booking_confirmed',
      'PR来店日時が確定しました',
      coalesce(v_campaign_title, 'PR案件') || 'の来店日時が確定しました。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_notify_insert on public.bookings;
create trigger bookings_notify_insert
after insert on public.bookings
for each row execute function public.notify_booking_confirmed();

create or replace function public.set_payment_due_on_approval()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.due_at := coalesce(new.due_at, now() + interval '14 days');
  end if;
  return new;
end;
$$;

drop trigger if exists payments_set_due_on_approval on public.payments;
create trigger payments_set_due_on_approval
before update on public.payments
for each row execute function public.set_payment_due_on_approval();

create or replace function public.notify_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = new.creator_id;

  if v_creator_user_id is null then
    return new;
  end if;

  if new.status = 'approved' then
    v_title := '報酬が承認されました';
    v_body := '¥' || new.amount::text || ' の報酬が支払承認済みになりました。';
  elsif new.status = 'scheduled' then
    v_title := '報酬の振込予定が決まりました';
    v_body := '¥' || new.amount::text || ' の報酬が振込予定です。';
  elsif new.status = 'paid' then
    v_title := '報酬が支払済みになりました';
    v_body := '¥' || new.amount::text || ' の報酬支払いが完了しました。';
  elsif new.status = 'failed' then
    v_title := '報酬支払いの確認が必要です';
    v_body := '支払い処理に確認が必要です。';
  else
    return new;
  end if;

  perform public.create_notification(
    v_creator_user_id,
    'payment_' || new.status::text,
    v_title,
    v_body
  );

  return new;
end;
$$;

drop trigger if exists payments_notify_status_change on public.payments;
create trigger payments_notify_status_change
after update on public.payments
for each row execute function public.notify_payment_status_change();

create or replace function public.notify_deliverable_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_user_id uuid;
  v_booking_creator_id uuid;
begin
  if new.verification_status is not distinct from old.verification_status then
    return new;
  end if;

  select b.creator_id into v_booking_creator_id
  from public.bookings b
  where b.id = new.booking_id;

  select cp.user_id into v_creator_user_id
  from public.creator_profiles cp
  where cp.id = v_booking_creator_id;

  if v_creator_user_id is null then
    return new;
  end if;

  if new.verification_status = 'approved' then
    perform public.create_notification(
      v_creator_user_id,
      'deliverable_approved',
      '投稿が承認されました',
      '店舗による投稿確認が完了しました。'
    );
  elsif new.verification_status = 'rejected' then
    perform public.create_notification(
      v_creator_user_id,
      'deliverable_revision_requested',
      '投稿の修正依頼があります',
      coalesce(new.verification_note, '店舗から修正依頼が届きました。')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists deliverables_notify_review on public.deliverables;
create trigger deliverables_notify_review
after update on public.deliverables
for each row execute function public.notify_deliverable_review();
