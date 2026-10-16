-- Distinguish "recruitment ended" from cancelling already-confirmed PR visits.

alter type public.campaign_status
  add value if not exists 'closed' before 'filled';
