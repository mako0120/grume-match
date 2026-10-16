-- Campaign deliverable requirements are part of the audited campaign transaction.
-- Restaurants must create them through campaign RPCs rather than raw table writes.

drop policy if exists "restaurant members manage campaign platforms"
on public.campaign_platforms;

revoke insert, update, delete on public.campaign_platforms from authenticated;
