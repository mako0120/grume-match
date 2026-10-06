-- Platform fee: only on completed PRs, 20% (min ¥2,000), first PR free,
-- status managed by the Operator only. Meal-only invitations (¥0 reward)
-- can be published, settle without a transfer and pay the ¥2,000 minimum.
do $$
declare
  p record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_campaign uuid;
  v_slot uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_fee record;
  v_count integer;
  i integer;
  v_bookings uuid[] := '{}';
begin
  select * into p from tests.seed_parties();

  if public.platform_fee_for(8000) <> 2000 or public.platform_fee_for(15000) <> 3000
     or public.platform_fee_for(0) <> 2000 then
    raise exception 'unexpected fee formula';
  end if;

  -- Three PRs: two completed (first free, second charged), one not completed.
  for i in 1..3 loop
    perform tests.act_as(p.restaurant_user_id);
    v_campaign := public.create_campaign_with_slots(
      p.restaurant_id, 'テスト食堂 PR ' || i, '', '焼肉', '梅田', 15000, 'tax_included',
      '1名分提供', 0, 1, v_today, v_today + 10, now() + interval '9 days',
      array['instagram_reel'], tests.future_slot(2 + i));
    select id into v_slot from public.campaign_slots where campaign_id = v_campaign;
    perform tests.act_as(p.creator_user_id);
    perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);
    perform tests.act_as(p.restaurant_user_id);
    v_booking := public.confirm_booking(
      (select id from public.applications where campaign_id = v_campaign), v_slot);
    v_bookings := v_bookings || v_booking;

    if i < 3 then
      perform tests.act_as(p.creator_user_id);
      select id into v_deliverable from public.deliverables where booking_id = v_booking;
      perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/' || i || '/', true);
      perform tests.act_as(p.restaurant_user_id);
      perform public.review_deliverable(v_deliverable, true, null);
    end if;
  end loop;

  perform tests.act_as(p.restaurant_user_id);
  select * into v_fee from public.platform_fees where booking_id = v_bookings[1];
  if v_fee.status <> 'waived' or v_fee.fee <> 0 then
    raise exception 'first PR should be free: %', row_to_json(v_fee);
  end if;
  select * into v_fee from public.platform_fees where booking_id = v_bookings[2];
  if v_fee.status <> 'pending' or v_fee.fee <> 3000 or v_fee.base_amount <> 15000 then
    raise exception 'second PR fee wrong: %', row_to_json(v_fee);
  end if;
  if exists (select 1 from public.platform_fees where booking_id = v_bookings[3]) then
    raise exception 'uncompleted PR must not be charged';
  end if;

  -- The Creator's payment is untouched.
  if (select amount from public.payments where booking_id = v_bookings[2]) <> 15000 then
    raise exception 'creator payment changed';
  end if;

  -- Re-approving does not double charge.
  perform tests.act_as_superuser();
  update public.payments set status = 'pending' where booking_id = v_bookings[2];
  update public.payments set status = 'approved' where booking_id = v_bookings[2];
  select count(*) into v_count from public.platform_fees where booking_id = v_bookings[2];
  if v_count <> 1 then
    raise exception 'fee recorded twice';
  end if;

  -- Meal-only invitation: ¥0 reward is allowed and completes like any PR.
  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'テスト食堂 食事招待', '', '焼肉', '梅田', 0, 'tax_included',
    '1名分提供', 0, 1, v_today, v_today + 10, now() + interval '9 days',
    array['instagram_reel'], tests.future_slot(7));
  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;
  perform tests.act_as(p.creator_user_id);
  perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);
  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(
    (select id from public.applications where campaign_id = v_campaign), v_slot);
  perform tests.act_as(p.creator_user_id);
  select id into v_deliverable from public.deliverables where booking_id = v_booking;
  perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/meal/', true);
  perform tests.act_as(p.restaurant_user_id);
  perform public.review_deliverable(v_deliverable, true, null);

  perform tests.act_as_superuser();
  if (select status from public.payments where booking_id = v_booking) <> 'paid' then
    raise exception 'meal-only payment should settle as paid';
  end if;
  if exists (
    select 1 from public.notifications
    where user_id = p.creator_user_id and type like 'payment_%' and body like '¥0 %'
  ) then
    raise exception 'creator notified about a ¥0 payment';
  end if;
  select * into v_fee from public.platform_fees where booking_id = v_booking;
  if v_fee.fee <> 2000 or v_fee.status <> 'pending' then
    raise exception 'meal-only fee wrong: %', row_to_json(v_fee);
  end if;
  select * into v_fee from public.platform_fees where booking_id = v_bookings[2];

  -- Restaurants and Creators cannot change status; others cannot see fees.
  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select public.set_platform_fee_status(%L, %L)', array[v_fee.id], 'paid'), 'not_authorized');
  update public.platform_fees set status = 'paid' where id = v_fee.id;
  perform tests.act_as(p.creator_user_id);
  select count(*) into v_count from public.platform_fees;
  if v_count <> 0 then
    raise exception 'creator can see platform fees';
  end if;

  -- Operator: invoiced → paid; waived stays waived.
  perform tests.act_as_superuser();
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  if public.set_platform_fee_status(
       array[v_fee.id, (select id from public.platform_fees where booking_id = v_bookings[1])],
       'invoiced') <> 1 then
    raise exception 'only the pending fee should be invoiced';
  end if;
  if public.set_platform_fee_status(array[v_fee.id], 'paid') <> 1 then
    raise exception 'invoiced fee should become paid';
  end if;
  perform tests.assert_raises(format(
    'select public.set_platform_fee_status(%L, %L)', array[v_fee.id], 'waived'), 'invalid_fee_status');
  perform set_config('request.jwt.claims', '', true);

  select * into v_fee from public.platform_fees where id = v_fee.id;
  if v_fee.status <> 'paid' or v_fee.invoiced_at is null or v_fee.paid_at is null then
    raise exception 'unexpected final fee: %', row_to_json(v_fee);
  end if;
end;
$$;
