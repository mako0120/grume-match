-- Creator performance (実績): self-reported metrics, Operator verification
-- via screenshot and visibility to Restaurants.
do $$
declare
  p record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_rows jsonb;
  v_count integer;
  v_path text;
  v_evidence uuid;
begin
  select * into p from tests.seed_parties();

  -- Three of グルメ日誌's posts, dated relative to today.
  v_rows := jsonb_build_array(
    jsonb_build_object('area', '淡路市', 'headline', '刺身好きなら一度は行きたい',
      'posted_on', v_today - 21, 'posted_on_approx', true, 'views', 27000,
      'views_approx', true, 'likes', 1106, 'comments', 27, 'reposts', 12, 'shares', 5),
    jsonb_build_object('area', '小野原', 'headline', '漁港直営の新鮮な海鮮定食を堪能',
      'posted_on', v_today - 4, 'views', 27000, 'views_approx', true,
      'likes', 666, 'comments', 10, 'reposts', 6, 'shares', 13),
    jsonb_build_object('area', '松原', 'headline', '泡系豚骨 一度は食べたい',
      'posted_on', v_today - 21, 'posted_on_approx', true, 'views', 9786,
      'likes', 728, 'comments', 1, 'reposts', 4, 'shares', 2)
  );

  perform tests.act_as(p.creator_user_id);
  if public.replace_creator_post_metrics('instagram', v_today, v_rows) <> 3 then
    raise exception 'expected 3 rows';
  end if;

  -- Replacing the same snapshot does not duplicate.
  perform public.replace_creator_post_metrics('instagram', v_today, v_rows);
  select count(*) into v_count from public.creator_post_metrics where creator_id = p.creator_id;
  if v_count <> 3 then
    raise exception 'snapshot replace duplicated rows: %', v_count;
  end if;

  perform tests.assert_raises(format(
    'select public.replace_creator_post_metrics(%L, %L, %L)', 'instagram', v_today,
    jsonb_build_array(jsonb_build_object('area', 'x', 'posted_on', v_today, 'views', -1))),
    'invalid_metric_rows');
  perform tests.assert_raises(format(
    'select public.replace_creator_post_metrics(%L, %L, %L)', 'instagram', v_today,
    jsonb_build_array(jsonb_build_object('area', 'x', 'posted_on', v_today + 3, 'views', 1))),
    'invalid_metric_rows');
  perform tests.assert_raises(format(
    'select public.replace_creator_post_metrics(%L, %L, %L)', 'instagram', v_today + 1, v_rows),
    'invalid_measured_on');

  -- A Creator cannot self-verify.
  update public.creator_post_metrics set verified_at = now() where creator_id = p.creator_id;
  if exists (
    select 1 from public.creator_post_metrics
    where creator_id = p.creator_id and verified_at is not null
  ) then
    raise exception 'creator self-verified metrics';
  end if;

  -- Restaurants see the metrics but cannot change them.
  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from public.creator_post_metrics where creator_id = p.creator_id;
  if v_count <> 3 then
    raise exception 'restaurant should see 3 metrics, saw %', v_count;
  end if;
  update public.creator_post_metrics set views = 1 where creator_id = p.creator_id;
  perform tests.act_as_superuser();
  if exists (select 1 from public.creator_post_metrics where creator_id = p.creator_id and views = 1) then
    raise exception 'restaurant modified creator metrics';
  end if;

  -- Other Creators and anonymous visitors see nothing.
  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.creator_post_metrics where creator_id = p.creator_id) then
    raise exception 'metrics leaked to another creator';
  end if;
  perform tests.act_as_anon();
  if exists (select 1 from public.creator_post_metrics) then
    raise exception 'metrics leaked to anonymous visitors';
  end if;

  -- Evidence screenshot: Creator uploads into their own folder only.
  perform tests.act_as(p.creator_user_id);
  v_path := p.creator_user_id || '/insights-' || v_today || '.png';
  insert into storage.objects (bucket_id, name, metadata)
  values ('creator-evidence', v_path, '{"mimetype":"image/png","size":200000}');
  perform tests.assert_raises(format(
    $sql$insert into storage.objects (bucket_id, name, metadata)
      values ('creator-evidence', %L, '{"mimetype":"image/png","size":1}')$sql$,
    p.other_creator_user_id || '/fake.png'), 'row-level security');
  v_evidence := public.register_performance_evidence('instagram', v_today, v_path);

  -- Restaurants never see the screenshot (it can contain audience data).
  perform tests.act_as(p.restaurant_user_id);
  if exists (select 1 from storage.objects where name = v_path)
     or exists (select 1 from public.creator_performance_evidence) then
    raise exception 'evidence leaked to a restaurant';
  end if;
  perform tests.assert_raises(
    format('select public.review_performance_evidence(%L, true)', v_evidence), 'not_authorized');

  -- Operator verifies → rows of that snapshot become verified, Creator notified.
  perform tests.act_as(p.admin_id);
  select count(*) into v_count from storage.objects where name = v_path;
  if v_count <> 1 then
    raise exception 'operator cannot open evidence';
  end if;
  if public.review_performance_evidence(v_evidence, true) <> 3 then
    raise exception 'expected 3 verified rows';
  end if;

  perform tests.act_as_superuser();
  if exists (select 1 from public.creator_post_metrics where creator_id = p.creator_id and verified_at is null) then
    raise exception 'rows not verified';
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = p.creator_user_id and type = 'performance_reviewed'
  ) then
    raise exception 'creator not notified';
  end if;

  -- Editing a verified number drops its verification.
  perform tests.act_as(p.creator_user_id);
  update public.creator_post_metrics set views = 30000
  where creator_id = p.creator_id and area = '淡路市';
  perform tests.act_as_superuser();
  if (select verified_at from public.creator_post_metrics
      where creator_id = p.creator_id and area = '淡路市') is not null then
    raise exception 'edited row kept its verification';
  end if;
  if (select count(*) from public.creator_post_metrics
      where creator_id = p.creator_id and verified_at is not null) <> 2 then
    raise exception 'untouched rows should stay verified';
  end if;

end;
$$;
