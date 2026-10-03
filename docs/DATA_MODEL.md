# Data Model v1

## Design goals

- 「日時候補」を文章ではなく構造化データとして扱う
- Campaign / Application / Booking / Deliverable / Payment を分離する
- 後からAI推薦・UGC・決済を追加しても破壊的変更を減らす
- 重要状態変更を監査できる

## Core entities

```mermaid
erDiagram
  USERS ||--o| CREATOR_PROFILES : has
  USERS ||--o| RESTAURANT_MEMBERSHIPS : has
  RESTAURANTS ||--o{ RESTAURANT_MEMBERSHIPS : includes

  RESTAURANTS ||--o{ CAMPAIGNS : owns
  CAMPAIGNS ||--o{ CAMPAIGN_SLOTS : offers
  CAMPAIGNS ||--o{ APPLICATIONS : receives

  CREATOR_PROFILES ||--o{ APPLICATIONS : submits
  APPLICATIONS ||--o{ APPLICATION_AVAILABILITIES : has
  APPLICATIONS ||--o| BOOKINGS : becomes

  CAMPAIGN_SLOTS ||--o{ BOOKINGS : reserves
  BOOKINGS ||--o{ DELIVERABLES : requires
  BOOKINGS ||--o| PAYMENTS : rewards

  USERS ||--o{ AUDIT_LOGS : performs
```

## Tables

### users
- id uuid PK
- email unique
- role enum: creator | restaurant | admin
- status enum: active | suspended | deleted
- created_at
- updated_at

### creator_profiles
- id uuid PK
- user_id FK unique
- display_name
- bio
- base_area
- min_reward integer
- travel_radius_km integer
- reliability_score nullable
- verified_at nullable
- created_at
- updated_at

### creator_social_accounts
- id
- creator_id
- platform enum
- handle
- profile_url
- followers
- avg_views nullable
- avg_saves nullable
- local_audience_ratio nullable
- metrics_verified_at nullable

### restaurants
- id
- name
- address
- area
- latitude nullable
- longitude nullable
- status
- verified_at nullable
- created_at

### restaurant_memberships
- id
- restaurant_id
- user_id
- role enum: owner | manager | staff

### campaigns
- id
- restaurant_id
- title
- description
- category
- area
- cash_reward integer
- reward_tax_mode enum: tax_included | tax_excluded | unspecified
- food_offer text
- max_companions integer
- creator_slots integer
- visit_period_start date
- visit_period_end date
- application_deadline timestamptz
- status
- published_at nullable
- created_at
- updated_at

### campaign_platforms
- id
- campaign_id
- platform
- deliverable_type
- quantity
- required boolean

### campaign_slots
- id
- campaign_id
- starts_at timestamptz
- ends_at timestamptz
- capacity integer
- reserved_count integer
- status enum: open | full | closed

Constraint:
- reserved_count <= capacity
- unique(campaign_id, starts_at)

### applications
- id
- campaign_id
- creator_id
- party_size
- status
- note nullable
- applied_at

Constraint:
- unique(campaign_id, creator_id)

### application_availabilities
Creatorの「候補日時」。

- id
- application_id
- kind enum: exact_slot | flexible_after
- campaign_slot_id nullable
- date_local date
- flexible_after_local time nullable

Rules:
- exact_slot の場合 campaign_slot_id 必須
- flexible_after の場合 date_local + flexible_after_local 必須

### bookings
- id
- application_id unique
- campaign_id
- creator_id
- campaign_slot_id
- party_size
- status
- confirmed_at
- visited_at nullable
- cancelled_at nullable

DB transactionで、
1. campaign_slotsをlock
2. capacity確認
3. reserved_count increment
4. booking create
を行う。

### deliverables
- id
- booking_id
- platform
- type
- due_at
- submitted_url nullable
- submitted_at nullable
- verification_status enum: pending | approved | rejected
- verification_note nullable

### payments
- id
- booking_id unique
- creator_id
- amount integer
- currency char(3) default JPY
- status enum: pending | approved | scheduled | paid | failed
- due_at nullable
- paid_at nullable
- external_reference nullable

### notifications
- id
- user_id
- type
- title
- body
- read_at nullable
- created_at

### audit_logs
- id
- actor_user_id nullable
- actor_role
- action
- entity_type
- entity_id
- before_json nullable
- after_json nullable
- created_at

## STUDIO tables (P2-03)

### campaign_usage_rights
Campaign-level secondary-use terms. Optional; required when the campaign
asks for `ugc_photo` / `ugc_video`.

- campaign_id PK/FK
- usage_scope: organic | organic_and_ads
- duration_days: 30 | 90 | 365 (no perpetual option)
- fee integer (> 0 when ads use is included)

Locked after the first application (same rule as price and deliverables).

### content_usage_licenses
Per-booking snapshot of the terms.

- booking_id unique
- campaign_id / restaurant_id / creator_id
- usage_scope / duration_days / fee
- status: pending | active
- starts_at / expires_at (set when every deliverable is approved)

`fee` is added to `payments.amount` when the booking is confirmed.

### content_assets
UGC files in the private `ugc-assets` Storage bucket.

- deliverable_id / booking_id / creator_id / restaurant_id
- kind: photo | video
- storage_path unique (`<creator uid>/<deliverable id>/<file>`)
- mime_type / byte_size (copied from Storage metadata, not the client)

Restaurants can open files while reviewing and while the license is active.

A deliverable counts as submitted when `deliverables.submitted_at` is set
(URL deliverables also carry `submitted_url`).

## SIGNAL tables (P3-01)

### tracking_links
- code unique (8 chars, alphabet without I/O/0/1)
- booking_id unique / campaign_id / restaurant_id / creator_id
- disabled_at nullable (set when the booking is cancelled)

### signal_events
- tracking_link_id
- kind: landing_view | visit
- occurred_at
- party_size nullable (visit only)
- revenue_yen nullable (visit only)
- recorded_by nullable (Restaurant user for visits)
- voided_at nullable

No visitor identifiers (cookie, IP, user agent, guest name/contact) are
stored. Raw events are deleted after 13 months. Reservations are out of scope: the
product does not track reservation buttons or reservation records.

## PROOF tables (Creator performance)

### creator_post_metrics
One row per post per insights snapshot (self-reported).

- creator_id / platform (instagram | tiktok | youtube | threads)
- area / headline / post_url (https, optional)
- posted_on (+ posted_on_approx when derived from "3週間")
- measured_on (snapshot date; replace = same platform + date)
- views (+ views_approx when entered as "2.7万") / likes / comments / reposts / shares / saves
- verified_at (Operator only; cleared when the Creator edits the numbers)

Visible to the Creator, active Restaurants and the Operator. Summaries use
the latest snapshot and posts from the 30 days before it.

### creator_performance_evidence
Insights screenshot in the private `creator-evidence` bucket.
Visible to the Creator and the Operator only.

- status: pending | verified | rejected

See `docs/CREATOR_PERFORMANCE.md`.

## Matching

### campaign_invitations
- campaign_id / creator_id (unique pair)
- source: restaurant | auto (auto = invited on publish by match score)
- invited_by / created_at

Public, recruiting campaigns only; ≤10 per call, ≤30 per campaign.
Scoring rules: `docs/MATCHING.md`.

## Status constraints

ステータス遷移はAPI層で明示的に制限する。
UIから任意のstatus文字列を直接更新させない。

## Indexes

- campaigns(status, area, visit_period_start)
- campaign_slots(campaign_id, starts_at, status)
- applications(campaign_id, status)
- applications(creator_id, status)
- bookings(creator_id, status)
- bookings(campaign_id, status)
- deliverables(due_at, verification_status)
- payments(status, due_at)

## Future extensions

- offers
- creator_rate_cards
- disputes
- creator_metrics_daily
- restaurant_subscriptions
- payout_accounts
- flash_campaigns
