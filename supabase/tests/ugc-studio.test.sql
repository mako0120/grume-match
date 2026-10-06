-- P2-03 UGC STUDIO: usage terms, license snapshot, fee, UGC upload and
-- time-limited Restaurant access.
do $$
declare
  p record;
  v_other_shop_user uuid;
  v_campaign uuid;
  v_slot uuid;
  v_application uuid;
  v_booking uuid;
  v_reel uuid;
  v_photo uuid;
  v_path text;
  v_asset uuid;
  v_spare_asset uuid;
  v_amount integer;
  v_license record;
  v_count integer;
  v_period_start date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select * into p from tests.seed_parties();

  v_other_shop_user := tests.create_user('other-shop@example.test');
  perform tests.act_as(v_other_shop_user);
  perform public.complete_restaurant_onboarding('別の店', '大阪市中央区', '難波');

  -- UGC without usage terms is rejected at commit time.
  perform tests.act_as(p.restaurant_user_id);
  begin
    perform public.create_campaign_with_slots(
      p.restaurant_id, 'UGCのみ', '', 'カフェ', '梅田', 5000, 'tax_included',
      '1名分提供', 0, 1, v_period_start, v_period_start + 10,
      now() + interval '9 days', array['ugc_photo'], tests.future_slot(3)
    );
    set constraints all immediate;
    raise exception 'expected usage_rights_required_for_ugc';
  exception when others then
    if position('usage_rights_required_for_ugc' in sqlerrm) = 0 then
      raise;
    end if;
  end;
  set constraints all deferred;

  -- Paid ads use must carry a fee; terms must be 30/90/365 days.
  perform tests.assert_raises(format(
    $sql$select public.create_campaign_with_slots(%L, 't', '', 'カフェ', '梅田', 5000,
      'tax_included', '', 0, 1, %L, %L, now() + interval '9 days',
      array['ugc_photo'], tests.future_slot(3),
      '{"scope":"organic_and_ads","duration_days":90,"fee":0}')$sql$,
    p.restaurant_id, v_period_start, v_period_start + 10),
    'ads_usage_requires_fee');

  perform tests.assert_raises(format(
    $sql$select public.create_campaign_with_slots(%L, 't', '', 'カフェ', '梅田', 5000,
      'tax_included', '', 0, 1, %L, %L, now() + interval '9 days',
      array['ugc_photo'], tests.future_slot(3),
      '{"scope":"organic","duration_days":9999,"fee":0}')$sql$,
    p.restaurant_id, v_period_start, v_period_start + 10),
    'invalid_usage_rights');

  -- Valid campaign: Reel + UGC photos, organic + ads for 90 days, +¥5,000.
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'テスト食堂 カフェ PR募集', '', 'カフェ', '梅田',
    6000, 'tax_included', '1名分提供', 0, 1,
    v_period_start, v_period_start + 10, now() + interval '9 days',
    array['instagram_reel', 'ugc_photo'], tests.future_slot(3),
    '{"scope":"organic_and_ads","duration_days":90,"fee":5000}'::jsonb
  );
  set constraints all immediate;
  set constraints all deferred;

  -- Creators see the terms before applying.
  perform tests.act_as(p.creator_user_id);
  select count(*) into v_count
  from public.campaign_usage_rights
  where campaign_id = v_campaign and fee = 5000 and duration_days = 90;
  if v_count <> 1 then
    raise exception 'creator cannot read usage terms';
  end if;

  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;
  v_application := public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);

  -- Terms are locked once someone applied.
  perform tests.act_as_superuser();
  perform tests.assert_raises(
    format('update public.campaign_usage_rights set fee = 1 where campaign_id = %L', v_campaign),
    'campaign_usage_rights_locked_after_application');

  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(v_application, v_slot);

  perform tests.act_as_superuser();
  select amount into v_amount from public.payments where booking_id = v_booking;
  if v_amount <> 11000 then
    raise exception 'expected reward + usage fee = 11000, got %', v_amount;
  end if;

  select * into v_license from public.content_usage_licenses where booking_id = v_booking;
  if v_license.status <> 'pending' or v_license.usage_scope <> 'organic_and_ads' then
    raise exception 'license snapshot missing or wrong: %', row_to_json(v_license);
  end if;

  select id into v_reel from public.deliverables
  where booking_id = v_booking and platform = 'instagram_reel';
  select id into v_photo from public.deliverables
  where booking_id = v_booking and platform = 'ugc_photo';

  -- Licenses are private to the parties.
  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.content_usage_licenses where booking_id = v_booking) then
    raise exception 'license leaked to another creator';
  end if;

  -- A UGC deliverable cannot be satisfied with a URL or with zero files.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(
    format('select public.submit_deliverable(%L, %L, true)', v_photo, 'https://example.com/a.jpg'),
    'deliverable_requires_upload');
  perform tests.assert_raises(
    format('select public.submit_ugc_deliverable(%L)', v_photo),
    'ugc_files_required');

  -- Upload: only into <own uid>/<own UGC deliverable>/<file>.
  v_path := p.creator_user_id || '/' || v_photo || '/main-01.jpg';
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('ugc-assets', v_path, p.creator_user_id,
          '{"mimetype":"image/jpeg","size":2400000}');

  perform tests.assert_raises(format(
    $sql$insert into storage.objects (bucket_id, name, metadata)
      values ('ugc-assets', %L, '{"mimetype":"image/jpeg","size":1}')$sql$,
    p.creator_user_id || '/' || v_reel || '/x.jpg'),
    'row-level security');

  perform tests.act_as(p.other_creator_user_id);
  perform tests.assert_raises(format(
    $sql$insert into storage.objects (bucket_id, name, metadata)
      values ('ugc-assets', %L, '{"mimetype":"image/jpeg","size":1}')$sql$,
    p.other_creator_user_id || '/' || v_photo || '/x.jpg'),
    'row-level security');
  perform tests.assert_raises(
    format('select public.register_content_asset(%L, %L)', v_photo, v_path),
    'not_authorized');

  perform tests.act_as(p.creator_user_id);
  v_asset := public.register_content_asset(v_photo, v_path);

  -- Registration is idempotent per file.
  if public.register_content_asset(v_photo, v_path) <> v_asset then
    raise exception 'duplicate registration created a second asset';
  end if;

  -- File type and size come from Storage metadata, not from the client.
  insert into storage.objects (bucket_id, name, metadata)
  values ('ugc-assets', p.creator_user_id || '/' || v_photo || '/clip.mp4',
          '{"mimetype":"video/mp4","size":1000}');
  perform tests.assert_raises(format('select public.register_content_asset(%L, %L)',
    v_photo, p.creator_user_id || '/' || v_photo || '/clip.mp4'), 'unsupported_file_type');

  insert into storage.objects (bucket_id, name, metadata)
  values ('ugc-assets', p.creator_user_id || '/' || v_photo || '/huge.jpg',
          '{"mimetype":"image/jpeg","size":99999999}');
  perform tests.assert_raises(format('select public.register_content_asset(%L, %L)',
    v_photo, p.creator_user_id || '/' || v_photo || '/huge.jpg'), 'file_too_large');

  -- A spare file can be removed again before review.
  insert into storage.objects (bucket_id, name, metadata)
  values ('ugc-assets', p.creator_user_id || '/' || v_photo || '/spare.png',
          '{"mimetype":"image/png","size":5000}');
  v_spare_asset := public.register_content_asset(
    v_photo, p.creator_user_id || '/' || v_photo || '/spare.png');
  if public.remove_content_asset(v_spare_asset) <> p.creator_user_id || '/' || v_photo || '/spare.png' then
    raise exception 'remove_content_asset returned wrong path';
  end if;

  perform public.submit_ugc_deliverable(v_photo);
  perform public.submit_deliverable(v_reel, 'https://www.instagram.com/reel/xyz/', true);

  perform tests.act_as_superuser();
  if not exists (
    select 1 from public.applications where id = v_application and status = 'submitted'
  ) then
    raise exception 'application should be submitted after all deliverables';
  end if;
  if not exists (
    select 1 from public.notifications n
    where n.user_id = p.restaurant_user_id and n.title = 'UGC素材が納品されました'
  ) then
    raise exception 'restaurant was not notified about the UGC delivery';
  end if;

  -- Reviewing Restaurant can open the file; an unrelated Restaurant cannot.
  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 1 then
    raise exception 'restaurant cannot open UGC under review';
  end if;

  perform tests.act_as(v_other_shop_user);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 0 then
    raise exception 'UGC leaked to another restaurant';
  end if;
  if exists (select 1 from public.content_assets where id = v_asset) then
    raise exception 'asset metadata leaked to another restaurant';
  end if;

  -- Approval of every deliverable starts the 90-day term.
  perform tests.act_as(p.restaurant_user_id);
  perform public.review_deliverable(v_photo, true, null);
  perform public.review_deliverable(v_reel, true, null);

  perform tests.act_as_superuser();
  select * into v_license from public.content_usage_licenses where booking_id = v_booking;
  if v_license.status <> 'active'
     or v_license.expires_at <> v_license.starts_at + interval '90 days' then
    raise exception 'license not activated for 90 days: %', row_to_json(v_license);
  end if;
  if not exists (
    select 1 from public.payments where booking_id = v_booking and status = 'approved'
  ) then
    raise exception 'payment should be approved';
  end if;

  -- Approved files are frozen for the Creator.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(
    format('select public.remove_content_asset(%L)', v_asset),
    'deliverable_already_approved');
  delete from storage.objects where name = v_path;
  perform tests.act_as_superuser();
  if not exists (select 1 from storage.objects where name = v_path) then
    raise exception 'creator deleted an approved UGC file';
  end if;

  -- Active license: Restaurant can open the file.
  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 1 then
    raise exception 'restaurant cannot open licensed UGC';
  end if;

  -- After expiry the file is closed, but the library entry stays visible.
  perform tests.act_as_superuser();
  update public.content_usage_licenses
  set starts_at = now() - interval '91 days',
      expires_at = now() - interval '1 day'
  where booking_id = v_booking;

  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 0 then
    raise exception 'restaurant can still open UGC after license expiry';
  end if;
  if not exists (select 1 from public.content_assets where id = v_asset) then
    raise exception 'library entry should remain visible after expiry';
  end if;

  -- The Creator always keeps access to their own files.
  perform tests.act_as(p.creator_user_id);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 1 then
    raise exception 'creator lost access to own file';
  end if;
end;
$$;

-- Campaigns without usage terms keep working exactly as before.
do $$
declare
  p record;
  v_campaign uuid;
  v_slot uuid;
  v_booking uuid;
  v_amount integer;
begin
  select * into p from tests.seed_parties();

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, '通常案件', '', '焼肉', '梅田', 6000, 'tax_included',
    '', 0, 1, (now() at time zone 'Asia/Tokyo')::date,
    (now() at time zone 'Asia/Tokyo')::date + 10, now() + interval '9 days',
    array['instagram_reel'], tests.future_slot(4)
  );
  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;

  perform tests.act_as(p.creator_user_id);
  perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);

  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(
    (select id from public.applications where campaign_id = v_campaign), v_slot);

  perform tests.act_as_superuser();
  select amount into v_amount from public.payments where booking_id = v_booking;
  if v_amount <> 6000 then
    raise exception 'payment without usage terms changed: %', v_amount;
  end if;
  if exists (select 1 from public.content_usage_licenses where booking_id = v_booking) then
    raise exception 'license created without usage terms';
  end if;
end;
$$;

-- Direct OFFER can carry the same usage terms.
do $$
declare
  p record;
  v_campaign uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select * into p from tests.seed_parties();

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_direct_offer_with_slots(
    p.restaurant_id, p.creator_id, 'テスト食堂 PRご依頼', '', 'グルメ', '梅田',
    8000, 'tax_included', '1名分提供', 0, v_today, v_today + 5,
    now() + interval '4 days', array['ugc_video'], tests.future_slot(5),
    '{"scope":"organic","duration_days":30,"fee":0}'::jsonb
  );
  set constraints all immediate;
  set constraints all deferred;

  perform tests.act_as(p.creator_user_id);
  if not exists (
    select 1 from public.campaign_usage_rights
    where campaign_id = v_campaign and usage_scope = 'organic' and duration_days = 30
  ) then
    raise exception 'direct offer usage terms missing';
  end if;

  -- The non-targeted Creator sees neither the offer nor its terms.
  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.campaign_usage_rights where campaign_id = v_campaign) then
    raise exception 'direct offer terms leaked';
  end if;
end;
$$;
