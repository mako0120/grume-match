-- Restaurants need read-only payment visibility for their own confirmed PR bookings.

drop policy if exists "payments restaurant read scoped"
on public.payments;

create policy "payments restaurant read scoped"
on public.payments for select
using (
  exists (
    select 1
    from public.bookings b
    join public.campaigns c on c.id = b.campaign_id
    where b.id = booking_id
      and public.is_restaurant_member(c.restaurant_id)
  )
);
