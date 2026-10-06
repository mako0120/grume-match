-- Calendar export (.ics) reads exactly what app/bookings/[id]/calendar.ics
-- selects, with the viewer's own session: both booking parties see the visit
-- slot, Restaurant name/address and Creator; nobody else sees the booking.
do $$
declare
  p record;
  v_campaign uuid;
  v_slot uuid;
  v_application uuid;
  v_booking uuid;
  v_outsider uuid;
  v_starts timestamptz;
  v_address text;
  v_creator_user uuid;
  v_display_name text;
begin
  select * into p from tests.seed_parties();

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'カレンダー連携 PR', '', '焼肉', '梅田',
    6000, 'tax_included', '1名分提供', 0, 2,
    (now() at time zone 'Asia/Tokyo')::date,
    (now() at time zone 'Asia/Tokyo')::date + 10,
    now() + interval '9 days',
    array['instagram_reel'],
    tests.future_slot(3)
  );
  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;

  perform tests.act_as(p.creator_user_id);
  v_application := public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);

  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(v_application, v_slot);

  -- Creator: own booking with slot, Restaurant address and own profile.
  perform tests.act_as(p.creator_user_id);
  select s.starts_at, r.address, cp.user_id
    into v_starts, v_address, v_creator_user
  from public.bookings b
  join public.campaign_slots s on s.id = b.campaign_slot_id
  join public.campaigns c on c.id = b.campaign_id
  join public.restaurants r on r.id = c.restaurant_id
  join public.creator_profiles cp on cp.id = b.creator_id
  where b.id = v_booking and b.status = 'confirmed';
  if v_starts is null or v_address is null then
    raise exception 'creator cannot read calendar fields of own booking';
  end if;
  if v_creator_user <> p.creator_user_id then
    raise exception 'creator is not recognised as the booking creator';
  end if;

  -- Restaurant member: same booking, plus the Creator's display name, and is
  -- not mistaken for the Creator.
  perform tests.act_as(p.restaurant_user_id);
  select s.starts_at, cp.user_id, cp.display_name
    into v_starts, v_creator_user, v_display_name
  from public.bookings b
  join public.campaign_slots s on s.id = b.campaign_slot_id
  join public.creator_profiles cp on cp.id = b.creator_id
  where b.id = v_booking;
  if v_starts is null or v_display_name is null then
    raise exception 'restaurant cannot read calendar fields of its booking';
  end if;
  if v_creator_user = p.restaurant_user_id then
    raise exception 'restaurant member resolved as the booking creator';
  end if;

  -- Another Creator and an unrelated user get nothing.
  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.bookings where id = v_booking) then
    raise exception 'booking leaked to another creator';
  end if;

  v_outsider := tests.create_user('calendar-outsider@example.com');
  perform tests.act_as(v_outsider);
  if exists (select 1 from public.bookings where id = v_booking) then
    raise exception 'booking leaked to an unrelated user';
  end if;

  perform tests.act_as_anon();
  if exists (select 1 from public.bookings where id = v_booking) then
    raise exception 'booking leaked to an anonymous visitor';
  end if;
end;
$$;
