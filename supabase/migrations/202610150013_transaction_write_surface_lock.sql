-- Commercial transactions must be mutated through audited RPCs, not raw table writes.
-- Read policies remain in place; this removes client write surfaces that can bypass
-- deadline, capacity, verification, audit, and state-machine invariants.

drop policy if exists "creator creates own applications"
on public.applications;

drop policy if exists "creator manages own availability"
on public.application_availabilities;

drop policy if exists "restaurant members manage campaigns"
on public.campaigns;

drop policy if exists "restaurant members manage slots"
on public.campaign_slots;

drop policy if exists "restaurant manages campaign targets"
on public.campaign_target_creators;

-- Keep explicit grants narrow enough that an accidental future permissive policy
-- does not automatically restore these direct write paths.
revoke insert, update, delete on public.applications from authenticated;
revoke insert, update, delete on public.application_availabilities from authenticated;
revoke insert, update, delete on public.campaigns from authenticated;
revoke insert, update, delete on public.campaign_slots from authenticated;
revoke insert, update, delete on public.campaign_target_creators from authenticated;
