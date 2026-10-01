-- Admin-only manual payout state management for the SOLO MVP.

create policy "admin updates payments"
on public.payments for update
using (public.is_admin())
with check (public.is_admin());
