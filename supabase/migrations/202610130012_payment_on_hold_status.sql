-- Pause payout movement while a booking dispute is under review.

alter type public.payment_status
  add value if not exists 'on_hold' after 'approved';
