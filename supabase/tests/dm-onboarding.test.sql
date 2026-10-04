-- DM onboarding: Creator request pages and Restaurant offer invites.
do $$
declare
  p record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_page record;
  v_invite record;
  v_preview record;
  v_campaign uuid;
  v_count integer;
  v_new_user uuid;
  v_new_creator uuid;
begin
  select * into p from tests.seed_parties();

  -- 1. Request page: off by default, opt-in with a valid slug.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(
    'select public.set_creator_request_page(''No'', true)', 'invalid_request_slug');
  perform tests.assert_raises(
    'select public.set_creator_request_page(''admin'', true)', 'request_slug_reserved');
  if public.set_creator_request_page('Gourmet_Nisshi', false) <> 'gourmet_nisshi' then
    raise exception 'slug should be normalised';
  end if;

  perform tests.act_as_anon();
  select count(*) into v_count from public.get_creator_request_page('gourmet_nisshi');
  if v_count <> 0 then
    raise exception 'disabled page should not be public';
  end if;

  perform tests.act_as(p.other_creator_user_id);
  perform tests.assert_raises(
    'select public.set_creator_request_page(''gourmet_nisshi'', true)', 'request_slug_taken');

  perform tests.act_as(p.creator_user_id);
  perform public.set_creator_request_page('gourmet_nisshi', true);
  insert into public.creator_post_metrics (creator_id, platform, area, headline, posted_on, measured_on, views, likes, comments, reposts, shares)
  values
    (p.creator_id, 'instagram', '淡路市', '刺身', v_today - 21, v_today, 27000, 1106, 27, 12, 5),
    (p.creator_id, 'instagram', '北新地', '天麩羅', v_today - 14, v_today, 5446, 618, 2, 11, 0);
  perform tests.act_as_superuser();
  perform set_config('app.metrics_import_verified', 'on', true);
  update public.creator_post_metrics set verified_at = now()
  where creator_id = p.creator_id and area = '淡路市';
  perform set_config('app.metrics_import_verified', 'off', true);

  perform tests.act_as_anon();
  select * into v_page from public.get_creator_request_page(' Gourmet_Nisshi ');
  if v_page.display_name <> 'グルメ日誌' or jsonb_array_length(v_page.posts) <> 1
     or (v_page.posts -> 0 ->> 'views')::integer <> 27000 then
    raise exception 'public page should show verified posts only: %', row_to_json(v_page);
  end if;

  -- 2. Offer invite for a Creator who is not on the platform yet.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(format(
    'select * from public.create_offer_invite(%L, %L, %L, %L, %L, %L, 0, %L, %L, 0, %L, %L, %L, %L, %L)',
    p.restaurant_id, 'new_foodie', 't', '', '焼肉', '梅田', 'tax_included', '1名分提供',
    v_today, v_today + 10, now() + interval '9 days', array['instagram_reel'], tests.future_slot(3)),
    'not_authorized');

  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select * from public.create_offer_invite(%L, %L, %L, %L, %L, %L, 0, %L, %L, 0, %L, %L, %L, %L, %L)',
    p.restaurant_id, 'bad handle!', 't', '', '焼肉', '梅田', 'tax_included', '1名分提供',
    v_today, v_today + 10, now() + interval '9 days', array['instagram_reel'], tests.future_slot(3)),
    'invalid_instagram_handle');

  select * into v_invite from public.create_offer_invite(
    p.restaurant_id, '@New_Foodie', 'テスト食堂 食事招待', '厚切りタン', '焼肉', '梅田', 0,
    'tax_included', '1名分提供', 0, v_today, v_today + 10, now() + interval '9 days',
    array['instagram_reel'], tests.future_slot(3));

  if (select visibility from public.campaigns where id = v_invite.campaign_id) <> 'direct' then
    raise exception 'invite campaign must be direct';
  end if;

  -- Nobody else can see or apply to it.
  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.campaigns where id = v_invite.campaign_id) then
    raise exception 'invite campaign visible before claim';
  end if;

  -- Preview without signing in.
  perform tests.act_as_anon();
  select * into v_preview from public.get_offer_invite(upper(v_invite.token));
  if v_preview.restaurant_name <> 'テスト食堂' or v_preview.instagram_handle <> 'new_foodie'
     or v_preview.claimed or not v_preview.open or v_preview.campaign_id is not null then
    raise exception 'unexpected preview: %', row_to_json(v_preview);
  end if;

  -- Claim needs a Creator profile.
  v_new_user := tests.create_user('new-foodie-' || gen_random_uuid() || '@example.test');
  perform tests.act_as(v_new_user);
  perform tests.assert_raises(format('select public.claim_offer_invite(%L)', v_invite.token),
    'creator_profile_required');
  perform public.complete_creator_onboarding('新しい食べ歩き', '', '大阪');
  select id into v_new_creator from public.creator_profiles where user_id = v_new_user;

  v_campaign := public.claim_offer_invite(v_invite.token);
  if v_campaign <> v_invite.campaign_id then
    raise exception 'claim returned the wrong campaign';
  end if;
  -- Claiming again is a no-op for the same Creator.
  perform public.claim_offer_invite(v_invite.token);

  if not exists (select 1 from public.campaigns where id = v_campaign) then
    raise exception 'claimed campaign not visible to the Creator';
  end if;
  select * into v_preview from public.get_offer_invite(v_invite.token);
  if not v_preview.claimed_by_me or v_preview.campaign_id <> v_campaign then
    raise exception 'claimer should see own campaign id';
  end if;

  perform tests.act_as_superuser();
  if not exists (
    select 1 from public.notifications where user_id = v_new_user and type = 'direct_offer_received'
  ) then
    raise exception 'claimer should get the direct offer notification';
  end if;

  -- Another Creator cannot take it any more.
  perform tests.act_as(p.other_creator_user_id);
  perform tests.assert_raises(format('select public.claim_offer_invite(%L)', v_invite.token),
    'invite_already_claimed');

  -- The Restaurant sees the invite and who claimed it.
  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from public.offer_invites
  where id is not null and claimed_by_creator_id = v_new_creator;
  if v_count <> 1 then
    raise exception 'restaurant cannot see the claimed invite';
  end if;
end;
$$;
