-- Test-only helpers for impersonating Supabase users inside one transaction.
-- Applied after the migrations by supabase/tests/run.sh.

create schema if not exists tests;

create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  perform tests.act_as_superuser();
  insert into auth.users (id, email) values (v_id, p_email);
  return v_id;
end;
$$;

-- Switch the current transaction to an authenticated Supabase user.
create or replace function tests.act_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Switch to an anonymous visitor.
create or replace function tests.act_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
end;
$$;

-- Return to the superuser for setup and assertions that bypass RLS.
create or replace function tests.act_as_superuser()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

-- Assert that a SQL statement raises an exception whose message contains
-- p_expected.
create or replace function tests.assert_raises(p_sql text, p_expected text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'expected error containing "%", got "%"', p_expected, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected error containing "%", but statement succeeded: %', p_expected, p_sql;
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- Shared fixture: one Operator, one Restaurant, two Creators, all onboarded.
create or replace function tests.seed_parties()
returns table (
  admin_id uuid,
  restaurant_user_id uuid,
  restaurant_id uuid,
  creator_user_id uuid,
  creator_id uuid,
  other_creator_user_id uuid,
  other_creator_id uuid
)
language plpgsql
as $$
declare
  v_admin uuid;
  v_restaurant_user uuid;
  v_creator_user uuid;
  v_other_user uuid;
begin
  perform tests.act_as_superuser();
  v_admin := tests.create_user('admin-' || gen_random_uuid() || '@example.test');
  v_restaurant_user := tests.create_user('shop-' || gen_random_uuid() || '@example.test');
  v_creator_user := tests.create_user('creator-' || gen_random_uuid() || '@example.test');
  v_other_user := tests.create_user('other-' || gen_random_uuid() || '@example.test');

  update public.users
  set role = 'admin', onboarding_completed_at = now()
  where id = v_admin;

  perform tests.act_as(v_restaurant_user);
  perform public.complete_restaurant_onboarding('テスト食堂', '大阪市北区1-1', '梅田');

  perform tests.act_as(v_creator_user);
  perform public.complete_creator_onboarding('グルメ日誌', '', '大阪');

  perform tests.act_as(v_other_user);
  perform public.complete_creator_onboarding('別のCreator', '', '大阪');

  perform tests.act_as_superuser();

  return query
  select
    v_admin,
    v_restaurant_user,
    (select rm.restaurant_id from public.restaurant_memberships rm where rm.user_id = v_restaurant_user),
    v_creator_user,
    (select cp.id from public.creator_profiles cp where cp.user_id = v_creator_user),
    v_other_user,
    (select cp.id from public.creator_profiles cp where cp.user_id = v_other_user);
end;
$$;

-- One future 2-hour slot in Asia/Tokyo, `p_days` days from now at 19:00.
create or replace function tests.future_slot(p_days integer)
returns jsonb
language sql
as $$
  select jsonb_build_array(jsonb_build_object(
    'starts_at', ((now() at time zone 'Asia/Tokyo')::date + p_days + time '19:00') at time zone 'Asia/Tokyo',
    'ends_at', ((now() at time zone 'Asia/Tokyo')::date + p_days + time '21:00') at time zone 'Asia/Tokyo',
    'capacity', 1
  ));
$$;
