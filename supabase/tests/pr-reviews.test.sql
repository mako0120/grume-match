-- Mutual reviews: open only after approval, double-blind, immutable,
-- summaries from revealed reviews only.
do $$
declare
  p record;
  v_other_shop uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_campaign uuid;
  v_slot uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_review uuid;
  v_count integer;
  v_row record;
begin
  select * into p from tests.seed_parties();
  v_other_shop := tests.create_user('review-other-shop-' || gen_random_uuid() || '@example.test');
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

  -- Not open before the post is approved.
  perform tests.assert_raises(
    format('select public.submit_pr_review(%L, 5)', v_booking), 'review_not_open');

  perform tests.act_as(p.creator_user_id);
  select id into v_deliverable from public.deliverables where booking_id = v_booking;
  perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/x/');
  perform tests.act_as(p.restaurant_user_id);
  perform public.review_deliverable(v_deliverable, true, null);

  -- Validation.
  perform tests.assert_raises(
    format('select public.submit_pr_review(%L, 6)', v_booking), 'invalid_rating');
  perform tests.assert_raises(
    format('select public.submit_pr_review(%L, 5, %L)', v_booking, array['また行きたい']),
    'invalid_review_tag');

  -- Outsiders cannot review.
  perform tests.act_as(v_other_shop);
  perform tests.assert_raises(
    format('select public.submit_pr_review(%L, 1)', v_booking), 'not_authorized');
  perform tests.act_as(p.other_creator_user_id);
  perform tests.assert_raises(
    format('select public.submit_pr_review(%L, 1)', v_booking), 'not_authorized');

  -- Restaurant reviews first; duplicate tags collapse.
  perform tests.act_as(p.restaurant_user_id);
  v_review := public.submit_pr_review(
    v_booking, 5, array['時間どおり', '時間どおり', 'また依頼したい'], '  とても丁寧でした  ');
  perform tests.assert_raises(
    format('select public.submit_pr_review(%L, 4)', v_booking), 'already_reviewed');

  perform tests.act_as_superuser();
  select * into v_row from public.pr_reviews where id = v_review;
  if v_row.direction <> 'restaurant_to_creator'
     or cardinality(v_row.tags) <> 2
     or v_row.comment <> 'とても丁寧でした' then
    raise exception 'unexpected stored review: %', row_to_json(v_row);
  end if;
  if not exists (
    select 1 from public.notifications
    where user_id = p.creator_user_id and type = 'pr_review_received'
  ) then
    raise exception 'creator not notified about the review';
  end if;

  -- Double-blind: the Creator does not see the stars yet, nor the table row.
  perform tests.act_as(p.creator_user_id);
  select count(*) into v_count from public.booking_pr_reviews(v_booking);
  if v_count <> 0 then
    raise exception 'review revealed before the creator reviewed';
  end if;
  select count(*) into v_count from public.pr_reviews;
  if v_count <> 0 then
    raise exception 'creator can read the restaurant review row';
  end if;

  -- Not counted in summaries while hidden.
  perform tests.act_as(v_other_shop);
  select * into v_row from public.creator_review_summaries(array[p.creator_id]);
  if v_row.review_count <> 0 then
    raise exception 'hidden review counted: %', row_to_json(v_row);
  end if;

  -- Creator reviews back → both revealed.
  perform tests.act_as(p.creator_user_id);
  perform public.submit_pr_review(v_booking, 2, array['連絡が早い'], null);
  select count(*) into v_count from public.booking_pr_reviews(v_booking);
  if v_count <> 2 then
    raise exception 'expected both reviews after the creator reviewed, got %', v_count;
  end if;
  select * into v_row from public.booking_pr_reviews(v_booking) where not is_mine;
  if v_row.rating <> 5 or v_row.comment <> 'とても丁寧でした' then
    raise exception 'unexpected revealed review: %', row_to_json(v_row);
  end if;

  -- Summaries for third parties: counts and tags, no comments.
  perform tests.act_as(v_other_shop);
  select * into v_row from public.creator_review_summaries(array[p.creator_id]);
  if v_row.review_count <> 1 or v_row.average_rating <> 5
     or (v_row.tag_counts ->> '時間どおり')::integer <> 1 then
    raise exception 'unexpected creator summary: %', row_to_json(v_row);
  end if;
  select count(*) into v_count from public.booking_pr_reviews(v_booking);
  if v_count <> 0 then
    raise exception 'booking reviews leaked to another restaurant';
  end if;

  perform tests.act_as(p.other_creator_user_id);
  select * into v_row from public.restaurant_review_summaries(array[p.restaurant_id]);
  if v_row.review_count <> 1 or v_row.average_rating <> 2 then
    raise exception 'unexpected restaurant summary: %', row_to_json(v_row);
  end if;

  -- Low ratings are followed up by the Operator only.
  perform tests.assert_raises(
    format('select public.mark_pr_review_followed_up(%L)', v_review), 'not_authorized');
  perform tests.act_as(p.admin_id);
  perform public.mark_pr_review_followed_up(
    (select id from public.pr_reviews where booking_id = v_booking and rating = 2));
  if not exists (
    select 1 from public.pr_reviews where booking_id = v_booking and followed_up_at is not null
  ) then
    raise exception 'follow-up not recorded';
  end if;

  -- Reveal after 14 days even if the other side never reviews.
  perform tests.act_as_superuser();
  delete from public.pr_reviews where booking_id = v_booking and direction = 'creator_to_restaurant';
  update public.pr_reviews set created_at = now() - interval '15 days' where id = v_review;
  perform tests.act_as(p.creator_user_id);
  select count(*) into v_count from public.booking_pr_reviews(v_booking);
  if v_count <> 1 then
    raise exception 'review not revealed after 14 days';
  end if;

  -- Anonymous visitors get nothing.
  perform tests.act_as_anon();
  select count(*) into v_count from public.creator_review_summaries(array[p.creator_id]);
  if v_count <> 0 then
    raise exception 'anonymous visitors can read review summaries';
  end if;
end;
$$;
