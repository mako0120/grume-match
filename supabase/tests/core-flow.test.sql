-- Baseline: MARKET campaign → Tap Schedule application → booking →
-- deliverable URL → approval → payment approved.
do $$
declare
  p record;
  v_campaign uuid;
  v_slot uuid;
  v_application uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_payment_status text;
begin
  select * into p from tests.seed_parties();

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'テスト食堂 焼肉 PR募集', '', '焼肉', '梅田',
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

  perform tests.act_as(p.creator_user_id);
  select id into v_deliverable from public.deliverables where booking_id = v_booking;
  if v_deliverable is null then
    raise exception 'creator cannot see own deliverable';
  end if;
  perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/abc/');

  perform tests.act_as(p.restaurant_user_id);
  perform public.review_deliverable(v_deliverable, true, null);

  perform tests.act_as_superuser();
  select status into v_payment_status from public.payments where booking_id = v_booking;
  if v_payment_status <> 'approved' then
    raise exception 'expected approved payment, got %', v_payment_status;
  end if;

  -- The other Creator must not see this booking.
  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.bookings where id = v_booking) then
    raise exception 'booking leaked to another creator';
  end if;
end;
$$;
