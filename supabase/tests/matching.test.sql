-- Matching: invitations (manual / auto) and track records.
do $$
declare
  p record;
  v_other_shop uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_campaign uuid;
  v_direct uuid;
  v_slot uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_count integer;
  v_record record;
begin
  select * into p from tests.seed_parties();
  v_other_shop := tests.create_user('matching-other-shop-' || gen_random_uuid() || '@example.test');
  perform tests.act_as(v_other_shop);
  perform public.complete_restaurant_onboarding('別の店', '大阪市中央区', '難波');

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'テスト食堂 焼肉 PR募集', '', '焼肉', '梅田', 8000, 'tax_included',
    '1名分提供', 0, 2, v_today, v_today + 10, now() + interval '9 days',
    array['instagram_reel'], tests.future_slot(3));

  -- Invite two Creators; repeating is a no-op.
  if public.invite_creators_to_campaign(v_campaign, array[p.creator_id, p.other_creator_id], 'auto') <> 2 then
    raise exception 'expected 2 invitations';
  end if;
  if public.invite_creators_to_campaign(v_campaign, array[p.creator_id], 'restaurant') <> 0 then
    raise exception 'duplicate invitation';
  end if;

  perform tests.assert_raises(format(
    'select public.invite_creators_to_campaign(%L, %L)', v_campaign,
    (select array_agg(gen_random_uuid()) from generate_series(1, 11))), 'too_many_invitations');

  -- Another Restaurant cannot invite to this campaign.
  perform tests.act_as(v_other_shop);
  perform tests.assert_raises(format(
    'select public.invite_creators_to_campaign(%L, %L)', v_campaign, array[p.creator_id]), 'not_authorized');
  if exists (select 1 from public.campaign_invitations where campaign_id = v_campaign) then
    raise exception 'invitations leaked to another restaurant';
  end if;

  -- Creators see only their own invitation, with a notification.
  perform tests.act_as(p.creator_user_id);
  select count(*) into v_count from public.campaign_invitations;
  if v_count <> 1 then
    raise exception 'creator should see exactly 1 invitation, saw %', v_count;
  end if;
  perform tests.act_as_superuser();
  if not exists (
    select 1 from public.notifications
    where user_id = p.creator_user_id and type = 'campaign_invitation'
      and title = 'あなたの実績に合う新着PR案件'
  ) then
    raise exception 'creator not notified about the invitation';
  end if;

  -- Direct OFFERs are not open for invitations; applicants are skipped.
  perform tests.act_as(p.restaurant_user_id);
  v_direct := public.create_direct_offer_with_slots(
    p.restaurant_id, p.creator_id, '指名', '', 'グルメ', '梅田', 8000, 'tax_included',
    '1名分提供', 0, v_today, v_today + 5, now() + interval '4 days',
    array['instagram_reel'], tests.future_slot(5));
  perform tests.assert_raises(format(
    'select public.invite_creators_to_campaign(%L, %L)', v_direct, array[p.other_creator_id]),
    'campaign_not_inviting');

  -- Track record: complete one PR for the Creator.
  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;
  perform tests.act_as(p.creator_user_id);
  perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);
  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(
    (select id from public.applications where campaign_id = v_campaign and creator_id = p.creator_id), v_slot);
  perform tests.act_as(p.creator_user_id);
  select id into v_deliverable from public.deliverables where booking_id = v_booking;
  perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/x/');
  perform tests.act_as(p.restaurant_user_id);
  perform public.review_deliverable(v_deliverable, true, null);

  -- Restaurants see counts only.
  select * into v_record from public.creator_track_records(array[p.creator_id, p.other_creator_id])
  where creator_id = p.creator_id;
  if v_record.completed <> 1 or v_record.no_shows <> 0 then
    raise exception 'unexpected track record: %', row_to_json(v_record);
  end if;

  perform tests.act_as_superuser();
  update public.bookings set status = 'no_show' where id = v_booking;
  perform tests.act_as(v_other_shop);
  select * into v_record from public.creator_track_records(array[p.creator_id])
  where creator_id = p.creator_id;
  if v_record.no_shows <> 1 then
    raise exception 'no-show not counted: %', row_to_json(v_record);
  end if;

  -- Other Creators and anonymous visitors get nothing.
  perform tests.act_as(p.other_creator_user_id);
  select count(*) into v_count from public.creator_track_records(array[p.creator_id]);
  if v_count <> 0 then
    raise exception 'track record leaked to another creator';
  end if;
  perform tests.act_as_anon();
  select count(*) into v_count from public.creator_track_records(array[p.creator_id]);
  if v_count <> 0 then
    raise exception 'track record leaked to anonymous visitors';
  end if;
end;
$$;
