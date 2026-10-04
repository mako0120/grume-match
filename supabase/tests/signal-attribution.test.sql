-- P3-01 SIGNAL: tracking link → anonymous landing views → Restaurant-recorded
-- visits → ROI aggregates, with privacy and retention rules.
do $$
declare
  p record;
  v_other_shop_user uuid;
  v_campaign uuid;
  v_slot uuid;
  v_booking uuid;
  v_code text;
  v_landing record;
  v_summary record;
  v_creator_summary record;
  v_visit uuid;
  v_count integer;
  i integer;
begin
  select * into p from tests.seed_parties();

  v_other_shop_user := tests.create_user('signal-other-shop@example.test');
  perform tests.act_as(v_other_shop_user);
  perform public.complete_restaurant_onboarding('別の店', '大阪市中央区', '難波');

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'テスト食堂 焼肉 PR募集', '', '焼肉', '梅田', 6000,
    'tax_included', '1名分提供', 0, 1, (now() at time zone 'Asia/Tokyo')::date,
    (now() at time zone 'Asia/Tokyo')::date + 10, now() + interval '9 days',
    array['instagram_reel'], tests.future_slot(3)
  );
  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;

  perform tests.act_as(p.creator_user_id);
  perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);

  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(
    (select id from public.applications where campaign_id = v_campaign), v_slot);

  -- Booking confirmation issues a readable 8-character code.
  perform tests.act_as(p.creator_user_id);
  select code into v_code from public.tracking_links where booking_id = v_booking;
  if v_code is null or v_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'creator has no valid tracking code: %', v_code;
  end if;

  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.tracking_links where booking_id = v_booking) then
    raise exception 'tracking link leaked to another creator';
  end if;

  -- Anonymous visitors: landing data and views only through RPCs.
  perform tests.act_as_anon();
  select * into v_landing from public.get_signal_landing(lower(v_code));
  if v_landing.restaurant_name <> 'テスト食堂'
     or v_landing.creator_name <> 'グルメ日誌' then
    raise exception 'unexpected landing data: %', row_to_json(v_landing);
  end if;

  if exists (select 1 from public.tracking_links)
     or exists (select 1 from public.signal_events) then
    raise exception 'anonymous visitors can read tracking tables';
  end if;

  if not public.record_signal_view(v_code) then
    raise exception 'landing view not recorded';
  end if;

  if public.record_signal_view('ZZZZZZZZ') then
    raise exception 'unknown code should not record';
  end if;
  -- Visits are recorded by the Restaurant only, never from the landing page.
  perform tests.assert_raises(
    format('select public.record_signal_visit(%L)', v_code),
    'authentication_required');

  -- Throttle: at most 30 views per link per minute.
  for i in 1..29 loop
    perform public.record_signal_view(v_code);
  end loop;
  if public.record_signal_view(v_code) then
    raise exception 'throttle did not stop the 31st view';
  end if;

  -- Restaurant records visits from the spoken code (any formatting).
  perform tests.act_as(p.restaurant_user_id);
  v_visit := public.record_signal_visit(
    lower(substr(v_code, 1, 4)) || '-' || substr(v_code, 5), 4);
  perform public.record_signal_visit(
    v_code, 2, 12000, (now() at time zone 'Asia/Tokyo')::date - 1);

  perform tests.assert_raises(
    format('select public.record_signal_visit(%L, 1, null, %L)',
      v_code, (now() at time zone 'Asia/Tokyo')::date + 1),
    'invalid_signal_date');
  perform tests.assert_raises(
    format('select public.record_signal_visit(%L, 0)', v_code),
    'invalid_party_size');
  perform tests.assert_raises(
    format('select public.record_signal_visit(%L, 2, -1)', v_code),
    'invalid_revenue');

  -- Mistakes can be voided; voided events drop out of the aggregates.
  perform public.void_signal_visit(v_visit);
  perform public.void_signal_visit(v_visit);

  select * into v_summary
  from public.restaurant_signal_summary()
  where booking_id = v_booking;

  if v_summary.cost_yen <> 6000
     or v_summary.landing_views <> 30
     or v_summary.visits <> 1
     or v_summary.visit_guests <> 2
     or v_summary.revenue_yen <> 12000 then
    raise exception 'unexpected restaurant summary: %', row_to_json(v_summary);
  end if;

  -- Another Restaurant can neither record against nor read this link.
  perform tests.act_as(v_other_shop_user);
  perform tests.assert_raises(
    format('select public.record_signal_visit(%L)', v_code),
    'signal_code_not_found');
  perform tests.assert_raises(
    format('select public.void_signal_visit(%L)', v_visit),
    'signal_event_not_found');
  select count(*) into v_count from public.restaurant_signal_summary();
  if v_count <> 0 then
    raise exception 'summary leaked to another restaurant';
  end if;
  select count(*) into v_count from public.signal_events;
  if v_count <> 0 then
    raise exception 'signal events leaked to another restaurant';
  end if;

  -- The Creator sees counts for their booking but not spend or raw rows.
  perform tests.act_as(p.creator_user_id);
  select * into v_creator_summary from public.creator_signal_summary(v_booking);
  if v_creator_summary.landing_views <> 30
     or v_creator_summary.visits <> 1 then
    raise exception 'unexpected creator summary: %', row_to_json(v_creator_summary);
  end if;
  select count(*) into v_count from public.signal_events;
  if v_count <> 0 then
    raise exception 'creator can read raw signal events';
  end if;

  perform tests.act_as(p.other_creator_user_id);
  select count(*) into v_count from public.creator_signal_summary(v_booking);
  if v_count <> 0 then
    raise exception 'creator summary leaked to another creator';
  end if;

  -- Retention: only the service role purges, and only events older than 13 months.
  perform tests.assert_raises('select public.purge_expired_signal_events()', 'permission denied');

  perform tests.act_as_superuser();
  insert into public.signal_events (tracking_link_id, kind, occurred_at, created_at)
  select id, 'landing_view', now() - interval '14 months', now() - interval '14 months'
  from public.tracking_links where booking_id = v_booking;

  if public.purge_expired_signal_events() <> 1 then
    raise exception 'purge should delete exactly the expired event';
  end if;

  -- Cancelling the booking retires the link.
  update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking;

  perform tests.act_as_anon();
  select count(*) into v_count from public.get_signal_landing(v_code);
  if v_count <> 0 then
    raise exception 'cancelled booking still has a landing page';
  end if;
  if public.record_signal_view(v_code) then
    raise exception 'cancelled booking still records views';
  end if;
end;
$$;
