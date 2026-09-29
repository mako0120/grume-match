-- Development seed data.
-- Requires a corresponding auth user to exist before attaching memberships/profiles.
-- Keep production data out of this file.

insert into public.restaurants (id, name, address, area, verified_at)
values (
  '10000000-0000-0000-0000-000000000001',
  '焼肉 GOURMET LAB',
  '大阪府大阪市中央区（デモ）',
  '心斎橋',
  now()
)
on conflict (id) do nothing;

insert into public.campaigns (
  id,
  restaurant_id,
  title,
  description,
  category,
  area,
  cash_reward,
  reward_tax_mode,
  food_offer,
  max_companions,
  creator_slots,
  visit_period_start,
  visit_period_end,
  application_deadline,
  status,
  published_at
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '黒毛和牛コース リールPR募集',
  'Tap Schedule検証用のデモ有償案件です。',
  '焼肉',
  '心斎橋',
  6000,
  'tax_included',
  '2名までコース提供',
  1,
  3,
  '2026-10-08',
  '2026-10-14',
  '2026-10-07 23:59:59+09',
  'recruiting',
  now()
)
on conflict (id) do nothing;

insert into public.campaign_platforms (campaign_id, platform, quantity, required)
values (
  '20000000-0000-0000-0000-000000000001',
  'instagram_reel',
  1,
  true
)
on conflict (campaign_id, platform) do nothing;

insert into public.campaign_slots (
  campaign_id,
  starts_at,
  ends_at,
  capacity,
  reserved_count,
  status
)
select
  '20000000-0000-0000-0000-000000000001',
  slot_start,
  slot_start + interval '2 hours',
  1,
  0,
  'open'
from unnest(array[
  '2026-10-08 18:00:00+09'::timestamptz,
  '2026-10-08 18:30:00+09'::timestamptz,
  '2026-10-08 19:00:00+09'::timestamptz,
  '2026-10-08 19:30:00+09'::timestamptz,
  '2026-10-08 20:30:00+09'::timestamptz,
  '2026-10-09 18:00:00+09'::timestamptz,
  '2026-10-09 18:30:00+09'::timestamptz,
  '2026-10-09 19:00:00+09'::timestamptz,
  '2026-10-09 19:30:00+09'::timestamptz,
  '2026-10-09 20:00:00+09'::timestamptz
]) as slot_start
on conflict (campaign_id, starts_at) do nothing;
