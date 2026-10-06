-- Terms consent is recorded only through accept_terms, per user and version,
-- and a post URL cannot be submitted without confirming the PR disclosure.
do $$
declare
  p record;
  v_campaign uuid;
  v_slot uuid;
  v_application uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_count integer;
  v_confirmed timestamptz;
begin
  select * into p from tests.seed_parties();

  -- Terms consent -----------------------------------------------------------
  perform tests.act_as_anon();
  perform tests.assert_raises(
    'select public.accept_terms(''2026-10-06'')', 'authentication_required');

  perform tests.act_as(p.creator_user_id);
  perform tests.assert_raises(
    'select public.accept_terms(''v1; drop table x'')', 'invalid_terms_version');
  perform tests.assert_raises(
    'select public.accept_terms(null)', 'invalid_terms_version');

  perform public.accept_terms('2026-10-06');
  perform public.accept_terms('2026-10-06'); -- idempotent

  select count(*) into v_count
  from public.terms_acceptances
  where user_id = p.creator_user_id and terms_version = '2026-10-06';
  if v_count <> 1 then
    raise exception 'expected one acceptance row, got %', v_count;
  end if;

  -- Writes only through the RPC, never directly or on someone else's behalf.
  perform tests.assert_raises(
    format('insert into public.terms_acceptances (user_id, terms_version) values (%L, ''2026-10-07'')',
           p.restaurant_user_id),
    'permission denied');

  -- Others cannot read the Creator's acceptance.
  perform tests.act_as(p.restaurant_user_id);
  if exists (select 1 from public.terms_acceptances where user_id = p.creator_user_id) then
    raise exception 'terms acceptance leaked to another user';
  end if;

  perform tests.act_as_superuser();
  select count(*) into v_count
  from public.audit_logs
  where action = 'terms.accepted' and actor_user_id = p.creator_user_id;
  if v_count <> 1 then
    raise exception 'expected one terms.accepted audit row, got %', v_count;
  end if;

  -- PR disclosure on submission ---------------------------------------------
  perform tests.act_as(p.restaurant_user_id);
  v_campaign := public.create_campaign_with_slots(
    p.restaurant_id, 'PR表記確認 PR', '', '焼肉', '梅田',
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

  perform tests.assert_raises(
    format('select public.submit_deliverable(%L, %L, false)', v_deliverable, 'https://www.instagram.com/reel/pr/'),
    'pr_disclosure_required');
  perform tests.assert_raises(
    format('select public.submit_deliverable(%L, %L, null)', v_deliverable, 'https://www.instagram.com/reel/pr/'),
    'pr_disclosure_required');
  -- The old two-argument form no longer exists.
  perform tests.assert_raises(
    format('select public.submit_deliverable(%L, %L)', v_deliverable, 'https://www.instagram.com/reel/pr/'),
    'does not exist');

  perform tests.act_as_superuser();
  if exists (select 1 from public.deliverables where id = v_deliverable and submitted_url is not null) then
    raise exception 'URL saved without PR disclosure';
  end if;

  perform tests.act_as(p.creator_user_id);
  perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/pr/', true);

  perform tests.act_as_superuser();
  select pr_disclosure_confirmed_at into v_confirmed
  from public.deliverables where id = v_deliverable;
  if v_confirmed is null then
    raise exception 'PR disclosure confirmation not recorded';
  end if;
end;
$$;
