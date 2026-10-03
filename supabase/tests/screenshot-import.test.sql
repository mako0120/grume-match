-- Screenshot-only performance import by the Operator / service role
-- (Claude's read-insights procedure).
do $$
declare
  p record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_path text;
  v_evidence uuid;
  v_count integer;
begin
  select * into p from tests.seed_parties();

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

end;
$$;
