-- Stripe invoices: recorded only for exactly the pending fees, paid/void
-- applied idempotently from the webhook, Restaurant-only billing email.
do $$
declare
  p record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_campaign uuid;
  v_slot uuid;
  v_booking uuid;
  v_deliverable uuid;
  v_fees uuid[] := '{}';
  v_fee_sum integer;
  v_invoice uuid;
  v_other_shop uuid;
  v_count integer;
  i integer;
begin
  select * into p from tests.seed_parties();

  -- Billing email: the Restaurant's own members only, validated.
  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select public.set_restaurant_billing_email(%L, %L)', p.restaurant_id, 'not-an-email'), 'invalid_billing_email');
  perform public.set_restaurant_billing_email(p.restaurant_id, ' Billing@Example.TEST ');
  v_other_shop := tests.create_user('stripe-other-' || gen_random_uuid() || '@example.test');
  perform tests.act_as(v_other_shop);
  perform public.complete_restaurant_onboarding('別の店', '大阪市中央区', '難波');
  perform tests.assert_raises(format(
    'select public.set_restaurant_billing_email(%L, %L)', p.restaurant_id, 'x@example.test'), 'not_authorized');

  -- Three completed PRs: the first is free, two are charged.
  for i in 1..3 loop
    perform tests.act_as(p.restaurant_user_id);
    v_campaign := public.create_campaign_with_slots(
      p.restaurant_id, 'テスト食堂 PR ' || i, '', '焼肉', '梅田', 10000 * i, 'tax_included',
      '1名分提供', 0, 1, v_today, v_today + 10, now() + interval '9 days',
      array['instagram_reel'], tests.future_slot(2 + i));
    select id into v_slot from public.campaign_slots where campaign_id = v_campaign;
    perform tests.act_as(p.creator_user_id);
    perform public.apply_to_campaign(v_campaign, 1, array[v_slot], '[]'::jsonb);
    perform tests.act_as(p.restaurant_user_id);
    v_booking := public.confirm_booking(
      (select id from public.applications where campaign_id = v_campaign), v_slot);
    perform tests.act_as(p.creator_user_id);
    select id into v_deliverable from public.deliverables where booking_id = v_booking;
    perform public.submit_deliverable(v_deliverable, 'https://www.instagram.com/reel/' || i || '/');
    perform tests.act_as(p.restaurant_user_id);
    perform public.review_deliverable(v_deliverable, true, null);
  end loop;

  perform tests.act_as_superuser();
  select array_agg(id order by created_at), sum(fee) into v_fees, v_fee_sum
  from public.platform_fees where restaurant_id = p.restaurant_id and status = 'pending';
  if cardinality(v_fees) <> 2 or v_fee_sum <> 4000 + 6000 then
    raise exception 'unexpected pending fees: % / %', v_fees, v_fee_sum;
  end if;

  -- Only the service role records invoices.
  perform tests.act_as(p.restaurant_user_id);
  perform tests.assert_raises(format(
    'select public.record_platform_invoice(%L, %L, %L, %L, %L, %s, %s)',
    p.restaurant_id, to_char(v_today, 'YYYY-MM'), v_fees, 'in_test1', 'https://invoice.example/1', v_fee_sum, 1000),
    'not_authorized');

  perform tests.act_as_superuser();
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Amount must match exactly what is pending.
  perform tests.assert_raises(format(
    'select public.record_platform_invoice(%L, %L, %L, %L, %L, %s, %s)',
    p.restaurant_id, to_char(v_today, 'YYYY-MM'), v_fees, 'in_test1', 'https://invoice.example/1', v_fee_sum + 1, 1000),
    'invoice_fees_mismatch');

  perform public.set_restaurant_stripe_customer(p.restaurant_id, 'cus_Test123');
  v_invoice := public.record_platform_invoice(
    p.restaurant_id, to_char(v_today, 'YYYY-MM'), v_fees, 'in_test1', 'https://invoice.example/1', v_fee_sum, 1000);

  -- The same fees cannot be invoiced twice, nor a second invoice for the month.
  perform tests.assert_raises(format(
    'select public.record_platform_invoice(%L, %L, %L, %L, %L, %s, %s)',
    p.restaurant_id, to_char(v_today, 'YYYY-MM'), v_fees, 'in_test2', 'https://invoice.example/2', v_fee_sum, 1000),
    'invoice_fees_mismatch');

  if (select count(*) from public.platform_fees where invoice_id = v_invoice and status = 'invoiced') <> 2 then
    raise exception 'fees should be invoiced';
  end if;

  -- Webhook: void returns the fees to pending, then a new invoice can be sent.
  if public.apply_stripe_invoice_event('in_test1', 'void') <> 'void' then
    raise exception 'void not applied';
  end if;
  if (select count(*) from public.platform_fees where id = any(v_fees) and status = 'pending' and invoice_id is null) <> 2 then
    raise exception 'voided fees should be pending again';
  end if;
  v_invoice := public.record_platform_invoice(
    p.restaurant_id, to_char(v_today, 'YYYY-MM'), v_fees, 'in_test3', 'https://invoice.example/3', v_fee_sum, 1000);

  -- Paid, twice (Stripe retries): idempotent.
  if public.apply_stripe_invoice_event('in_test3', 'paid') <> 'paid'
     or public.apply_stripe_invoice_event('in_test3', 'paid') <> 'already_paid'
     or public.apply_stripe_invoice_event('in_unknown', 'paid') <> 'unknown_invoice' then
    raise exception 'unexpected webhook results';
  end if;
  -- A late void for a paid invoice changes nothing.
  if public.apply_stripe_invoice_event('in_test3', 'void') <> 'ignored' then
    raise exception 'paid invoice must not be voided';
  end if;
  perform set_config('request.jwt.claims', '', true);

  if (select count(*) from public.platform_fees where id = any(v_fees) and status = 'paid' and paid_at is not null) <> 2 then
    raise exception 'fees should be paid';
  end if;

  -- The Restaurant sees its invoices; another Restaurant does not.
  perform tests.act_as(p.restaurant_user_id);
  select count(*) into v_count from public.platform_invoices where status = 'paid' and total = 11000;
  if v_count <> 1 then
    raise exception 'restaurant should see the paid invoice';
  end if;
  perform tests.act_as(v_other_shop);
  select count(*) into v_count from public.platform_invoices;
  if v_count <> 0 then
    raise exception 'invoices leaked to another restaurant';
  end if;
end;
$$;
