-- PR post reports: Creator sends the screenshot, the Operator / Claude
-- registers the numbers, the two parties see them.
do $$
declare
  p record;
  v_other_shop uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_campaign uuid;
  v_slot uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_path text;
  v_report uuid;
  v_count integer;
  v_row record;
begin
  select * into p from tests.seed_parties();
  v_other_shop := tests.create_user('report-other-shop-' || gen_random_uuid() || '@example.test');
  perform tests.act_as(v_other_shop);
  perform public.complete_restaurant_onboarding('別の店', '大阪市中央区', '難波');

  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'テスト食堂 焼肉 PR募集', '', '焼肉', '梅田', 8000, 'tax_included',
    '1名分提供', 0, 1, v_today, v_today + 10, now() + interval '9 days',
    array['instagram_reel'], tests.future_slot(3));
  select id into v_slot from public.campaign_slots where campaign_id = v_campaign;

  perform tests.act_as(p.creator_user_id);
  perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);
  perform tests.act_as(p.restaurant_user_id);
  v_booking := public.confirm_booking(
    (select id from public.applications where campaign_id = v_campaign), v_slot);

  perform tests.act_as(p.creator_user_id);
  select id into v_deliverable from public.deliverables where booking_id = v_booking;
  v_path := p.creator_user_id || '/post-' || gen_random_uuid() || '.png';
  insert into storage.objects (bucket_id, name, metadata)
  values ('creator-evidence', v_path, '{"mimetype":"image/png","size":200000}');

  -- Only after the post URL is submitted.
  perform tests.assert_raises(format(
    'select public.register_pr_post_report(%L, %L)', v_deliverable, v_path), 'post_not_submitted');

  perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/x/');
  v_report := public.register_pr_post_report(v_deliverable, v_path);

  -- Another Creator cannot attach a report to this post.
  perform tests.act_as(p.other_creator_user_id);
  perform tests.assert_raises(format(
    'select public.register_pr_post_report(%L, %L)', v_deliverable, v_path), 'not_authorized');

  -- Creators and Restaurants cannot register numbers themselves.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(format(
    'select public.import_pr_post_report(%L, %L, 99999)', v_report, v_today), 'not_authorized');
  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select public.import_pr_post_report(%L, %L, 99999)', v_report, v_today), 'not_authorized');

  -- Sent back with a reason, then re-sent.
  perform tests.act_as_superuser();
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform tests.assert_raises(format(
    'select public.reject_pr_post_report(%L, %L)', v_report, '  '), 'reason_required');
  perform public.reject_pr_post_report(v_report, 'PR投稿のインサイト画面を送ってください');
  perform set_config('request.jwt.claims', '', true);

  if not exists (
    select 1 from public.notifications
    where user_id = p.creator_user_id and type = 'post_report_rejected'
  ) then
    raise exception 'creator not told why the report was sent back';
  end if;

  perform tests.act_as(p.creator_user_id);
  v_path := p.creator_user_id || '/post-' || gen_random_uuid() || '.png';
  insert into storage.objects (bucket_id, name, metadata)
  values ('creator-evidence', v_path, '{"mimetype":"image/png","size":200000}');
  if public.register_pr_post_report(v_deliverable, v_path) <> v_report then
    raise exception 're-sending should reuse the same report';
  end if;

  -- Claude registers what it read.
  perform tests.act_as_superuser();
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform tests.assert_raises(format(
    'select public.import_pr_post_report(%L, %L, 1000, 2000)', v_report, v_today), 'reach_exceeds_views');
  perform tests.assert_raises(format(
    'select public.import_pr_post_report(%L, %L, 1000)', v_report, v_today + 1), 'invalid_measured_on');
  perform public.import_pr_post_report(v_report, v_today, 12400, 9800, 640, 12, 310, 45, 28);
  perform tests.assert_raises(format(
    'select public.import_pr_post_report(%L, %L, 1)', v_report, v_today), 'post_report_not_pending');
  perform set_config('request.jwt.claims', '', true);

  if (select count(*) from public.notifications
      where type = 'post_report_verified'
        and user_id in (p.creator_user_id, p.restaurant_user_id)) <> 2 then
    raise exception 'both parties should be notified';
  end if;

  -- Verified reports cannot be replaced by the Creator.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(format(
    'select public.register_pr_post_report(%L, %L)', v_deliverable, v_path), 'post_report_already_verified');

  -- The Restaurant sees the numbers; another Restaurant does not.
  perform tests.act_as(p.restaurant_user_id);
  select * into v_row from public.pr_post_reports where id = v_report;
  if v_row.views <> 12400 or v_row.reach <> 9800 or v_row.saves <> 310 or v_row.status <> 'verified' then
    raise exception 'unexpected report for the restaurant: %', row_to_json(v_row);
  end if;

  perform tests.act_as(v_other_shop);
  select count(*) into v_count from public.pr_post_reports;
  if v_count <> 0 then
    raise exception 'post report leaked to another restaurant';
  end if;

  -- The screenshot itself stays private to the Creator and the Operator.
  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 0 then
    raise exception 'restaurant can open the insights screenshot';
  end if;

  -- Direct writes are not possible.
  perform tests.act_as(p.creator_user_id);
  update public.pr_post_reports set views = 1 where id = v_report;
  perform tests.act_as_superuser();
  if (select views from public.pr_post_reports where id = v_report) <> 12400 then
    raise exception 'creator changed verified numbers directly';
  end if;
end;
$$;
