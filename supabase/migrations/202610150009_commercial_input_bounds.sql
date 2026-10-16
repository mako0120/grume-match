-- Bound public campaign inputs so malformed or abusive requests cannot create
-- unreasonably large commercial records.

alter table public.campaigns
  add constraint campaigns_cash_reward_upper_bound
    check (cash_reward <= 1000000),
  add constraint campaigns_creator_slots_upper_bound
    check (creator_slots <= 50),
  add constraint campaigns_visit_period_upper_bound
    check (visit_period_end - visit_period_start <= 90),
  add constraint campaigns_title_length
    check (char_length(title) <= 200),
  add constraint campaigns_description_length
    check (char_length(description) <= 5000),
  add constraint campaigns_category_length
    check (char_length(category) <= 100),
  add constraint campaigns_area_length
    check (char_length(area) <= 200),
  add constraint campaigns_food_offer_length
    check (char_length(food_offer) <= 1000);

alter table public.campaign_slots
  add constraint campaign_slots_capacity_upper_bound
    check (capacity <= 20),
  add constraint campaign_slots_duration_upper_bound
    check (ends_at <= starts_at + interval '12 hours');

alter table public.applications
  add constraint applications_note_length
    check (note is null or char_length(note) <= 2000);

alter table public.deliverables
  add constraint deliverables_url_length
    check (submitted_url is null or char_length(submitted_url) <= 2048),
  add constraint deliverables_note_length
    check (verification_note is null or char_length(verification_note) <= 2000);
