-- PR desk: flat-rate plan ordering, screenshot-only performance import by
-- the service role (Claude's read-insights procedure), outreach log privacy.
do $$
declare
  p record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_campaign uuid;
  v_campaign_row record;
  v_path text;
  v_evidence uuid;
  v_count integer;
  v_kit jsonb;
begin
  select * into p from tests.seed_parties();

  -- Creator opens the PR desk with one switch.
  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises('select public.set_pr_desk(true, 500, ''gourmet-diary'')', 'invalid_flat_plan_price');
  perform public.set_pr_desk(true, 8000, 'gourmet-diary');

  perform tests.act_as_anon();
  v_kit := public.get_public_media_kit('gourmet-diary');
  if (v_kit ->> 'flat_plan_price')::integer <> 8000
     or not (v_kit ->> 'flat_plan_enabled')::boolean
     or v_kit ->> 'slug' <> 'gourmet-diary' then
    raise exception 'public kit lacks the plan: %', v_kit;
  end if;

  -- Anonymous visitors and Creators cannot order.
  perform tests.assert_raises(format(
    'select public.create_flat_plan_order(%L, %L, %L, %L, %L)',
    'gourmet-diary', v_today, v_today + 5, now() + interval '4 days', tests.future_slot(5)),
    'authentication_required');
  perform tests.act_as(p.other_creator_user_id);
  perform tests.assert_raises(format(
    'select public.create_flat_plan_order(%L, %L, %L, %L, %L)',
    'gourmet-diary', v_today, v_today + 5, now() + interval '4 days', tests.future_slot(5)),
    'restaurant_required');

  -- Restaurant orders: price, deliverable and food come from the plan.
  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_flat_plan_order(
    'Gourmet-Diary', v_today, v_today + 5, now() + interval '4 days',
    tests.future_slot(5), '厚切りタンを紹介してください'
  );

  perform tests.act_as_superuser();
  select c.cash_reward, c.reward_tax_mode, c.food_offer, c.max_companions, c.visibility,
         c.description, c.title,
         (select array_agg(platform::text) from public.campaign_platforms cp where cp.campaign_id = c.id) as platforms,
         (select creator_id from public.campaign_target_creators t where t.campaign_id = c.id) as target
    into v_campaign_row
  from public.campaigns c where c.id = v_campaign;

  if v_campaign_row.cash_reward <> 8000
     or v_campaign_row.reward_tax_mode <> 'tax_included'
     or v_campaign_row.food_offer <> '1名分提供'
     or v_campaign_row.max_companions <> 0
     or v_campaign_row.visibility <> 'direct'
     or v_campaign_row.platforms <> array['instagram_reel']
     or v_campaign_row.target <> p.creator_id
     or v_campaign_row.description <> '厚切りタンを紹介してください' then
    raise exception 'unexpected flat-plan campaign: %', row_to_json(v_campaign_row);
  end if;

  -- Closing the desk stops new orders.
  perform tests.act_as(p.creator_user_id);
  perform public.set_pr_desk(false, 8000, 'gourmet-diary');
  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select public.create_flat_plan_order(%L, %L, %L, %L, %L)',
    'gourmet-diary', v_today, v_today + 5, now() + interval '4 days', tests.future_slot(6)),
    'flat_plan_not_available');

  -- Screenshot only: the Creator uploads, nothing else.
  perform tests.act_as(p.creator_user_id);
  v_path := p.creator_user_id || '/' || v_today || '-insights.png';
  insert into storage.objects (bucket_id, name, metadata)
  values ('creator-evidence', v_path, '{"mimetype":"image/png","size":300000}');
  v_evidence := public.register_performance_evidence('instagram', v_today, v_path);

  -- Creators and Restaurants cannot import as verified.
  perform tests.assert_raises(format(
    'select public.import_metrics_from_evidence(%L, %L)', v_evidence,
    '[{"area":"x","posted_on":"2026-01-01","views":1}]'), 'not_authorized');
  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select public.import_metrics_from_evidence(%L, %L)', v_evidence,
    '[{"area":"x","posted_on":"2026-01-01","views":1}]'), 'not_authorized');

  -- Service role (Claude's procedure) imports what it read.
  perform tests.act_as_superuser();
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_count := public.import_metrics_from_evidence(
    v_evidence,
    jsonb_build_array(
      jsonb_build_object('area', '淡路市', 'headline', '刺身好きなら一度は行きたい',
        'posted_on', v_today - 21, 'posted_on_approx', true, 'views', 27000,
        'views_approx', true, 'likes', 1106, 'comments', 27, 'reposts', 12, 'shares', 5),
      jsonb_build_object('area', '北新地', 'headline', '旬を揃える天麩羅コース',
        'posted_on', v_today - 14, 'posted_on_approx', true, 'views', 5446,
        'likes', 618, 'comments', 2, 'reposts', 11, 'shares', 0)
    )
  );
  perform set_config('request.jwt.claims', '', true);

  if v_count <> 2 then
    raise exception 'expected 2 imported rows, got %', v_count;
  end if;
  if exists (select 1 from public.creator_post_metrics where creator_id = p.creator_id and verified_at is null) then
    raise exception 'imported rows should be verified';
  end if;
  if (select status from public.creator_performance_evidence where id = v_evidence) <> 'verified' then
    raise exception 'evidence should be verified';
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = p.creator_user_id and title = '実績を登録しました'
  ) then
    raise exception 'creator not notified about the import';
  end if;

  -- The verification flag does not leak into later Creator writes.
  perform tests.act_as(p.creator_user_id);
  perform public.replace_creator_post_metrics('instagram', v_today - 1,
    jsonb_build_array(jsonb_build_object('area', '本町', 'posted_on', v_today - 3, 'views', 100)));
  perform tests.act_as_superuser();
  if (select verified_at from public.creator_post_metrics
      where creator_id = p.creator_id and area = '本町') is not null then
    raise exception 'creator paste became verified';
  end if;

  -- Outreach log is private to the Creator.
  perform tests.act_as(p.creator_user_id);
  insert into public.creator_outreach (creator_id, company_name, email)
  values (p.creator_id, '焼肉 ひまわり', 'info@example.com');
  perform tests.assert_raises(format(
    $sql$insert into public.creator_outreach (creator_id, company_name, email)
      values (%L, 'x', 'not-an-email')$sql$, p.creator_id), 'check');

  perform tests.act_as(p.other_creator_user_id);
  if exists (select 1 from public.creator_outreach) then
    raise exception 'outreach leaked to another creator';
  end if;
  perform tests.act_as(p.restaurant_user_id);
  if exists (select 1 from public.creator_outreach) then
    raise exception 'outreach leaked to a restaurant';
  end if;
end;
$$;
