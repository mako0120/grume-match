-- Keep no-show exceptions out of the permanent Admin inbox after review.

alter table public.bookings
  add column if not exists no_show_reviewed_at timestamptz,
  add column if not exists no_show_reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists no_show_review_note text;

create or replace function public.review_booking_no_show(
  p_booking_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_booking.status <> 'no_show' then
    raise exception 'booking_not_no_show' using errcode = 'P0001';
  end if;

  if v_booking.no_show_reviewed_at is not null then
    return;
  end if;

  update public.bookings
  set
    no_show_reviewed_at = now(),
    no_show_reviewed_by = auth.uid(),
    no_show_review_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_booking_id;

  insert into public.audit_logs(
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  )
  values(
    auth.uid(),
    'admin',
    'booking.no_show_reviewed',
    'booking',
    p_booking_id,
    jsonb_build_object('reviewed_at', v_booking.no_show_reviewed_at),
    jsonb_build_object(
      'reviewed_at', now(),
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );
end;
$$;

revoke all on function public.review_booking_no_show(uuid, text) from public;
grant execute on function public.review_booking_no_show(uuid, text) to authenticated;
