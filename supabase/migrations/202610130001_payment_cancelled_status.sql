-- Commercial lifecycle: cancelled bookings must not remain payable.

alter type public.payment_status
  add value if not exists 'cancelled' after 'failed';
